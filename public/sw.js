let filesToCache = []
// filesToCache.push('/components.php');
// filesToCache.push('/assets/scheme.json');

filesToCache.push('/');
filesToCache.push('/index.html');
filesToCache.push('/css/main.css');
filesToCache.push('/js/vendor/jquery-3.5.1.min.js');
filesToCache.push('/js/vendor/socket.io.js');
filesToCache.push('/js/vendor/localforage.min.js');
filesToCache.push('/js/vendor/autonumeric.js');
filesToCache.push('/js/lib/db.js');
filesToCache.push('/js/lib/utils.js');
filesToCache.push('/js/approute.js');
filesToCache.push('/js/main.js');
filesToCache.push('/manifest.json');
filesToCache.push('/img/background.jpg');
filesToCache.push('/css/vendor/fontawesome/css/all.min.css');
// filesToCache.push('/js/lib/db-driver/forage.js');
filesToCache.push('/css/vendor/fontawesome/webfonts/fa-solid-900.woff2');
filesToCache.push('/img/logo_white.png');
filesToCache.push('/js/vendor/jquery.mobile-events.min.js');
filesToCache.push('/assets/triggers.html');
filesToCache.push('/assets/components.html');
filesToCache.push('/assets/img/background.jpg');
filesToCache.push('/assets/img/logo.png');

// disable cache, for dev
//filesToCache = []

const version = "0.0.35";
const cacheName = `sinaptics-${version}`;
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(cacheName).then(cache => {
      return cache.addAll(filesToCache)
        .then(() => self.skipWaiting());
    })
  );
});

self.addEventListener('activate', event => {
  // event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.open(cacheName)
      .then(cache => cache.match(event.request, { ignoreSearch: true }))
      .then(response => {
        return response || fetch(event.request);
      })
  );
});
