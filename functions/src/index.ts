import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

admin.initializeApp();
const db = admin.firestore();

interface UserPreferences {
  userId: string;
  pushEnabled?: boolean;
  notifyExpireIn: string | null; // '1_day' | '3_days' | '1_week'
  notifyTimeOfDay: string | null; // 'morning' | 'afternoon' | 'evening'
}

interface FCMTokenDoc {
  userId: string;
  token: string;
}

interface ItemDoc {
  userId: string;
  name: string;
  autoExpirationDate: string;
  manualExpirationDate: string | null;
  status?: string;
}

function getExpireDays(notifyExpireIn: string | null): number {
  switch (notifyExpireIn) {
    case '1_day': return 1;
    case '3_days': return 3;
    case '1_week': return 7;
    default: return 3;
  }
}

function getCurrentTimeSlot(): string {
  // UTC-based approximation (can be refined with user timezone)
  const hour = new Date().getUTCHours();
  // Adjust for US timezones (rough: UTC-5 to UTC-8)
  const estHour = (hour - 5 + 24) % 24;
  if (estHour >= 6 && estHour < 12) return 'morning';
  if (estHour >= 12 && estHour < 17) return 'afternoon';
  return 'evening';
}

// Run every 6 hours
export const sendExpirationNotifications = onSchedule(
  { schedule: 'every 6 hours', timeoutSeconds: 120, region: 'us-central1' },
  async () => {
    const timeSlot = getCurrentTimeSlot();

    // 1. Get users who want notifications at this time
    const prefsSnap = await db.collection('userPreferences')
      .where('pushEnabled', '==', true)
      .where('notifyTimeOfDay', '==', timeSlot)
      .get();

    if (prefsSnap.empty) return;

    // 2. For each user, check expiring items and send notification
    const promises = prefsSnap.docs.map(async (prefDoc) => {
      const prefs = prefDoc.data() as UserPreferences;
      const userId = prefs.userId;
      const days = getExpireDays(prefs.notifyExpireIn);

      // Get user's active items
      const itemsSnap = await db.collection('items')
        .where('userId', '==', userId)
        .get();

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const futureDate = new Date();
      futureDate.setDate(now.getDate() + days);

      const expiringItems: string[] = [];
      itemsSnap.docs.forEach(itemDoc => {
        const item = itemDoc.data() as ItemDoc;
        if (item.status && item.status !== 'active') return;
        const expDateStr = item.manualExpirationDate || item.autoExpirationDate;
        const expDate = new Date(expDateStr);
        if (expDate >= now && expDate <= futureDate) {
          expiringItems.push(item.name);
        }
      });

      if (expiringItems.length === 0) return;

      // Get user's FCM tokens
      const tokensSnap = await db.collection('fcmTokens')
        .where('userId', '==', userId)
        .get();

      if (tokensSnap.empty) return;

      const tokens = tokensSnap.docs.map(d => (d.data() as FCMTokenDoc).token);

      // Build notification
      const title = expiringItems.length === 1
        ? `${expiringItems[0]} is expiring soon!`
        : `${expiringItems.length} items expiring soon`;
      const body = expiringItems.length === 1
        ? `Use your ${expiringItems[0]} before it expires.`
        : `${expiringItems.slice(0, 3).join(', ')}${expiringItems.length > 3 ? ` and ${expiringItems.length - 3} more` : ''} need attention.`;

      // Send to all tokens
      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: { url: '/' },
        webpush: {
          fcmOptions: { link: '/' },
        },
      });

      // Clean up failed tokens
      const failedTokens: string[] = [];
      response.responses.forEach((resp, i) => {
        if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
          failedTokens.push(tokens[i]);
        }
      });

      if (failedTokens.length > 0) {
        const batch = db.batch();
        for (const token of failedTokens) {
          // Find and delete the token doc
          const tokenQuery = await db.collection('fcmTokens')
            .where('token', '==', token)
            .get();
          tokenQuery.docs.forEach(d => batch.delete(d.ref));
        }
        await batch.commit();
      }
    });

    await Promise.all(promises);
  }
);
