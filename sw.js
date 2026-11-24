// Service Worker — AD Export / Controle
// Arquivos do site: REDE PRIMEIRO (sempre abre a versão nova).
// O cache só é usado quando estiver offline.
// Ao criar/renomear arquivos .js/.css, inclua-os em SHELL_FILES e suba o número do SHELL_CACHE.
// O Consulta fica no mesmo endereço (felippeadexport.github.io), por isso este
// service worker só mexe nos caches que começam com "controle-".
const SHELL_CACHE = 'controle-shell-v5';
const SHELL_FILES = [
  './',
  './index.html',
  './css/style.css',
  './js/offline.js',
  './js/utils.js',
  './js/app.js',
  './js/controle.js',
  './js/controle-edicao.js',
  './js/controle-colunas.js',
  './js/nf.js',
  './js/notificacoes.js',
  './js/relatorio-controle.js',
  './js/metas.js',
  './js/config.js',
  './manifest.json',
  './icons/logo-claro.png',
  './icons/logo-escuro.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) =>
      // cache:'reload' garante que pega a versão nova do servidor, não a do navegador
      Promise.all(SHELL_FILES.map((u) =>
        fetch(u, { cache: 'reload' }).then((r) => { if (r.ok) return c.put(u, r); }).catch(() => {})
      ))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n.startsWith('controle-') && n !== SHELL_CACHE).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const reqUrl = new URL(event.request.url);
  if (reqUrl.origin !== self.location.origin) return; // Worker, Drive etc.: direto na rede

  // Arquivos do site: rede primeiro, atualiza o cache, e só usa o cache se estiver offline
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then((r) => {
        if (r && r.ok) {
          const copia = r.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(event.request, copia));
        }
        return r;
      })
      .catch(() =>
        caches.match(event.request, { ignoreSearch: true }).then((cached) =>
          cached || (event.request.mode === 'navigate' ? caches.match('./index.html') : undefined)
        )
      )
  );
});
