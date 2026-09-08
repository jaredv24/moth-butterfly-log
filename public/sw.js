/* Service worker: Web Push notifications for new chat messages. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  // allow an empty title through (iOS still shows the app name)
  const title = typeof data.title === "string" ? data.title : "New message";
  const body = data.body || "";
  const url = data.url || "/chat";
  const tag = data.tag || "chat";

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag,
        renotify: true,
        data: { url },
      });
      if (typeof data.badgeCount === "number" && self.navigator.setAppBadge) {
        try {
          if (data.badgeCount > 0) await self.navigator.setAppBadge(data.badgeCount);
          else await self.navigator.clearAppBadge();
        } catch {
          /* unsupported */
        }
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/chat";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of all) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(url);
            } catch {
              /* cross-origin or not allowed — ignore */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
