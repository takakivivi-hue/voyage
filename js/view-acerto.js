/* Acerto — quem pagou quanto, quem consumiu quanto e quem paga quem no fim.
   O período é escolhido aqui mesmo: o dia de hoje, um dia específico ou a
   viagem inteira. Tudo acertado em reais, que é a moeda de todo mundo. */

const ViewAcerto = (() => {
  const E = UI.esc;
  const R = c => UI.n2(c / 100);
  let per = { de: '', ate: '', rotulo: 'Toda a viagem' };

  function periodo() {
    if (per.de || per.ate) return per;
    const v = Store.state.viagem;
    if (v.dataInicio || v.dataFim) return { de: v.dataInicio, ate: v.dataFim, rotulo: 'Toda a viagem' };
    return { de: '', ate: '', rotulo: 'Tudo' };
  }

  const calcular = () => {
    const p = periodo(), s = Store.state;
    return Split.calcular({ gastos: s.gastos, viajantes: s.viajantes, acertos: s.acertos, de: p.de, ate: p.ate });
  };

  /* ---------- cadastro de viajantes ---------- */
  async function novoViajante() {
    const nome = await UI.prompt({ title: 'Novo viajante', label: 'Nome', ph: 'Ana' });
    if (nome) Store.add('viajantes', { nome });
  }

  async function editarViajante(id) {
    const v = Store.find('viajantes', id);
    if (!v) return;
    const r = await UI.form({
      title: 'Viajante', campos: [{ k: 'nome', label: 'Nome' }], valores: { nome: v.nome },
      onDelete: async () => {
        const pagos = Store.state.gastos.filter(g => g.pagador === id).length;
        if (pagos) UI.toast(`${pagos} gasto(s) ficaram sem pagador`);
        Store.commit(s => {
          s.viajantes = s.viajantes.filter(x => x.id !== id);
          s.gastos.forEach(g => {
            if (g.pagador === id) g.pagador = '';
            if (g.divisao) {
              g.divisao.participantes = (g.divisao.participantes || []).filter(x => x !== id);
              if (g.divisao.valores) delete g.divisao.valores[id];
            }
          });
          s.acertos = s.acertos.filter(a => a.de !== id && a.para !== id);
        });
      },
    });
    if (r && r.nome) Store.upd('viajantes', id, { nome: r.nome });
  }

  /* ---------- registrar um acerto já feito ---------- */
  async function registrarAcerto(pre = {}) {
    const ps = Store.state.viajantes;
    if (ps.length < 2) return UI.toast('Cadastre pelo menos dois viajantes');
    const opts = ps.map(p => ({ v: p.id, t: p.nome }));
    const r = await UI.form({
      title: 'Registrar pagamento', sub: 'Quando alguém já acertou a parte dele',
      campos: [
        { k: 'de', label: 'Quem pagou', type: 'select', opts, vazia: false, half: true },
        { k: 'para', label: 'Quem recebeu', type: 'select', opts, vazia: false, half: true },
        { k: 'valor', label: 'Valor em reais', type: 'number', ph: '0,00' },
        { k: 'data', label: 'Data', type: 'date' },
        { k: 'obs', label: 'Observação', ph: 'Pix, dinheiro…' },
      ],
      valores: { data: UI.hoje(), de: ps[0].id, para: ps[1].id, ...pre },
    });
    if (!r || !r.valor) return;
    if (r.de === r.para) return UI.toast('Escolha duas pessoas diferentes');
    Store.add('acertos', r);
    UI.toast('Acerto registrado');
  }

  /* ---------- resumo em texto para mandar no grupo ---------- */
  /* Sem alinhamento por espaços: o WhatsApp quebra a linha onde quiser e
     colunas viram bagunça. Uma informação por linha resolve. */
  function texto() {
    const s = Store.state, p = periodo(), res = calcular();
    const L = [];

    L.push(`ACERTO — ${s.viagem.titulo || 'Viagem'}`);
    const n = s.viajantes.length;
    L.push(`${p.rotulo || `${UI.dmy(p.de)} a ${UI.dmy(p.ate)}`} · total R$ ${R(res.totalC)} entre ${n} ${n === 1 ? 'pessoa' : 'pessoas'}`);

    L.push('');
    L.push('SALDO DE CADA UM');
    res.linhas.forEach(l => {
      const quite = Math.abs(l.saldoC) < 1;
      L.push(`• ${l.nome}: ${quite ? 'está quite' : `${l.saldoC > 0 ? 'tem a receber' : 'tem a pagar'} R$ ${R(Math.abs(l.saldoC))}`}`);
      L.push(`  (pagou R$ ${R(l.pagouC)}, devia R$ ${R(l.consumiuC)})`);
    });

    L.push('');
    if (res.transferencias.length) {
      L.push('PARA ACERTAR');
      res.transferencias.forEach((x, i) => L.push(`${i + 1}. ${x.deNome} paga R$ ${R(x.valorC)} para ${x.paraNome}`));
    } else {
      L.push('Ninguém deve nada — as contas estão equilibradas.');
    }

    if (res.semPagador) {
      L.push('');
      L.push(`Atenção: ${res.semPagador} gasto${res.semPagador === 1 ? '' : 's'} sem pagador definido (R$ ${R(res.semPagadorC)}) ficaram de fora desta conta.`);
    }

    L.push('');
    L.push(`Gerado em ${UI.dmy(UI.hoje())}.`);
    return L.join('\n');
  }

  function compartilhar() {
    if (!Store.state.viajantes.length) return UI.toast('Cadastre os viajantes primeiro');
    const res = calcular();
    if (!res.totalC) return UI.toast('Nenhum gasto no período escolhido');
    UI.enviarTexto({
      title: 'Resumo do acerto',
      sub: UI.podeCompartilhar() ? 'Confira e envie para o grupo' : 'Copie e cole no grupo',
      texto: texto(),
      nomeBotao: 'Enviar para o grupo',
    });
  }

  /* ---------- detalhe de um viajante ---------- */
  function abrirViajante(id) {
    const s = Store.state, p = periodo();
    const res = calcular();
    const linha = res.linhas.find(l => l.id === id);
    if (!linha) return;
    const i = s.viajantes.findIndex(v => v.id === id);

    const pagos = res.porGasto.filter(x => x.gasto.pagador === id);
    const consumidos = res.porGasto.filter(x => (x.partes.get(id) || 0) > 0);
    const acertos = s.acertos.filter(a => (a.de === id || a.para === id) && ((!p.de && !p.ate) || UI.noPeriodo(a.data, p.de, p.ate)));

    const body = `
      <div class="card">
        <div class="grid-2">
          <div><span class="eyebrow">Pagou</span><div class="money-lg num">R$ ${R(linha.pagouC)}</div></div>
          <div><span class="eyebrow">Deveria ter pago</span><div class="money-lg num">R$ ${R(linha.consumiuC)}</div></div>
        </div>
        <div class="hr"></div>
        <span class="eyebrow">${linha.saldoC >= 0 ? 'Tem a receber' : 'Tem a pagar'}</span>
        <div class="money-xl num" style="color:${linha.saldoC >= 0 ? 'var(--ok)' : 'var(--bronze)'}">R$ ${R(Math.abs(linha.saldoC))}</div>
        ${linha.enviadoC || linha.recebidoC ? `<div class="tiny muted" style="margin-top:6px">
          já transferiu R$ ${R(linha.enviadoC)} · já recebeu R$ ${R(linha.recebidoC)}</div>` : ''}
      </div>

      <div class="sec-row" style="margin-top:20px"><h2 class="sec">Pagou<span class="count">${pagos.length}</span></h2></div>
      ${pagos.length ? pagos.map(x => `<div class="card tight" style="margin-top:8px">
          <div class="spread"><span class="grow">${E(x.gasto.descricao || '—')}</span>
          <b class="num nowrap">R$ ${R(x.totalC)}</b></div>
          <div class="tiny muted">${UI.dmy(x.gasto.data)} · ${E(x.gasto.categoria || '')} · ${E(Split.resumoDivisao(x.gasto, s.viajantes))}</div>
        </div>`).join('') : '<div class="empty">Não pagou nada no período.</div>'}

      <div class="sec-row" style="margin-top:20px"><h2 class="sec">Consumiu<span class="count">${consumidos.length}</span></h2></div>
      ${consumidos.length ? consumidos.map(x => `<div class="card tight" style="margin-top:8px">
          <div class="spread"><span class="grow">${E(x.gasto.descricao || '—')}</span>
          <b class="num nowrap">R$ ${R(x.partes.get(id))}</b></div>
          <div class="tiny muted">${UI.dmy(x.gasto.data)} · parte de R$ ${R(x.totalC)}</div>
        </div>`).join('') : '<div class="empty">Nada no período.</div>'}

      ${acertos.length ? `<div class="sec-row" style="margin-top:20px"><h2 class="sec">Acertos<span class="count">${acertos.length}</span></h2></div>
        ${acertos.map(a => {
          const outro = s.viajantes.find(v => v.id === (a.de === id ? a.para : a.de));
          return `<div class="card tight" style="margin-top:8px"><div class="spread">
            <span>${a.de === id ? 'pagou para' : 'recebeu de'} ${E(outro ? outro.nome : '—')}</span>
            <b class="num">R$ ${UI.n2(a.valor)}</b></div>
            <div class="tiny muted">${UI.dmy(a.data)}${a.obs ? ' · ' + E(a.obs) : ''}</div></div>`;
        }).join('')}` : ''}
    `;
    UI.sheet({ title: linha.nome, sub: p.rotulo, body });
  }

  /* ---------- tela ---------- */
  function render() {
    const s = Store.state, p = periodo();

    if (!s.viajantes.length) {
      return `<div class="card center" style="padding:28px 18px">
        <div style="font-family:var(--serif);font-size:19px">Quem está viajando?</div>
        <div class="tiny muted" style="margin:8px 0 16px">Cadastre as pessoas do grupo para o app dividir os gastos e calcular o acerto.</div>
        <button class="btn gold" data-novo-p>Adicionar viajante</button></div>`;
    }

    const res = calcular();
    const n = s.viajantes.length;
    const media = n ? res.totalC / n : 0;

    const topo = `<div class="card tight">
      <div class="spread">
        <div><span class="eyebrow">Período</span><div style="font-weight:500;margin-top:2px">${E(p.rotulo || `${UI.dmy(p.de)} — ${UI.dmy(p.ate)}`)}</div></div>
        <button class="btn ghost sm" data-per>Escolher</button>
      </div>
      <div class="chips scroll" style="margin-top:10px">
        <button class="chip tgl" data-pq="viagem" aria-pressed="${!per.de && !per.ate}">Toda a viagem</button>
        <button class="chip tgl" data-pq="hoje" aria-pressed="${per.rotulo === 'Hoje'}">Hoje</button>
        <button class="chip tgl" data-pq="ontem" aria-pressed="${per.rotulo === 'Ontem'}">Ontem</button>
        <button class="chip tgl" data-pq="tudo" aria-pressed="${per.rotulo === 'Tudo'}">Tudo</button>
      </div>
    </div>`;

    const resumo = `<div class="card">
      <span class="eyebrow">Total do período</span>
      <div class="money-xl num" style="margin-top:4px">R$ ${R(res.totalC)}</div>
      <div class="tiny muted">${n} viajantes · média de R$ ${R(media)} por pessoa</div>
      ${res.semPagador ? `<div class="aviso" style="margin-top:12px">
        <b>${res.semPagador} gasto${res.semPagador === 1 ? '' : 's'} sem pagador</b> — R$ ${R(res.semPagadorC)} que não entram na conta de quem deve a quem.
        <button class="btn quiet sm" data-corrigir style="margin-top:8px">Ver e corrigir</button></div>` : ''}
    </div>`;

    const pessoas = `<section class="block">
      <div class="sec-row"><h2 class="sec">Por viajante</h2><button class="btn quiet sm" data-novo-p>+ viajante</button></div>
      <div class="card">
        ${res.linhas.map((l, i) => {
          const maior = Math.max(...res.linhas.map(x => Math.max(x.pagouC, x.consumiuC)), 1);
          const credor = l.saldoC > 0;
          return `<div class="pessoa-row" data-pessoa="${l.id}">
            <div class="spread">
              <span class="row grow" style="gap:9px;min-width:0">${UI.av(l.nome, i)}<b style="font-weight:500">${E(l.nome)}</b></span>
              <span class="nowrap num" style="font-weight:600;color:${Math.abs(l.saldoC) < 1 ? 'var(--ink-mute)' : credor ? 'var(--ok)' : 'var(--bronze)'}">
                ${Math.abs(l.saldoC) < 1 ? 'quite' : (credor ? 'recebe ' : 'paga ') + 'R$ ' + R(Math.abs(l.saldoC))}</span>
            </div>
            <div class="barra-pagou" style="margin-top:8px">
              <span class="pago" style="width:${Math.min(100, l.pagouC / maior * 100)}%"></span>
              <i class="marca" style="left:${Math.min(100, l.consumiuC / maior * 100)}%" title="deveria ter pago"></i>
            </div>
            <div class="tiny muted" style="margin-top:6px">pagou R$ ${R(l.pagouC)} · deveria ter pago R$ ${R(l.consumiuC)}</div>
          </div>`;
        }).join('')}
      </div>
    </section>`;

    const t = res.transferencias;
    const acerto = `<section class="block">
      <div class="sec-row"><h2 class="sec">Como acertar<span class="count">${t.length ? t.length + ' transferência' + (t.length === 1 ? '' : 's') : ''}</span></h2></div>
      ${t.length ? `<div class="card">${t.map(x => `
        <div class="transfer" data-pagar='${E(JSON.stringify({ de: x.de, para: x.para, valor: x.valorC / 100 }))}'>
          <div class="row grow" style="gap:8px;min-width:0">
            <span class="nome">${E(x.deNome)}</span>
            <svg viewBox="0 0 24 24" class="seta"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            <span class="nome">${E(x.paraNome)}</span>
          </div>
          <b class="num nowrap">R$ ${R(x.valorC)}</b>
        </div>`).join('')}
        <div class="tiny muted" style="margin-top:10px">Toque numa linha para registrar que o pagamento foi feito.</div>
      </div>` : `<div class="card center" style="padding:22px">
        <div style="font-family:var(--serif);font-size:17px">Ninguém deve nada</div>
        <div class="tiny muted" style="margin-top:4px">As contas do período estão equilibradas.</div></div>`}
      <div class="row wrap" style="margin-top:12px;gap:8px">
        <button class="btn gold sm" data-compartilhar>
          <svg viewBox="0 0 24 24"><path d="M12 16V4M8 7.5L12 3.5l4 4"/><path d="M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14"/></svg>
          Compartilhar resumo</button>
        <button class="btn ghost sm" data-acerto>Registrar pagamento</button>
      </div>
    </section>`;

    return topo + resumo + pessoas + acerto;
  }

  async function escolherPeriodo() {
    const r = await UI.form({
      title: 'Período do acerto',
      campos: [{ k: 'de', label: 'De', type: 'date', half: true }, { k: 'ate', label: 'Até', type: 'date', half: true }],
      valores: { de: per.de, ate: per.ate }, ok: 'Aplicar',
    });
    if (r) {
      per = r.de || r.ate
        ? { de: r.de, ate: r.ate, rotulo: r.de === r.ate ? UI.dmy(r.de) : `${UI.dmy(r.de) || '…'} — ${UI.dmy(r.ate) || '…'}` }
        : { de: '', ate: '', rotulo: 'Toda a viagem' };
      App.paint();
    }
  }

  function atalho(q) {
    const hoje = UI.hoje();
    if (q === 'viagem') per = { de: '', ate: '', rotulo: 'Toda a viagem' };
    if (q === 'tudo') per = { de: '1900-01-01', ate: '2999-12-31', rotulo: 'Tudo' };
    if (q === 'hoje') per = { de: hoje, ate: hoje, rotulo: 'Hoje' };
    if (q === 'ontem') { const d = new Date(); d.setDate(d.getDate() - 1); const i = d.toISOString().slice(0, 10); per = { de: i, ate: i, rotulo: 'Ontem' }; }
    App.paint();
  }

  function bind(root) {
    root.addEventListener('click', async e => {
      if (App.rota !== 'acerto') return;
      if (e.target.closest('[data-novo-p]')) return novoViajante();
      if (e.target.closest('[data-per]')) return escolherPeriodo();
      if (e.target.closest('[data-compartilhar]')) { UI.haptic(); return compartilhar(); }
      if (e.target.closest('[data-acerto]')) return registrarAcerto();
      if (e.target.closest('[data-corrigir]')) { location.hash = '#/gastos'; Gastos.filtrarSemPagador(); return; }
      const pq = e.target.closest('[data-pq]');
      if (pq) { UI.haptic(5); return atalho(pq.dataset.pq); }
      const tr = e.target.closest('[data-pagar]');
      if (tr) { UI.haptic(); return registrarAcerto(JSON.parse(tr.dataset.pagar)); }
      const pe = e.target.closest('[data-pessoa]');
      if (pe) { UI.haptic(); return abrirViajante(pe.dataset.pessoa); }
    });
  }

  return { render, bind, titulo: 'Acerto', fab: () => novoViajante(),
           editarViajante, novoViajante, compartilhar, texto };
})();
