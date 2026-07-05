// Push notification handler for the FitnessTracker PWA.
// Loaded by the Workbox service worker via importScripts.

self.addEventListener("push", function (event) {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    // Non-JSON payload — show a generic notification
    const options = {
      body: event.data.text(),
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      data: { url: "/" },
    };
    event.waitUntil(self.registration.showNotification("FitnessTracker", options));
    return;
  }

  const options = {
    body: data.body || "",
    icon: data.icon || "/pwa-192x192.png",
    badge: data.badge || "/pwa-192x192.png",
    data: { url: data.url || "/" },
    vibrate: [200, 100, 200],
    tag: data.tag || "default",
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window" }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].url && "focus" in clientList[i]) {
          return clientList[i].focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("/");
      }
    }),
  );
});
