importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAGW_XFLGw7PcUAtFi2h9IcW8A7629uKyU",
  authDomain: "vanellix-adcf0.firebaseapp.com",
  projectId: "vanellix-adcf0",
  storageBucket: "vanellix-adcf0.firebasestorage.app",
  messagingSenderId: "958239060308",
  appId: "1:958239060308:web:3e1a64d997554b32f8d8c1"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon || '/icon.png'
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});