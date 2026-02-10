import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
} from 'firebase/auth';
import { getMessaging, isSupported, type Messaging } from 'firebase/messaging';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCbi--OGrmvk34vLR21Coco5DJZDv6W_fQ",
  authDomain: "foodies-d91fa.firebaseapp.com",
  projectId: "foodies-d91fa",
  storageBucket: "foodies-d91fa.firebasestorage.app",
  messagingSenderId: "397694091110",
  appId: "1:397694091110:web:f0e08879049171cddb92a7",
  measurementId: "G-P2420KE28R"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Auth with explicit persistence and NO popupRedirectResolver.
//
// Why:
// - getAuth() internally creates a hidden iframe to authDomain for popup/redirect flows.
// - iOS ITP blocks this third-party iframe, breaking the entire auth instance
//   (causing auth/network-request-failed even for signInWithCredential).
// - Since we use GIS (Google Identity Services) for sign-in, we don't need
//   popup/redirect at all. By omitting popupRedirectResolver, no iframe is created.
// - indexedDBLocalPersistence is the most reliable option across Safari & iOS PWA.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
});
export const googleProvider = new GoogleAuthProvider();

// Messaging - lazy init because not all browsers support it
let messagingInstance: Messaging | null = null;

export async function getMessagingInstance(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;

  const supported = await isSupported();
  if (!supported) {
    console.warn('Firebase Messaging is not supported in this browser');
    return null;
  }

  messagingInstance = getMessaging(app);
  return messagingInstance;
}
