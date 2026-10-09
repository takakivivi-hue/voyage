/* Service worker — faz o app abrir e funcionar sem internet.
   Só roda em https (ou localhost); em http da rede local o navegador recusa,
   por isso a tela Ajustes → Instalação mostra o diagnóstico.

   Estratégia:
   - casco do app (html/css/js): cache primeiro, atualizando por baixo.
     Abrir é instantâneo mesmo com 3G ruim de roaming.
   - navegação: tenta a rede, cai no index.html guardado.
   - leitor/ (motor de OCR, 9 MB): cache primeiro, baixado só quando usado.
   Os dados da viagem nunca passam por aqui — ficam em localStorage/IndexedDB. */

const CACHE = 'voyage-v2';

const CASCO = [
  './', './index.html', './styles.css', './manifest.json',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './js/store.js', './js/db.js', './js/ui.js', './js/split.js', './js/ocr.js',
  './js/pwa.js', './js/view-resumo.js', './js/view-plano.js', './js/view-mala.js',
  './js/view-agenda.js', './js/view-gastos.js', './js/view-acerto.js',
  './js/view-config.js', './js/main.js',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // addAll falha inteiro se um arquivo falhar; aqui cada um é independente
    await Promise.all(CASCO.map(u => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* Devolve o que está guardado e revalida em segundo plano. */
async function cachePrimeiro(req) {
  const c = await caches.open(CACHE);
  const guardado = await c.match(req, { ignoreSearch: true });
  const rede = fetch(req).then(res => {
    if (res && res.ok && res.type === 'basic') c.put(req, res.clone());
    return res;
  }).catch(() => null);
  return guardado || (await rede) || new Response('', { status: 504 });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // navegação: rede primeiro (para pegar versão nova), senão o casco guardado
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const c = await caches.open(CACHE);
        c.put('./index.html', res.clone());
        return res;
      } catch (err) {
        const c = await caches.open(CACHE);
        return (await c.match('./index.html')) || (await c.match('./')) ||
          new Response('<h1>Sem conexão</h1><p>Abra o app uma vez com internet para ele funcionar offline.</p>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 });
      }
    })());
    return;
  }

  e.respondWith(cachePrimeiro(req));
});

/* A página pede para a versão nova assumir sem esperar o fechamento das abas. */
self.addEventListener('message', e => {
  if (e.data === 'assumir') self.skipWaiting();
});
