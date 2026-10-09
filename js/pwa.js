/* PWA — registro do service worker, convite de instalação, aviso de nova versão
   e o diagnóstico que diz por que a instalação não está disponível. */

const Pwa = (() => {
  let convite = null;     // evento beforeinstallprompt (Android/Chrome)
  let reg = null;
  let aguardando = null;  // service worker novo esperando para assumir

  const seguro = () => window.isSecureContext;
  const temSW = () => 'serviceWorker' in navigator;
  const instalado = () =>
    matchMedia('(display-mode: standalone)').matches ||
    matchMedia('(display-mode: fullscreen)').matches ||
    navigator.standalone === true;
  const iOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  async function registrar() {
    if (!temSW() || !seguro()) return null;
    try {
      reg = await navigator.serviceWorker.register('sw.js', { scope: './' });
      if (reg.waiting) marcarAtualizacao(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const novo = reg.installing;
        if (!novo) return;
        novo.addEventListener('statechange', () => {
          // só é "atualização" se já havia uma versão controlando a página
          if (novo.state === 'installed' && navigator.serviceWorker.controller) marcarAtualizacao(novo);
        });
      });
      return reg;
    } catch (e) {
      console.warn('Service worker não registrou:', e.message);
      return null;
    }
  }

  function marcarAtualizacao(sw) {
    aguardando = sw;
    UI.toast('Nova versão disponível — toque para atualizar');
    const t = document.querySelector('.toast');
    if (t) {
      t.style.pointerEvents = 'auto';
      t.style.cursor = 'pointer';
      t.onclick = atualizar;
    }
  }

  function atualizar() {
    if (!aguardando) return location.reload();
    aguardando.postMessage('assumir');
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  }

  /* ---------- instalação ---------- */
  function podeConvidar() { return !!convite; }

  async function instalar() {
    if (convite) {
      convite.prompt();
      const r = await convite.userChoice;
      convite = null;
      atualizarBotoes();
      UI.toast(r.outcome === 'accepted' ? 'Instalando…' : 'Instalação cancelada');
      return r.outcome === 'accepted';
    }
    comoInstalar();
    return false;
  }

  /* Instruções manuais — no iPhone não existe convite automático. */
  function comoInstalar() {
    const passos = iOS()
      ? `<ol class="passos">
          <li>Toque no botão <b>Compartilhar</b> (o quadrado com a seta para cima), na barra de baixo do Safari.</li>
          <li>Role a lista e toque em <b>Adicionar à Tela de Início</b>.</li>
          <li>Confirme em <b>Adicionar</b>.</li>
        </ol>
        <div class="fhint">Precisa ser o Safari — no Chrome do iPhone a opção não aparece.</div>`
      : `<ol class="passos">
          <li>Abra o menu do navegador (os três pontos).</li>
          <li>Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</li>
        </ol>`;
    const aviso = seguro() ? '' : `<div class="aviso" style="margin-bottom:14px">
      <b>Este endereço não é seguro (https).</b> Dá para adicionar o atalho na tela,
      mas ele vai continuar precisando de internet: o modo offline só liga em https.</div>`;
    UI.sheet({ title: 'Instalar na tela de início', body: aviso + passos });
  }

  function atualizarBotoes() {
    document.querySelectorAll('[data-pwa-instalar]').forEach(b => {
      b.hidden = instalado();
      b.textContent = podeConvidar() ? 'Instalar app' : 'Como instalar';
    });
  }

  /* ---------- diagnóstico ---------- */
  async function cacheTem(parte) {
    try {
      const c = await caches.open('voyage-v2');
      const ks = await c.keys();
      return ks.some(r => r.url.includes(parte));
    } catch (e) { return false; }
  }

  async function diagnostico() {
    const sw = temSW() && seguro() ? !!(await navigator.serviceWorker.getRegistration()) : false;
    return {
      https: seguro(),
      protocolo: location.protocol.replace(':', ''),
      host: location.host,
      sw,
      offlinePronto: sw && (await cacheTem('index.html')),
      ocrPronto: await cacheTem('traineddata'),
      instalado: instalado(),
      podeConvidar: podeConvidar(),
      iOS: iOS(),
      online: navigator.onLine,
    };
  }

  /* ---------- indicador de offline ---------- */
  function pintarRede() {
    const el = document.getElementById('sem-rede');
    if (el) el.hidden = navigator.onLine;
  }

  function iniciar() {
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      convite = e;
      atualizarBotoes();
    });
    window.addEventListener('appinstalled', () => {
      convite = null;
      atualizarBotoes();
      UI.toast('App instalado');
    });
    window.addEventListener('online', pintarRede);
    window.addEventListener('offline', pintarRede);
    pintarRede();
    registrar();
  }

  return { iniciar, instalar, comoInstalar, diagnostico, atualizarBotoes, atualizar, instalado, seguro, iOS };
})();
