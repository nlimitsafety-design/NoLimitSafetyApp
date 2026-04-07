// Service Worker for Push Notifications
// This file must be at the root of the public folder

self.addEventListener('push', function(event) {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Nieuwe melding', body: event.data.text() };
  }

  const options = {
    body: data.body || data.message || '',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: data.tag || 'notification-' + Date.now(),
    data: {
      url: data.url || '/notifications',
      shiftId: data.shiftId,
    },
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open', title: 'Bekijken' },
      { action: 'dismiss', title: 'Sluiten' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Security App', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/notifications';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});
