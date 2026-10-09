/* Plano — checklist de preparativos: o que já foi resolvido, o que está pendente,
   com prazo, responsável, custo previsto/realizado e anexos (voucher, contrato). */

const ViewPlano = (() => {
  const E = UI.esc;
  let filtro = { grupo: '', status: '' };

  const campos = () => ([
    { k: 'titulo', label: 'O que precisa ser feito', ph: 'Reservar hotel em Kyoto' },
    { k: 'grupo', label: 'Grupo', type: 'select', opts: () => Store.state.gruposCheck, vazia: false, half: true },
    { k: 'prazo', label: 'Prazo', type: 'date', half: true },
    { k: 'resp', label: 'Responsável', ph: 'Quem resolve' },
    { k: 'custo', label: 'Custo', type: 'money', hint: 'Digite em qualquer uma das moedas — a outra é calculada pela cotação.' },
    { k: 'obs', label: 'Anotações', type: 'textarea', rows: 3, ph: 'Número da reserva, link, condições de cancelamento…' },
    { k: 'anexos', label: 'Vouchers, ingressos, contratos', type: 'files' },
  ]);

  async function novo(pre = {}) {
    const r = await UI.form({ title: 'Novo preparativo', campos: campos(), valores: { grupo: filtro.grupo || Store.state.gruposCheck[0], anexos: [], ...pre } });
    if (r && r.titulo) Store.add('checklist', { ...r, feito: false });
    else if (r) UI.toast('Dê um nome ao item');
  }

  async function editar(id) {
    const it = Store.find('checklist', id);
    if (!it) return;
    const r = await UI.form({
      title: 'Preparativo', campos: campos(), valores: { ...it }, onDelete: () => Store.del('checklist', id),
    });
    if (r) Store.upd('checklist', id, r);
  }

  function item(it) {
    const c = UI.conv(it.custo);
    const atrasado = !it.feito && it.prazo && it.prazo < UI.hoje();
    return `<div class="item ${it.feito ? 'done' : ''}" data-id="${it.id}">
      <button class="tick" data-tick aria-pressed="${it.feito}" aria-label="${it.feito ? 'Desmarcar' : 'Marcar como resolvido'}">
        <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>
      <div class="it-body">
        <div class="it-title">${E(it.titulo)}</div>
        <div class="it-meta">
          <span class="chip">${E(it.grupo || 'Outros')}</span>
          ${it.prazo ? `<span class="chip ${atrasado ? 'pend' : ''}">${atrasado ? 'venceu ' : 'até '}${UI.dmy(it.prazo)}</span>` : ''}
          ${it.resp ? `<span class="chip">${E(it.resp)}</span>` : ''}
          ${!c.vazio ? `<span class="chip gold">R$ ${UI.n2(c.brl)} · ${E(UI.sim())} ${UI.n2(c.fx)}</span>` : ''}
          ${UI.badgeAnexos(it.anexos)}
        </div>
        ${it.obs ? `<div class="it-note">${E(it.obs)}</div>` : ''}
      </div>
      <button class="it-edit" data-ed aria-label="Editar"><svg viewBox="0 0 24 24"><path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg></button>
    </div>`;
  }

  function render() {
    const s = Store.state;
    let lista = s.checklist;
    if (filtro.grupo) lista = lista.filter(i => (i.grupo || 'Outros') === filtro.grupo);
    if (filtro.status === 'pend') lista = lista.filter(i => !i.feito);
    if (filtro.status === 'ok') lista = lista.filter(i => i.feito);

    const feitos = s.checklist.filter(i => i.feito).length;
    const pct = s.checklist.length ? Math.round(feitos / s.checklist.length * 100) : 0;
    const pendentes = s.checklist.length - feitos;
    const atrasados = s.checklist.filter(i => !i.feito && i.prazo && i.prazo < UI.hoje()).length;

    const custoPrev = s.checklist.reduce((a, i) => a + UI.brlDe(i.custo), 0);

    const topo = `<div class="card">
      <div class="spread">
        <div><span class="eyebrow">Pendentes</span><div class="money-xl num">${pendentes}</div></div>
        <div class="center"><span class="eyebrow">Resolvidos</span><div class="money-lg num">${feitos}/${s.checklist.length}</div></div>
      </div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <div class="row wrap tiny muted" style="margin-top:10px">
        ${atrasados ? `<span class="chip pend">${atrasados} com prazo vencido</span>` : ''}
        ${custoPrev ? `<span class="chip gold">custos lançados R$ ${UI.n2(custoPrev)}</span>` : ''}
      </div>
    </div>`;

    const grupos = `<div class="chips scroll">
      <button class="chip tgl" data-fg="" aria-pressed="${!filtro.grupo}">Todos</button>
      ${s.gruposCheck.map(g => {
        const n = s.checklist.filter(i => (i.grupo || 'Outros') === g).length;
        const p = s.checklist.filter(i => (i.grupo || 'Outros') === g && !i.feito).length;
        return `<button class="chip tgl" data-fg="${E(g)}" aria-pressed="${filtro.grupo === g}">${E(g)}${n ? ` <b style="font-weight:600;opacity:.6">${p}/${n}</b>` : ''}</button>`;
      }).join('')}
    </div>
    <div class="chips">
      <button class="chip tgl" data-fs="" aria-pressed="${!filtro.status}">Tudo</button>
      <button class="chip tgl" data-fs="pend" aria-pressed="${filtro.status === 'pend'}">Pendentes</button>
      <button class="chip tgl" data-fs="ok" aria-pressed="${filtro.status === 'ok'}">Resolvidos</button>
    </div>`;

    // pendentes primeiro, depois por prazo
    const ord = [...lista].sort((a, b) => (a.feito - b.feito) || ((a.prazo || '9999') < (b.prazo || '9999') ? -1 : 1));
    const corpo = ord.length ? ord.map(item).join('') : '<div class="empty">Nenhum item com esse filtro.</div>';

    return `${topo}${grupos}<section class="block">${corpo}</section>`;
  }

  function bind(root) {
    root.addEventListener('click', e => {
      if (App.rota !== 'plano') return;
      const fg = e.target.closest('[data-fg]');
      if (fg) { filtro.grupo = fg.dataset.fg; UI.haptic(5); App.paint(); return; }
      const fs = e.target.closest('[data-fs]');
      if (fs) { filtro.status = fs.dataset.fs; UI.haptic(5); App.paint(); return; }
      const row = e.target.closest('[data-id]');
      if (!row) return;
      if (e.target.closest('[data-tick]')) {
        const it = Store.find('checklist', row.dataset.id);
        UI.haptic(12);
        Store.upd('checklist', row.dataset.id, { feito: !it.feito });
        return;
      }
      if (e.target.closest('[data-ed]') || row.classList.contains('item')) editar(row.dataset.id);
    });
  }

  return { render, bind, novo, titulo: 'Plano', fab: () => novo() };
})();
