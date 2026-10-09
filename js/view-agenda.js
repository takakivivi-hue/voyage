/* Agenda — calendário do mês e roteiro dia a dia.
   Cada compromisso tem status planejado / realizado / cancelado, então a tela
   mostra lado a lado o que estava programado e o que de fato aconteceu.
   Clicar num dia abre o dia: programação + gastos + prazos do checklist. */

const ViewAgenda = (() => {
  const E = UI.esc;
  let mes = null;          // {a, m} mês visível
  let modo = 'mes';        // 'mes' | 'roteiro'

  function mesAtual() {
    if (mes) return mes;
    const base = Store.state.viagem.dataInicio || UI.hoje();
    const [a, m] = base.split('-').map(Number);
    mes = { a, m };
    return mes;
  }

  const iso = (a, m, d) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const campos = () => ([
    { k: 'titulo', label: 'Compromisso', ph: 'Almoço no Sukiyabashi' },
    { k: 'data', label: 'Data', type: 'date', half: true },
    { k: 'hora', label: 'Hora', type: 'time', half: true },
    { k: 'local', label: 'Local', ph: 'Endereço ou ponto de encontro' },
    { k: 'status', label: 'Status', type: 'select', vazia: false, half: true,
      opts: [{ v: 'planejado', t: 'Planejado' }, { v: 'realizado', t: 'Realizado' }, { v: 'cancelado', t: 'Não aconteceu' }] },
    { k: 'categoria', label: 'Categoria', type: 'select', opts: () => Store.state.categorias, half: true },
    { k: 'custo', label: 'Custo previsto', type: 'money', hint: 'Lançado aqui como previsão; o gasto real vai na aba Gastos.' },
    { k: 'obs', label: 'Anotações', type: 'textarea', rows: 3, ph: 'Confirmação, dress code, como chegar…' },
    { k: 'anexos', label: 'Ingressos e vouchers', type: 'files' },
  ]);

  async function novo(pre = {}) {
    const r = await UI.form({ title: 'Novo compromisso', campos: campos(),
      valores: { status: 'planejado', data: pre.data || Store.state.viagem.dataInicio || UI.hoje(), anexos: [], ...pre } });
    if (r && r.titulo) Store.add('agenda', r);
  }

  async function editar(id) {
    const it = Store.find('agenda', id);
    if (!it) return;
    const r = await UI.form({ title: 'Compromisso', campos: campos(), valores: { ...it }, onDelete: () => Store.del('agenda', id) });
    if (r) Store.upd('agenda', id, r);
  }

  const doDia = d => Store.state.agenda.filter(i => i.data === d)
    .sort((a, b) => (a.hora || '99') < (b.hora || '99') ? -1 : 1);

  function cardCompromisso(i) {
    const c = UI.conv(i.custo);
    const cls = i.status === 'realizado' ? 'done' : i.status === 'cancelado' ? 'skip' : '';
    return `<div class="card tight tl-item ${cls}" data-ag="${i.id}" style="margin-top:8px">
      <div class="spread" style="align-items:flex-start">
        <div class="grow">
          <div class="row" style="gap:8px">
            ${i.hora ? `<span class="hora">${E(i.hora)}</span>` : ''}
            <span style="font-weight:500${i.status === 'cancelado' ? ';text-decoration:line-through;opacity:.6' : ''}">${E(i.titulo)}</span>
          </div>
          ${i.local ? `<div class="tiny muted" style="margin-top:3px">${E(i.local)}</div>` : ''}
          <div class="it-meta">
            <span class="chip ${i.status === 'realizado' ? 'ok' : i.status === 'cancelado' ? 'off' : 'pend'}">${i.status === 'realizado' ? 'realizado' : i.status === 'cancelado' ? 'não aconteceu' : 'planejado'}</span>
            ${i.categoria ? `<span class="chip">${E(i.categoria)}</span>` : ''}
            ${!c.vazio ? `<span class="chip gold">prev. R$ ${UI.n2(c.brl)}</span>` : ''}
            ${UI.badgeAnexos(i.anexos)}
          </div>
          ${i.obs ? `<div class="it-note">${E(i.obs)}</div>` : ''}
        </div>
        <button class="tick" data-ok="${i.id}" aria-pressed="${i.status === 'realizado'}" aria-label="Marcar como realizado">
          <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>
      </div>
    </div>`;
  }

  /* ---------- folha do dia ---------- */
  function abrirDia(d) {
    const ag = doDia(d);
    const gs = Gastos.doDia(d);
    const prazos = Store.state.checklist.filter(i => i.prazo === d);
    const t = Gastos.totais(d, d, '');

    const body = `
      <div class="card tight">
        <div class="grid-2">
          <div><span class="eyebrow">Gasto no dia</span><div class="money-lg num">${UI.brl(t.realizado.brl)}</div><div class="fx">${UI.fx(t.realizado.fx)}</div></div>
          <div><span class="eyebrow">Previsto</span><div class="money-lg num">${UI.brl(t.previsto.brl)}</div><div class="fx">${UI.fx(t.previsto.fx)}</div></div>
        </div>
      </div>

      <div class="sec-row" style="margin-top:20px">
        <h2 class="sec">Programação<span class="count">${ag.length}</span></h2>
        <button class="btn quiet sm" data-novo-ag>+ compromisso</button>
      </div>
      ${ag.length ? `<div class="tl">${ag.map(cardCompromisso).join('')}</div>` : '<div class="empty">Nada programado para este dia.</div>'}

      <div class="sec-row" style="margin-top:20px">
        <h2 class="sec">Gastos<span class="count">${gs.length}</span></h2>
        <button class="btn quiet sm" data-novo-g>+ gasto</button>
      </div>
      ${gs.length ? gs.map(g => Gastos.cardHTML(g)).join('') : '<div class="empty">Nenhum gasto anotado neste dia.</div>'}

      ${prazos.length ? `<div class="sec-row" style="margin-top:20px"><h2 class="sec">Prazos do plano<span class="count">${prazos.length}</span></h2></div>
        ${prazos.map(p => `<div class="item ${p.feito ? 'done' : ''}"><div class="it-body"><div class="it-title">${E(p.titulo)}</div>
          <div class="it-meta"><span class="chip ${p.feito ? 'ok' : 'pend'}">${p.feito ? 'resolvido' : 'pendente'}</span><span class="chip">${E(p.grupo || '')}</span></div></div></div>`).join('')}` : ''}
    `;

    const sh = UI.sheet({ title: UI.extenso(d), sub: UI.dmy(d), body });
    sh.body.addEventListener('click', async e => {
      if (e.target.closest('[data-novo-ag]')) { sh.close(); await novo({ data: d }); return; }
      if (e.target.closest('[data-novo-g]')) { sh.close(); await Gastos.novo({ data: d }); return; }
      const ok = e.target.closest('[data-ok]');
      if (ok) {
        const it = Store.find('agenda', ok.dataset.ok);
        UI.haptic(12);
        Store.upd('agenda', ok.dataset.ok, { status: it.status === 'realizado' ? 'planejado' : 'realizado' });
        sh.close(); abrirDia(d); return;
      }
      const ag2 = e.target.closest('[data-ag]');
      if (ag2) { sh.close(); await editar(ag2.dataset.ag); return; }
      const g2 = e.target.closest('[data-gasto]');
      if (g2) { sh.close(); await Gastos.editar(g2.dataset.gasto); }
    });
  }

  /* ---------- calendário ---------- */
  function calendario() {
    const { a, m } = mesAtual();
    const s = Store.state;
    const primeiro = new Date(a, m - 1, 1);
    const dias = new Date(a, m, 0).getDate();
    const off = primeiro.getDay();
    const diasAnt = new Date(a, m - 1, 0).getDate();

    const cels = [];
    for (let i = off - 1; i >= 0; i--) cels.push({ d: diasAnt - i, out: true });
    for (let d = 1; d <= dias; d++) cels.push({ d, out: false });
    while (cels.length % 7) cels.push({ d: cels.length - off - dias + 1, out: true });

    const html = cels.map(c => {
      if (c.out) return `<button class="day out" disabled>${c.d}</button>`;
      const key = iso(a, m, c.d);
      const temAg = s.agenda.some(i => i.data === key);
      const temG = s.gastos.some(i => i.data === key);
      const temC = s.checklist.some(i => i.prazo === key && !i.feito);
      const naViagem = s.viagem.dataInicio && s.viagem.dataFim && key >= s.viagem.dataInicio && key <= s.viagem.dataFim;
      return `<button class="day ${naViagem ? 'trip' : ''} ${key === UI.hoje() ? 'today' : ''}" data-dia="${key}">
        ${c.d}<span class="dots">${temAg ? '<i></i>' : ''}${temG ? '<i class="e"></i>' : ''}${temC ? '<i class="c"></i>' : ''}</span></button>`;
    }).join('');

    const tMes = Gastos.totais(iso(a, m, 1), iso(a, m, dias), '');

    return `<div class="card">
      <div class="cal-head">
        <button class="icon-btn" data-mes="-1" aria-label="Mês anterior"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
        <div class="center"><div class="mname">${UI.MESES[m - 1]} ${a}</div>
          <div class="tiny muted">gasto no mês ${UI.n2(tMes.realizado.brl)} BRL</div></div>
        <button class="icon-btn" data-mes="1" aria-label="Próximo mês"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
      </div>
      <div class="cal-grid">
        ${['D','S','T','Q','Q','S','S'].map(x => `<div class="wd">${x}</div>`).join('')}
        ${html}
      </div>
      <div class="row wrap tiny muted" style="margin-top:12px;gap:12px">
        <span class="row" style="gap:5px"><i style="width:5px;height:5px;border-radius:50%;background:var(--gold);display:block"></i>programação</span>
        <span class="row" style="gap:5px"><i style="width:5px;height:5px;border-radius:50%;background:var(--bronze);display:block"></i>gasto</span>
        <span class="row" style="gap:5px"><i style="width:5px;height:5px;border-radius:50%;background:var(--ink-soft);display:block"></i>prazo</span>
      </div>
    </div>`;
  }

  /* ---------- roteiro completo ---------- */
  function roteiro() {
    const s = Store.state;
    const datas = [...new Set(s.agenda.map(i => i.data).filter(Boolean))].sort();
    // inclui todos os dias da viagem, mesmo vazios
    if (s.viagem.dataInicio && s.viagem.dataFim) {
      let d = s.viagem.dataInicio;
      while (d <= s.viagem.dataFim) {
        if (!datas.includes(d)) datas.push(d);
        const dt = new Date(d + 'T12:00'); dt.setDate(dt.getDate() + 1);
        d = dt.toISOString().slice(0, 10);
      }
      datas.sort();
    }
    if (!datas.length) return '<div class="empty">Defina as datas da viagem no Resumo ou adicione um compromisso para montar o roteiro.</div>';

    return datas.map((d, idx) => {
      const ag = doDia(d);
      const t = Gastos.totais(d, d, '');
      const feitos = ag.filter(i => i.status === 'realizado').length;
      return `<section class="block">
        <div class="sec-row">
          <h2 class="sec">Dia ${idx + 1}<span class="count">${UI.extenso(d)}</span></h2>
          <button class="btn quiet sm" data-dia="${d}">abrir</button>
        </div>
        <div class="card tight flat">
          <div class="spread tiny">
            <span class="muted">${ag.length ? `${feitos}/${ag.length} realizados` : 'sem programação'}</span>
            <span>${t.realizado.brl ? `gasto ${UI.brl(t.realizado.brl)}` : '<span class="muted">sem gastos</span>'}</span>
          </div>
        </div>
        ${ag.length ? `<div class="tl">${ag.map(cardCompromisso).join('')}</div>` : ''}
      </section>`;
    }).join('');
  }

  function render() {
    const alt = `<div class="chips">
      <button class="chip tgl" data-modo="mes" aria-pressed="${modo === 'mes'}">Calendário</button>
      <button class="chip tgl" data-modo="roteiro" aria-pressed="${modo === 'roteiro'}">Roteiro dia a dia</button>
    </div>`;
    return alt + (modo === 'mes' ? calendario() + proximos() : roteiro());
  }

  function proximos() {
    const futuros = Store.state.agenda.filter(i => i.data >= UI.hoje() && i.status === 'planejado')
      .sort((a, b) => (a.data + (a.hora || '')) < (b.data + (b.hora || '')) ? -1 : 1).slice(0, 4);
    if (!futuros.length) return '';
    return `<section class="block"><h2 class="sec">A seguir</h2><div class="tl">${futuros.map(i => cardCompromisso(i)
      .replace('<div class="row" style="gap:8px">', `<div class="row" style="gap:8px"><span class="chip">${UI.dm(i.data)}</span>`)).join('')}</div></section>`;
  }

  function bind(root) {
    root.addEventListener('click', async e => {
      if (App.rota !== 'agenda') return;
      const md = e.target.closest('[data-modo]');
      if (md) { modo = md.dataset.modo; UI.haptic(5); App.paint(); return; }
      const nav = e.target.closest('[data-mes]');
      if (nav) {
        const step = Number(nav.dataset.mes);
        let { a, m } = mesAtual();
        m += step; if (m > 12) { m = 1; a++; } if (m < 1) { m = 12; a--; }
        mes = { a, m }; UI.haptic(5); App.paint(); return;
      }
      const d = e.target.closest('[data-dia]');
      if (d) { UI.haptic(); abrirDia(d.dataset.dia); return; }
      const ok = e.target.closest('[data-ok]');
      if (ok) {
        const it = Store.find('agenda', ok.dataset.ok);
        UI.haptic(12);
        Store.upd('agenda', ok.dataset.ok, { status: it.status === 'realizado' ? 'planejado' : 'realizado' });
        return;
      }
      const ag = e.target.closest('[data-ag]');
      if (ag) editar(ag.dataset.ag);
    });
  }

  return { render, bind, novo, editar, abrirDia, titulo: 'Agenda', fab: () => novo() };
})();
