/* eslint-disable no-undef */
// Firebase Messaging Service Worker
// This handles background push notifications when the app is not in focus

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCbi--OGrmvk34vLR21Coco5DJZDv6W_fQ",
  authDomain: "foodies-d91fa.firebaseapp.com",
  projectId: "foodies-d91fa",
  storageBucket: "foodies-d91fa.firebasestorage.app",
  messagingSenderId: "397694091110",
  appId: "1:397694091110:web:f0e08879049171cddb92a7",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
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
          client.navigate(urlToOpen);
          return;
        }
      }
      return self.clients.openWindow(urlToOpen);
    })
  );
});
