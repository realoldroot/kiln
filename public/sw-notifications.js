// Imported into the generated Workbox service worker (see vite.config.ts).
// Focuses or opens the chat a notification points at.
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? "/"
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus()
          if ("navigate" in client) await client.navigate(url)
          return
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})
