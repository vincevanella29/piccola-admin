importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

let messaging;

async function initFirebase() {
  try {
    // 1. Fetch Firebase Config dynamically from backend (Mongo Driven)
    const response = await fetch('/api/notifications/public-config');
    const data = await response.json();
    
    if (data && data.firebaseConfig) {
      firebase.initializeApp(data.firebaseConfig);
      messaging = firebase.messaging();
      
      // Handle incoming push messages when app is in background
      messaging.onBackgroundMessage((payload) => {
        const campaignId = payload.data?.campaign_id;
        const notificationTitle = payload.notification?.title || 'Piccola Italia';
        const notificationOptions = {
          body: payload.notification?.body || '',
          icon: payload.data?.icon_url || payload.notification?.image || '/favicon-piccola.png',
          image: payload.notification?.image,
          data: {
            campaign_id: campaignId,
            url: payload.data?.url || '/app/notifications'
          }
        };
        self.registration.showNotification(notificationTitle, notificationOptions);
      });
      console.log("[ServiceWorker] Firebase initialized dynamically via Mongo Config.");
    } else {
      console.error("[ServiceWorker] No Firebase config returned from backend.");
    }
  } catch (err) {
    console.error("[ServiceWorker] Failed to fetch Firebase config:", err);
  }
}

// Initialize on boot
initFirebase();

// 2. Intercept click to report 'Open Rate' tracking
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const campaignId = event.notification.data?.campaign_id;
  
  if (campaignId) {
    // Ping backend to increment opened_count
    fetch('/api/notifications/track-click', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ campaign_id: campaignId })
    }).catch(err => console.error("[ServiceWorker] Error tracking click:", err));
  }

  // Focus existing window or open a new one
  const urlToOpen = new URL(event.notification.data?.url || '/', self.location.origin).href;
  
  const promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((windowClients) => {
    let matchingClient = null;
    for (let i = 0; i < windowClients.length; i++) {
      const windowClient = windowClients[i];
      if (windowClient.url === urlToOpen) {
        matchingClient = windowClient;
        break;
      }
    }
    if (matchingClient) {
      return matchingClient.focus();
    } else {
      return clients.openWindow(urlToOpen);
    }
  });

  event.waitUntil(promiseChain);
});
