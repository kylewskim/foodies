import { getToken, onMessage, deleteToken, type MessagePayload } from 'firebase/messaging';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { getMessagingInstance } from './firebaseConfig';

/**
 * Check if push notifications are supported in the current browser
 */
export function isNotificationSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Check if running as installed PWA (home screen)
 */
export function isInstalledPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true);
}

/**
 * Get current notification permission state
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Request notification permission and register FCM token
 */
export async function requestNotificationPermission(userId: string): Promise<boolean> {
  if (!isNotificationSupported()) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  try {
    const messaging = await getMessagingInstance();
    if (!messaging) return false;

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn('VAPID key not configured');
      return false;
    }

    // Get the service worker registration for FCM
    const swRegistration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')
      || await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swRegistration,
    });

    if (token) {
      await saveFCMToken(userId, token);
      return true;
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
  }

  return false;
}

/**
 * Remove FCM token (when user disables notifications)
 */
export async function removeFCMToken(userId: string): Promise<void> {
  try {
    const messaging = await getMessagingInstance();
    if (!messaging) return;

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) return;

    const swRegistration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swRegistration,
    });

    if (token) {
      await deleteToken(messaging);
      await deleteFCMTokenDoc(userId, token);
    }
  } catch (error) {
    console.error('Error removing FCM token:', error);
  }
}

/**
 * Setup foreground message handler
 */
export function setupForegroundHandler(
  callback: (payload: MessagePayload) => void
): () => void {
  let unsubscribe = () => {};

  getMessagingInstance().then(messaging => {
    if (messaging) {
      unsubscribe = onMessage(messaging, callback);
    }
  });

  return () => unsubscribe();
}

// --- Internal helpers ---

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function saveFCMToken(userId: string, token: string): Promise<void> {
  const tokenHash = await hashToken(token);
  const docRef = doc(db, 'fcmTokens', tokenHash);
  await setDoc(docRef, {
    userId,
    token,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

async function deleteFCMTokenDoc(userId: string, token: string): Promise<void> {
  const tokenHash = await hashToken(token);
  const docRef = doc(db, 'fcmTokens', tokenHash);
  // Only delete - userId param kept for future multi-device use
  void userId;
  await deleteDoc(docRef);
}
