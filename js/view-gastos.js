/* Gastos — controle financeiro em duas moedas.
   Cada lançamento tem Previsto e Realizado, e cada um guarda a moeda em que foi
   digitado ({base:'BRL'|'FX', v}). A outra coluna é sempre derivada da cotação,
   então trocar a cotação reconverte todo o histórico de uma vez. */

const Gastos = (() => {
  const E = UI.esc;
  let per = { de: '', ate: '', rotulo: 'Toda a viagem' };
  let cat = '';
  let pessoa = '';        // '' | id do viajante | '__sem' (gastos sem pagador)
  let modo = 'realizado'; // ordena/realça por realizado ou previsto

  function periodoAtivo() {
    if (per.de || per.ate) return per;
    const v = Store.state.viagem;
    if (v.dataInicio || v.dataFim) return { de: v.dataInicio, ate: v.dataFim, rotulo: 'Toda a viagem' };
    return { de: '', ate: '', rotulo: 'Tudo' };
  }

  function lista() {
    const p = periodoAtivo();
    return Store.state.gastos
      .filter(g => (!p.de && !p.ate) ? true : UI.noPeriodo(g.data, p.de, p.ate))
      .filter(g => !cat || (g.categoria || 'Outros') === cat)
      .filter(g => !pessoa || (pessoa === '__sem' ? !g.pagador : g.pagador === pessoa))
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  }

  const doDia = d => Store.state.gastos.filter(g => g.data === d);

  /* Soma previsto/realizado em BRL e na moeda estrangeira. */
  function totais(de, ate, categoria) {
    const p = de === undefined ? periodoAtivo() : { de, ate };
    const c = categoria === undefined ? cat : categoria;
    const acc = { previsto: { brl: 0, fx: 0 }, realizado: { brl: 0, fx: 0 }, n: 0 };
    for (const g of Store.state.gastos) {
      if ((p.de || p.ate) && !UI.noPeriodo(g.data, p.de, p.ate)) continue;
      if (c && (g.categoria || 'Outros') !== c) continue;
      const cp = UI.conv(g.previsto), cr = UI.conv(g.realizado);
      acc.previsto.brl += cp.brl; acc.previsto.fx += cp.fx;
      acc.realizado.brl += cr.brl; acc.realizado.fx += cr.fx;
      acc.n++;
    }
    return acc;
  }

  const ehDinheiro = f => /dinheiro|cash|esp[eé]cie/i.test(f || '');

  /* Quanto saiu em dinheiro vivo e quanto foi no cartão/digital. */
  function porForma() {
    const p = periodoAtivo();
    const acc = { dinheiro: 0, cartao: 0, semForma: 0 };
    for (const g of Store.state.gastos) {
      if ((p.de || p.ate) && !UI.noPeriodo(g.data, p.de, p.ate)) continue;
      if (cat && (g.categoria || 'Outros') !== cat) continue;
      const v = UI.conv(g.realizado).brl;
      if (!v) continue;
      if (!g.pagamento) acc.semForma += v;
      else if (ehDinheiro(g.pagamento)) acc.dinheiro += v;
      else acc.cartao += v;
    }
    return acc;
  }

  function porCategoria() {
    const p = periodoAtivo();
    const map = new Map();
    for (const g of Store.state.gastos) {
      if ((p.de || p.ate) && !UI.noPeriodo(g.data, p.de, p.ate)) continue;
      const k = g.categoria || 'Outros';
      const o = map.get(k) || { cat: k, prev: 0, prevFx: 0, real: 0, realFx: 0, n: 0 };
      const cp = UI.conv(g.previsto), cr = UI.conv(g.realizado);
      o.prev += cp.brl; o.prevFx += cp.fx; o.real += cr.brl; o.realFx += cr.fx; o.n++;
      map.set(k, o);
    }
    return [...map.values()].sort((a, b) => (b[modo === 'previsto' ? 'prev' : 'real']) - (a[modo === 'previsto' ? 'prev' : 'real']));
  }

  const campos = (dicas = {}) => ([
    { k: 'descricao', label: 'Descrição', ph: 'Jantar no izakaya', hint: dicas.descricao },
    { k: 'data', label: 'Data', type: 'date', half: true, hint: dicas.data },
    { k: 'categoria', label: 'Grupo', type: 'select', opts: () => Store.state.categorias, vazia: false, half: true },
    { k: 'previsto', label: 'Previsto', type: 'money' },
    { k: 'realizado', label: 'Realizado', type: 'money',
      hint: dicas.realizado || `Digite em reais ou em ${Store.state.moeda.codigo} — a outra coluna é convertida na hora pela cotação 1 ${Store.state.moeda.codigo} = R$ ${UI.n2(Store.state.moeda.cotacao)}.` },
    { k: 'pagamento', label: 'Forma de pagamento', type: 'select', opts: () => Store.state.pagamentos, half: true },
    { k: 'pagador', label: 'Quem pagou', type: 'select', half: true, ph: 'ninguém ainda',
      opts: () => Store.state.viajantes.map(v => ({ v: v.id, t: v.nome })) },
    { k: 'divisao', label: 'Divisão entre os viajantes', type: 'divisao' },
    { k: 'obs', label: 'Anotações', type: 'textarea', rows: 2 },
    { k: 'anexos', label: 'Recibos e comprovantes', type: 'files' },
  ]);

  async function novo(pre = {}, lido = null) {
    const dicas = lido ? {
      descricao: lido.nome ? `Nome lido na nota: "${lido.nome}"` : 'Não consegui ler o nome do estabelecimento.',
      realizado: lido.valor
        ? `Valor lido na nota${lido.linhaValor ? ` na linha "${lido.linhaValor}"` : ''} — confira antes de salvar.`
        : 'Não encontrei o valor total na foto. Digite à mão.',
      data: !lido.data ? 'Não achei a data na foto.'
        : lido.dataAmbigua ? 'Dia/mês ou mês/dia? Confira.'
        : undefined,
    } : {};
    const r = await UI.form({
      title: lido ? 'Confirmar a nota' : 'Novo gasto',
      sub: lido ? resumoLeitura(lido) : undefined,
      campos: campos(dicas),
      valores: {
        data: pre.data || UI.hoje(), categoria: cat || Store.state.categorias[0], anexos: [],
        pagador: pessoa && pessoa !== '__sem' ? pessoa : (Store.state.viajantes[0] || {}).id || '',
        divisao: { rateio: 'todos', participantes: [], valores: {} }, ...pre,
      } });
    if (r && (r.descricao || r.previsto || r.realizado)) Store.add('gastos', { ...r, descricao: r.descricao || r.categoria });
    else if (r) UI.toast('Gasto sem valor — não foi salvo');
  }

  /* ---------- leitura da nota por foto ---------- */
  const resumoLeitura = l => {
    const ps = [];
    ps.push(l.data ? UI.dmy(l.data) : 'sem data');
    ps.push(l.valor ? `${l.base === 'BRL' ? 'R$' : UI.sim()} ${UI.n2(l.valor)}` : 'sem valor');
    if (l.categoria) ps.push(l.categoria);
    return 'Li: ' + ps.join(' · ') + (l.dataAmbigua ? ' — data ambígua, confira' : ' — confira tudo');
  };

  function sheetProgresso() {
    const sh = UI.sheet({
      title: 'Lendo a nota',
      body: `<div style="padding:4px 0 18px">
        <div class="tiny muted" data-txt>preparando o leitor</div>
        <div class="bar" style="margin-top:12px"><i data-bar style="width:4%"></i></div>
        <div class="fhint" style="margin-top:16px">A leitura acontece dentro do seu celular — a foto não vai para lugar nenhum.
        Na primeira vez o motor de leitura é baixado (cerca de 9 MB) e demora mais; depois disso funciona offline.</div>
      </div>`,
    });
    const txt = sh.body.querySelector('[data-txt]'), bar = sh.body.querySelector('[data-bar]');
    return {
      close: sh.close,
      atualizar: (etapa, p) => {
        txt.textContent = etapa;
        bar.style.width = Math.max(4, Math.round((p || 0) * 100)) + '%';
      },
    };
  }

  function lerNota() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.capture = 'environment';
    inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.onchange = async () => {
      const f = inp.files && inp.files[0];
      inp.remove();
      if (!f) return;

      let anexo = null;
      try { anexo = await Att.registrar(f); } catch (e) { /* segue sem anexo */ }

      const sh = sheetProgresso();
      let lido = null;
      try {
        lido = await Ocr.ler(f, sh.atualizar);
      } catch (e) {
        console.warn('OCR falhou:', e);
        UI.toast('Não consegui ler a nota — preencha à mão');
      }
      sh.close();

      const pre = { anexos: anexo ? [anexo.id] : [] };
      if (lido) {
        if (lido.data) pre.data = lido.data;
        if (lido.valor) pre.realizado = { base: lido.base, v: lido.valor };
        if (lido.categoria) pre.categoria = lido.categoria;
        if (lido.nome) pre.descricao = lido.nome;
      }
      await novo(pre, lido);
    };
    inp.click();
  }

  async function editar(id) {
    const g = Store.find('gastos', id);
    if (!g) return;
    const r = await UI.form({ title: 'Gasto', campos: campos(), valores: { ...g }, onDelete: () => Store.del('gastos', id) });
    if (r) Store.upd('gastos', id, r);
  }

  function cardHTML(g) {
    const idxPag = Store.state.viajantes.findIndex(v => v.id === g.pagador);
    const pag = idxPag >= 0 ? Store.state.viajantes[idxPag] : null;
    const cp = UI.conv(g.previsto), cr = UI.conv(g.realizado);
    const dif = cr.brl - cp.brl;
    return `<div class="card exp" data-gasto="${g.id}" style="margin-top:8px">
      <div class="exp-top">
        <div class="grow">
          <div style="font-weight:500">${E(g.descricao || '—')}</div>
          <div class="it-meta">
            <span class="chip">${E(g.categoria || 'Outros')}</span>
            <span class="chip">${UI.dmy(g.data)}</span>
            ${g.pagamento ? `<span class="chip">${E(g.pagamento)}</span>` : ''}
            ${pag ? `<span class="chip gold">${UI.av(pag.nome, idxPag)}pagou ${E(pag.nome)}</span>`
                  : (Store.state.viajantes.length > 1 ? '<span class="chip pend">sem pagador</span>' : '')}
            ${Store.state.viajantes.length > 1 ? `<span class="chip">${E(Split.resumoDivisao(g, Store.state.viajantes))}</span>` : ''}
            ${UI.badgeAnexos(g.anexos)}
          </div>
        </div>
        ${!cp.vazio && !cr.vazio && Math.abs(dif) > 0.004
          ? `<span class="chip ${dif > 0 ? 'pend' : 'ok'}">${dif > 0 ? '+' : '−'}R$ ${UI.n2(Math.abs(dif))}</span>` : ''}
      </div>
      <div class="exp-cols">
        <div class="exp-col"><span class="lbl">Previsto</span>
          <b>${cp.vazio ? '<span class="muted">—</span>' : UI.brl(cp.brl)}</b>
          ${cp.vazio ? '' : `<span class="fx">${UI.fx(cp.fx)}</span>`}</div>
        <div class="exp-col real"><span class="lbl">Realizado</span>
          <b>${cr.vazio ? '<span class="muted">—</span>' : UI.brl(cr.brl)}</b>
          ${cr.vazio ? '' : `<span class="fx">${UI.fx(cr.fx)}</span>`}</div>
      </div>
      ${g.obs ? `<div class="it-note">${E(g.obs)}</div>` : ''}
    </div>`;
  }

  /* Troca de cotação: tudo é recalculado porque os valores guardam a moeda de origem. */
  async function editarCotacao() {
    const m = Store.state.moeda;
    const r = await UI.form({
      title: 'Cotação usada', sub: 'Você define o valor; o app reconverte tudo',
      campos: [
        { k: 'codigo', label: 'Moeda do destino', half: true, ph: 'USD' },
        { k: 'simbolo', label: 'Símbolo', half: true, ph: 'US$' },
        { k: 'nome', label: 'Nome da moeda', ph: 'Dólar americano' },
        { k: 'cotacao', label: 'Quantos reais vale 1 unidade', type: 'number', ph: '5,40',
          hint: 'Ao salvar, todos os gastos já anotados e os próximos passam a usar esta cotação.' },
      ],
      valores: { ...m },
    });
    if (!r) return;
    Store.commit(s => {
      s.moeda = { codigo: (r.codigo || 'USD').toUpperCase(), simbolo: r.simbolo || r.codigo || '$',
                  nome: r.nome || '', cotacao: r.cotacao || 0, atualizadaEm: new Date().toISOString() };
    });
    UI.toast('Cotação atualizada — valores reconvertidos');
  }

  async function escolherPeriodo() {
    const v = Store.state.viagem;
    const r = await UI.form({
      title: 'Período', sub: 'Para ver quanto foi gasto no intervalo',
      campos: [
        { k: 'de', label: 'De', type: 'date', half: true },
        { k: 'ate', label: 'Até', type: 'date', half: true },
        { k: 'hint', label: v.dataInicio ? `Viagem: ${UI.dmy(v.dataInicio)} — ${UI.dmy(v.dataFim)}` : 'Datas da viagem não definidas', type: 'grupo' },
      ],
      valores: { de: per.de, ate: per.ate }, ok: 'Aplicar',
    });
    if (r) { per = { de: r.de, ate: r.ate, rotulo: r.de || r.ate ? `${UI.dmy(r.de) || '…'} — ${UI.dmy(r.ate) || '…'}` : 'Tudo' }; App.paint(); }
  }

  function render() {
    const s = Store.state, p = periodoAtivo();
    const t = totais();
    const dif = t.realizado.brl - t.previsto.brl;
    const cats = porCategoria();
    const maxV = Math.max(...cats.map(c => Math.max(c.prev, c.real)), 1);
    const gs = lista();

    const forma = porForma();
    const vs = s.viajantes;
    const filtroPessoas = vs.length > 1 ? `<div class="chips scroll" style="margin-top:10px">
        <button class="chip tgl" data-fp="" aria-pressed="${!pessoa}">Todos</button>
        ${vs.map((v, i) => `<button class="chip tgl" data-fp="${v.id}" aria-pressed="${pessoa === v.id}">${UI.av(v.nome, i)}${E(v.nome)}</button>`).join('')}
        <button class="chip tgl" data-fp="__sem" aria-pressed="${pessoa === '__sem'}">Sem pagador</button>
      </div>` : '';

    const cotacao = `<div class="card tight">
      <div class="spread">
        <div>
          <span class="eyebrow">Cotação em uso</span>
          <div class="money-lg num" style="margin-top:2px">1 ${E(s.moeda.codigo)} = R$ ${UI.n2(s.moeda.cotacao)}</div>
          <div class="tiny muted">${s.moeda.nome ? E(s.moeda.nome) + ' · ' : ''}${s.moeda.atualizadaEm ? 'definida em ' + UI.dmy(s.moeda.atualizadaEm.slice(0, 10)) : 'valor padrão'}</div>
        </div>
        <button class="btn gold sm" data-cot>Alterar</button>
      </div>
    </div>`;

    const periodo = `<div class="card tight">
      <div class="spread">
        <div><span class="eyebrow">Período</span><div style="font-weight:500;margin-top:2px">${E(p.rotulo || `${UI.dmy(p.de)} — ${UI.dmy(p.ate)}`)}</div>
          <div class="tiny muted">${t.n} lançamento${t.n === 1 ? '' : 's'}${cat ? ' · ' + E(cat) : ''}</div></div>
        <button class="btn ghost sm" data-per>Escolher</button>
      </div>
      ${filtroPessoas}
      <div class="chips scroll" style="margin-top:10px">
        <button class="chip tgl" data-pq="viagem" aria-pressed="${!per.de && !per.ate}">Toda a viagem</button>
        <button class="chip tgl" data-pq="hoje">Hoje</button>
        <button class="chip tgl" data-pq="7">Últimos 7 dias</button>
        <button class="chip tgl" data-pq="mes">Este mês</button>
        <button class="chip tgl" data-pq="tudo">Tudo</button>
      </div>
    </div>`;

    const resumo = `<div class="card">
      <span class="eyebrow">Gasto realizado${cat ? ' · ' + E(cat) : ''}${pessoa && pessoa !== '__sem' ? ' · pago por ' + E((vs.find(v => v.id === pessoa) || {}).nome || '') : ''}</span>
      <div class="money-xl num" style="margin-top:4px">${UI.brl(t.realizado.brl)}</div>
      <div class="fx" style="font-size:14px">${UI.fx(t.realizado.fx)}</div>
      <div class="hr"></div>
      <div class="grid-2">
        <div><span class="eyebrow">Previsto</span>
          <div class="money-lg num">${UI.brl(t.previsto.brl)}</div><div class="fx">${UI.fx(t.previsto.fx)}</div></div>
        <div><span class="eyebrow">${Math.abs(dif) < 0.005 ? 'Diferença' : dif > 0 ? 'Acima do previsto' : 'Abaixo do previsto'}</span>
          <div class="money-lg num" style="color:${Math.abs(dif) < 0.005 ? 'inherit' : dif > 0 ? 'var(--danger)' : 'var(--ok)'}">${Math.abs(dif) < 0.005 ? 'R$ 0,00' : (dif > 0 ? '+' : '−') + 'R$ ' + UI.n2(Math.abs(dif))}</div>
          <div class="fx">${t.previsto.brl ? Math.round(t.realizado.brl / t.previsto.brl * 100) + '% do previsto' : '—'}</div></div>
      </div>
      ${t.previsto.brl ? `<div class="bar dual ${t.realizado.brl > t.previsto.brl ? 'over' : ''}">
        <span class="p" style="width:100%"></span>
        <span class="r" style="width:${Math.min(100, t.realizado.brl / t.previsto.brl * 100)}%"></span></div>` : ''}
      ${forma.dinheiro || forma.cartao ? `<div class="hr"></div>
        <div class="row wrap tiny" style="gap:8px">
          <span class="chip">dinheiro R$ ${UI.n2(forma.dinheiro)}</span>
          <span class="chip">cartão e digital R$ ${UI.n2(forma.cartao)}</span>
          ${forma.semForma ? `<span class="chip pend">sem forma R$ ${UI.n2(forma.semForma)}</span>` : ''}
        </div>` : ''}
    </div>`;

    const grupos = `<section class="block">
      <div class="sec-row">
        <h2 class="sec">Por grupo</h2>
        <div class="chips">
          <button class="chip tgl" data-modo="realizado" aria-pressed="${modo === 'realizado'}">Realizado</button>
          <button class="chip tgl" data-modo="previsto" aria-pressed="${modo === 'previsto'}">Previsto</button>
        </div>
      </div>
      ${cats.length ? `<div class="card">${cats.map(c => {
        const val = modo === 'previsto' ? c.prev : c.real;
        const valFx = modo === 'previsto' ? c.prevFx : c.realFx;
        const estouro = c.prev > 0 && c.real > c.prev;
        return `<div data-cat="${E(c.cat)}" style="padding:11px 0;border-bottom:1px solid var(--hair-2);cursor:pointer">
          <div class="spread">
            <span style="font-weight:500">${E(c.cat)}${cat === c.cat ? ' <span class="chip gold">filtrando</span>' : ''}</span>
            <span class="nowrap"><b class="num">${UI.brl(val)}</b> <span class="fx">· ${UI.fx(valFx)}</span></span>
          </div>
          <div class="bar dual ${estouro ? 'over' : ''}">
            <span class="p" style="width:${c.prev / maxV * 100}%"></span>
            <span class="r" style="width:${c.real / maxV * 100}%"></span>
          </div>
          <div class="tiny muted" style="margin-top:4px">previsto R$ ${UI.n2(c.prev)} · realizado R$ ${UI.n2(c.real)} · ${c.n} lançamento${c.n === 1 ? '' : 's'}</div>
        </div>`;
      }).join('')}
      ${cat ? '<div style="padding-top:12px"><button class="btn quiet sm" data-cat="">Limpar filtro de grupo</button></div>' : ''}
      </div>` : '<div class="empty">Nenhum gasto no período.</div>'}
    </section>`;

    // lançamentos agrupados por dia
    const porDia = {};
    gs.forEach(g => { (porDia[g.data || 'sem data'] = porDia[g.data || 'sem data'] || []).push(g); });
    const listaHTML = Object.keys(porDia).sort((a, b) => b.localeCompare(a)).map(d => {
      const soma = porDia[d].reduce((a, g) => a + UI.conv(g.realizado).brl, 0);
      return `<div class="sec-row" style="margin-top:18px">
          <h2 class="sec" style="font-size:16px">${d === 'sem data' ? 'Sem data' : UI.extenso(d)}</h2>
          <span class="chip gold">${UI.n2(soma)} BRL</span>
        </div>${porDia[d].map(cardHTML).join('')}`;
    }).join('');

    return `${cotacao}${periodo}${resumo}${grupos}
      <section class="block"><h2 class="sec">Lançamentos<span class="count">${gs.length}</span></h2>
      ${gs.length ? listaHTML : '<div class="empty">Toque no + para anotar o primeiro gasto.</div>'}</section>`;
  }

  function atalho(q) {
    const hoje = UI.hoje();
    if (q === 'viagem') per = { de: '', ate: '', rotulo: 'Toda a viagem' };
    if (q === 'tudo') per = { de: '1900-01-01', ate: '2999-12-31', rotulo: 'Tudo' };
    if (q === 'hoje') per = { de: hoje, ate: hoje, rotulo: 'Hoje' };
    if (q === '7') { const d = new Date(); d.setDate(d.getDate() - 6); per = { de: d.toISOString().slice(0, 10), ate: hoje, rotulo: 'Últimos 7 dias' }; }
    if (q === 'mes') per = { de: hoje.slice(0, 8) + '01', ate: hoje.slice(0, 8) + '31', rotulo: 'Este mês' };
    App.paint();
  }

  function bind(root) {
    root.addEventListener('click', e => {
      if (App.rota !== 'gastos') return;
      if (e.target.closest('[data-cot]')) { editarCotacao(); return; }
      if (e.target.closest('[data-per]')) { escolherPeriodo(); return; }
      const pq = e.target.closest('[data-pq]');
      if (pq) { UI.haptic(5); atalho(pq.dataset.pq); return; }
      const fp = e.target.closest('[data-fp]');
      if (fp) { pessoa = fp.dataset.fp; UI.haptic(5); App.paint(); return; }
      const md = e.target.closest('[data-modo]');
      if (md) { modo = md.dataset.modo; UI.haptic(5); App.paint(); return; }
      const c = e.target.closest('[data-cat]');
      if (c) { cat = cat === c.dataset.cat ? '' : c.dataset.cat; UI.haptic(5); App.paint(); return; }
      const g = e.target.closest('[data-gasto]');
      if (g) editar(g.dataset.gasto);
    });
  }

  function filtrarSemPagador() { pessoa = '__sem'; cat = ''; per = { de: '', ate: '', rotulo: 'Toda a viagem' }; App.paint(); }

  return { render, bind, novo, editar, totais, doDia, cardHTML, editarCotacao, filtrarSemPagador, lerNota,
           titulo: 'Gastos', fab: () => novo(), fab2: () => lerNota() };
})();
