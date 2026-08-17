self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { notification: { body: event.data ? event.data.text() : "" } }; }
  const notification = payload.notification || (payload.data || {});
  const title = notification.title || "Cuppet";
  const options = {
    body: notification.body || "One of your agents has an update.",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    data: { url: notification.url || "/" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url || "/"));
});
