/* Mala — check list de bagagem separado por grupos (roupas, acessórios,
   remédios, suplementos, receitas médicas…), todos editáveis. */

const ViewMala = (() => {
  const E = UI.esc;
  let soPend = false;

  const campos = () => ([
    { k: 'nome', label: 'Item', ph: 'Casaco impermeável' },
    { k: 'grupo', label: 'Grupo', type: 'select', opts: () => Store.state.gruposMala, vazia: false, half: true },
    { k: 'qtd', label: 'Quantidade', half: true, ph: '2' },
    { k: 'obs', label: 'Observação', type: 'textarea', rows: 2, ph: 'Está na gaveta de cima / comprar antes' },
  ]);

  async function novo(grupo) {
    const r = await UI.form({ title: 'Novo item da mala', campos: campos(), valores: { grupo: grupo || Store.state.gruposMala[0] } });
    if (r && r.nome) Store.add('mala', { ...r, feito: false });
  }

  async function editar(id) {
    const it = Store.find('mala', id);
    if (!it) return;
    const r = await UI.form({ title: 'Item da mala', campos: campos(), valores: { ...it }, onDelete: () => Store.del('mala', id) });
    if (r) Store.upd('mala', id, r);
  }

  function render() {
    const s = Store.state;
    const feitos = s.mala.filter(i => i.feito).length;
    const pct = s.mala.length ? Math.round(feitos / s.mala.length * 100) : 0;

    const topo = `<div class="card">
      <div class="spread">
        <div><span class="eyebrow">Mala pronta</span><div class="money-xl num">${pct}%</div></div>
        <div class="center"><span class="eyebrow">Itens</span><div class="money-lg num">${feitos}/${s.mala.length}</div></div>
      </div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <div class="row" style="margin-top:12px">
        <button class="chip tgl" data-pend aria-pressed="${soPend}">Mostrar só o que falta</button>
      </div>
    </div>`;

    // grupos usados, na ordem definida nos ajustes, e depois os avulsos
    const usados = [...new Set([...s.gruposMala, ...s.mala.map(i => i.grupo || 'Outros')])];
    const blocos = usados.map(g => {
      let itens = s.mala.filter(i => (i.grupo || 'Outros') === g);
      const total = itens.length, ok = itens.filter(i => i.feito).length;
      if (soPend) itens = itens.filter(i => !i.feito);
      if (!total) return '';
      if (soPend && !itens.length) return '';
      return `<section class="block">
        <div class="sec-row">
          <h2 class="sec">${E(g)}<span class="count">${ok}/${total}</span></h2>
          <button class="btn quiet sm" data-add="${E(g)}">+ item</button>
        </div>
        ${itens.map(i => `<div class="item ${i.feito ? 'done' : ''}" data-id="${i.id}">
          <button class="tick" data-tick aria-pressed="${i.feito}" aria-label="Marcar"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>
          <div class="it-body">
            <div class="it-title">${E(i.nome)}${i.qtd ? ` <span class="muted tiny">× ${E(i.qtd)}</span>` : ''}</div>
            ${i.obs ? `<div class="it-note">${E(i.obs)}</div>` : ''}
          </div>
          <button class="it-edit" data-ed aria-label="Editar"><svg viewBox="0 0 24 24"><path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg></button>
        </div>`).join('')}
      </section>`;
    }).join('');

    return topo + (blocos || '<div class="empty">Nenhum item na mala ainda.</div>');
  }

  function bind(root) {
    root.addEventListener('click', e => {
      if (App.rota !== 'mala') return;
      if (e.target.closest('[data-pend]')) { soPend = !soPend; UI.haptic(5); App.paint(); return; }
      const a = e.target.closest('[data-add]');
      if (a) { novo(a.dataset.add); return; }
      const row = e.target.closest('[data-id]');
      if (!row) return;
      if (e.target.closest('[data-tick]')) {
        const it = Store.find('mala', row.dataset.id);
        UI.haptic(12);
        Store.upd('mala', row.dataset.id, { feito: !it.feito });
        return;
      }
      if (e.target.closest('[data-ed]') || row.classList.contains('item')) editar(row.dataset.id);
    });
  }

  return { render, bind, titulo: 'Mala', fab: () => novo() };
})();
