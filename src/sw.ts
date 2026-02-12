/// <reference lib="webworker" />

import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// ─── Workbox Precache ────────────────────────────────────────────────────────
// vite-plugin-pwa injects the precache manifest into self.__WB_MANIFEST
precacheAndRoute(self.__WB_MANIFEST);

// ─── Firebase Cloud Messaging ────────────────────────────────────────────────
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// @ts-expect-error firebase is loaded via importScripts
const app = firebase.initializeApp({
  apiKey: "AIzaSyCbi--OGrmvk34vLR21Coco5DJZDv6W_fQ",
  authDomain: "foodies-d91fa.firebaseapp.com",
  projectId: "foodies-d91fa",
  storageBucket: "foodies-d91fa.firebasestorage.app",
  messagingSenderId: "397694091110",
  appId: "1:397694091110:web:f0e08879049171cddb92a7",
});

// @ts-expect-error firebase is loaded via importScripts
const messaging = firebase.messaging(app);

messaging.onBackgroundMessage((payload: { notification?: { title?: string; body?: string }; data?: { url?: string } }) => {
  const title = payload.notification?.title || 'Freshli';
  const options = {
    body: payload.notification?.body || 'Check your food items!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: 'freshli-expiration',
    data: {
      url: payload.data?.url || '/',
    },
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          (client as WindowClient).navigate(urlToOpen);
          return;
        }
      }
      return self.clients.openWindow(urlToOpen);
    })
  );
});
