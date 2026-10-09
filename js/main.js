/* App — rotas por hash, repintura em qualquer mudança de estado e registro do PWA. */

const App = (() => {
  const ROTAS = {
    resumo: ViewResumo,
    plano: ViewPlano,
    agenda: ViewAgenda,
    gastos: Gastos,
    acerto: ViewAcerto,
    mala: ViewMala,
  };
  const EYEBROW = {
    resumo: 'Visão geral', plano: 'Preparativos', agenda: 'Dia a dia',
    gastos: 'Controle financeiro', acerto: 'Divisão do grupo', mala: 'Bagagem',
  };

  let atual = null;
  const view = document.getElementById('view');
  const fab = document.getElementById('fab');
  const fabOcr = document.getElementById('fab-ocr');
  let scrolls = {};

  const rota = () => {
    const h = (location.hash || '').replace(/^#\/?/, '');
    return ROTAS[h] ? h : 'resumo';
  };

  function paint() {
    const r = rota();
    const V = ROTAS[r];
    const y = window.scrollY;
    view.innerHTML = V.render();
    if (atual === r) window.scrollTo(0, y);
    document.getElementById('tb-title').textContent = V.titulo;
    document.getElementById('tb-eyebrow').textContent = EYEBROW[r] || 'Voyage';
    document.querySelectorAll('#tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === r));
    const chip = document.getElementById('rate-chip');
    chip.textContent = `${Store.state.moeda.codigo} ${UI.n2(Store.state.moeda.cotacao)}`;
    fab.hidden = !V.fab;
    fabOcr.hidden = !V.fab2;
  }

  function trocar() {
    const r = rota();
    if (atual === r) { paint(); return; }
    if (atual) scrolls[atual] = window.scrollY;
    atual = r;
    paint();
    window.scrollTo(0, scrolls[r] || 0);
  }

  async function init() {
    Store.load();
    await Att.warm();

    // cada view escuta a própria raiz uma única vez (delegação no container)
    Object.values(ROTAS).forEach(V => V.bind && V.bind(view));

    Store.sub(() => paint());
    window.addEventListener('hashchange', trocar);

    document.getElementById('btn-config').onclick = () => { UI.haptic(); Config.abrir(); };
    document.getElementById('btn-rate').onclick = () => { UI.haptic(); Gastos.editarCotacao(); };
    fab.onclick = () => { const V = ROTAS[rota()]; UI.haptic(12); V.fab && V.fab(); };
    fabOcr.onclick = () => { const V = ROTAS[rota()]; UI.haptic(12); V.fab2 && V.fab2(); };

    trocar();
    Att.limpar();

    Pwa.iniciar();
  }

  return { init, paint, get rota() { return rota(); } };
})();

document.addEventListener('DOMContentLoaded', App.init);
