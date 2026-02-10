import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import {
  initializeAuth,
  browserLocalPersistence,
  inMemoryPersistence,
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

// Initialize Auth with explicit persistence.
// iOS standalone PWA / ITP 환경에서의 인증 이슈를 줄이기 위해
// 가능한 경우 브라우저 영구 저장소를 사용하고, 그렇지 않으면 in-memory 로 fallback 합니다.
export const auth = initializeAuth(app, {
  persistence: typeof window !== 'undefined'
    ? [browserLocalPersistence, inMemoryPersistence]
    : [inMemoryPersistence],
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
