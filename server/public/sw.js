const CACHE = "jims-shell-v1";
const ASSETS = [
    "/offline.html",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/assets/jims-logo.png",
];
self.addEventListener("install", (event) =>
    event.waitUntil(
        caches
            .open(CACHE)
            .then((c) => c.addAll(ASSETS))
            .then(() => self.skipWaiting()),
    ),
);
self.addEventListener("activate", (event) =>
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((k) => k.startsWith("jims-") && k !== CACHE)
                        .map((k) => caches.delete(k)),
                ),
            )
            .then(() => self.clients.claim()),
    ),
);
self.addEventListener("fetch", (event) => {
    const u = new URL(event.request.url);
    if (event.request.method !== "GET" || u.origin !== self.location.origin)
        return;
    // Never cache authenticated HTML, API responses, or CSRF tokens.
    if (event.request.mode === "navigate") {
        event.respondWith(
            fetch(event.request).catch(() => caches.match("/offline.html")),
        );
        return;
    }
    if (ASSETS.includes(u.pathname) || u.pathname.startsWith("/build/"))
        event.respondWith(
            caches.match(event.request).then(
                (hit) =>
                    hit ||
                    fetch(event.request).then((res) => {
                        if (res.ok) {
                            const copy = res.clone();
                            caches
                                .open(CACHE)
                                .then((c) => c.put(event.request, copy));
                        }
                        return res;
                    }),
            ),
        );
});
self.addEventListener("push", (event) => {
    let d = { title: "JiMS", body: "Ada pembaruan kegiatan.", url: "/" };
    try {
        Object.assign(d, event.data.json());
    } catch {}
    event.waitUntil(
        self.registration.showNotification(d.title, {
            body: d.body,
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            tag: "jims-update",
            data: { url: "/" },
        }),
    );
});
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients
            .matchAll({ type: "window", includeUncontrolled: true })
            .then((clients) => {
                const c = clients.find(
                    (c) => new URL(c.url).origin === self.location.origin,
                );
                return c ? c.focus() : self.clients.openWindow("/");
            }),
    );
});
