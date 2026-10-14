// TokenForge Service Worker for System Mobile & Desktop Notifications
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Listen for message events from client to display native OS / mobile notifications
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SHOW_NOTIFICATION") {
    const { title, options } = event.data;
    event.waitUntil(
      self.registration.showNotification(title, {
        icon: "/favicon/favicon-192x192.png",
        badge: "/favicon/favicon-32x32.png",
        vibrate: [300, 100, 300, 100, 300],
        tag: options?.tag || "tokenforge-live-alert",
        renotify: true,
        requireInteraction: true,
        ...options,
      })
    );
  }
});

// Listen for push notifications if server push is configured
self.addEventListener("push", (event) => {
  let data = {
    title: "🚨 TokenForge Failure Alert",
    body: "A live request failed upstream.",
  };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/favicon/favicon-192x192.png",
      badge: "/favicon/favicon-32x32.png",
      vibrate: [300, 100, 300, 100, 300],
      tag: "tokenforge-live-fail",
      renotify: true,
      requireInteraction: true,
      data: { url: "/admin?tab=live-requests" },
    })
  );
});

// When user taps/clicks the mobile notification in their phone notification bar or lock screen
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/admin?tab=live-requests";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
