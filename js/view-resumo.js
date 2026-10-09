/* Resumo — o cabeçalho da viagem: voos, hotel, transfer, carro + indicadores. */

const ViewResumo = (() => {
  const E = UI.esc;

  const CAMPOS_VOO = pref => ([
    { k: 'data', label: 'Data da viagem', type: 'date', half: true },
    { k: 'destino', label: 'Destino', half: true, ph: 'Cidade / país' },
    { k: 'aeroporto', label: 'Aeroporto', half: true, ph: 'GRU → NRT' },
    { k: 'companhia', label: 'Companhia aérea', half: true },
    { k: 'voo', label: 'Número do voo', half: true, ph: 'JL 8046' },
    { k: 'saida', label: 'Horário de saída', type: 'time', half: true },
    { k: 'conexao', label: 'Conexão', ph: 'Aeroporto, voo e horários' },
    { k: 'chegada', label: 'Horário local de chegada ao destino', ph: 'Ex.: 14:35 (+1 dia)' },
  ]);

  const CAMPOS_HOTEL = [
    { k: 'nome', label: 'Hotel' },
    { k: 'endereco', label: 'Endereço do hotel', type: 'textarea', rows: 2 },
    { k: 'telefone', label: 'Telefone do hotel', type: 'tel', half: true },
    { k: 'reserva', label: 'Número da reserva', half: true },
    { k: 'dataEntrada', label: 'Data de entrada', type: 'date', half: true },
    { k: 'checkin', label: 'Horário check-in', type: 'time', half: true },
    { k: 'dataSaida', label: 'Data de saída', type: 'date', half: true },
    { k: 'checkout', label: 'Horário check-out', type: 'time', half: true },
  ];

  const CAMPOS_TRANSPORTE = [
    { k: 'grupo1', label: 'Transfer', type: 'grupo' },
    { k: 'tEmpresa', label: 'Transfer', ph: 'Empresa ou responsável' },
    { k: 'tTelefone', label: 'Telefone do transfer', type: 'tel' },
    { k: 'tObs', label: 'Observações do transfer', type: 'textarea', rows: 2 },
    { k: 'grupo2', label: 'Aluguel de carro', type: 'grupo' },
    { k: 'cCompanhia', label: 'Companhia do aluguel de carro' },
    { k: 'cReserva', label: 'Número da reserva' },
    { k: 'cRetirada', label: 'Retirada', type: 'date', half: true },
    { k: 'cDevolucao', label: 'Devolução', type: 'date', half: true },
    { k: 'cObs', label: 'Observações do carro', type: 'textarea', rows: 2 },
  ];

  const linha = (k, v) => `<div><span class="k">${E(k)}</span><span class="v${v ? '' : ' vazio'}">${v ? E(v) : 'a preencher'}</span></div>`;

  function cartao({ titulo, icone, linhas, acao, extra }) {
    const preenchidos = linhas.filter(l => l[1]).length;
    return `<div class="card">
      <div class="spread" style="margin-bottom:6px">
        <h2 class="sec">${icone || ''}${E(titulo)}<span class="count">${preenchidos}/${linhas.length}</span></h2>
        <button class="btn quiet sm" data-edit="${acao}">Editar</button>
      </div>
      <div class="dl">${linhas.map(l => linha(l[0], l[1])).join('')}</div>
      ${extra || ''}
    </div>`;
  }

  function render() {
    const s = Store.state, v = s.viagem;
    const faltam = v.dataInicio ? UI.diasEntre(UI.hoje(), v.dataInicio) : null;
    const dur = v.dataInicio && v.dataFim ? UI.diasEntre(v.dataInicio, v.dataFim) : null;

    const feitos = s.checklist.filter(i => i.feito).length;
    const pct = s.checklist.length ? Math.round(feitos / s.checklist.length * 100) : 0;
    const malaFeita = s.mala.filter(i => i.feito).length;
    const pctMala = s.mala.length ? Math.round(malaFeita / s.mala.length * 100) : 0;

    const tot = Gastos.totais('', '', '');
    const orc = Number(v.orcamento) || 0;
    const pctOrc = orc ? Math.min(100, Math.round(tot.realizado.brl / orc * 100)) : 0;

    const hero = `<div class="card" style="padding:18px">
      <div class="spread" style="align-items:flex-start">
        <div class="grow">
          <span class="eyebrow">${v.destinoPrincipal ? E(v.destinoPrincipal) : 'Destino a definir'}</span>
          <div style="font-family:var(--serif);font-size:26px;line-height:1.15;margin-top:4px">${E(v.titulo || 'Minha viagem')}</div>
          <div class="tiny muted" style="margin-top:6px">
            ${v.dataInicio ? `${UI.dmy(v.dataInicio)}${v.dataFim ? ' — ' + UI.dmy(v.dataFim) : ''}` : 'Datas a definir'}
            ${dur != null ? ` · ${dur + 1} dias` : ''}
          </div>
        </div>
        <button class="btn quiet sm" data-edit="viagem">Editar</button>
      </div>
      ${faltam != null && faltam >= 0 ? `<div class="row" style="margin-top:14px">
        <span class="chip gold">${faltam === 0 ? 'É hoje' : `faltam ${faltam} ${faltam === 1 ? 'dia' : 'dias'}`}</span>
        <span class="chip">1 ${E(s.moeda.codigo)} = R$ ${UI.n2(s.moeda.cotacao)}</span>
      </div>` : `<div class="row" style="margin-top:14px"><span class="chip">1 ${E(s.moeda.codigo)} = R$ ${UI.n2(s.moeda.cotacao)}</span></div>`}
    </div>`;

    const indicadores = `<div class="grid-2">
      <div class="card tight">
        <span class="eyebrow">Preparativos</span>
        <div class="money-lg num" style="margin-top:4px">${pct}%</div>
        <div class="tiny muted">${feitos} de ${s.checklist.length} resolvidos</div>
        <div class="bar"><i style="width:${pct}%"></i></div>
      </div>
      <div class="card tight">
        <span class="eyebrow">Mala</span>
        <div class="money-lg num" style="margin-top:4px">${pctMala}%</div>
        <div class="tiny muted">${malaFeita} de ${s.mala.length} itens</div>
        <div class="bar"><i style="width:${pctMala}%"></i></div>
      </div>
      <div class="card tight" style="grid-column:1/-1">
        <div class="spread">
          <div>
            <span class="eyebrow">Gasto realizado</span>
            <div class="money-lg num" style="margin-top:4px">${UI.brl(tot.realizado.brl)}</div>
            <div class="tiny muted">${UI.fx(tot.realizado.fx)} · previsto ${UI.brl(tot.previsto.brl)}</div>
          </div>
          <div class="center" style="flex-shrink:0">
            <span class="eyebrow">${orc ? 'do orçamento' : 'vs previsto'}</span>
            <div class="money-lg num">${orc ? pctOrc + '%' : (tot.previsto.brl ? Math.round(tot.realizado.brl / tot.previsto.brl * 100) + '%' : '—')}</div>
          </div>
        </div>
        ${orc ? `<div class="bar ${pctOrc >= 100 ? 'over' : ''}"><i style="width:${pctOrc}%"></i></div>
          <div class="tiny muted" style="margin-top:5px">Orçamento R$ ${UI.n2(orc)} · ${tot.realizado.brl > orc ? 'excedido em' : 'resta'} R$ ${UI.n2(Math.abs(orc - tot.realizado.brl))}</div>` : ''}
      </div>
    </div>`;

    const ida = cartao({
      titulo: 'Ida', icone: '', acao: 'ida',
      linhas: [
        ['Data', UI.dmy(v.ida.data)], ['Destino', v.ida.destino], ['Aeroporto', v.ida.aeroporto],
        ['Companhia', v.ida.companhia], ['Voo', v.ida.voo], ['Saída', v.ida.saida],
        ['Conexão', v.ida.conexao], ['Chegada local', v.ida.chegada],
      ],
    });

    const hotel = cartao({
      titulo: 'Hospedagem', acao: 'hotel',
      linhas: [
        ['Hotel', v.hotel.nome], ['Endereço', v.hotel.endereco], ['Telefone', v.hotel.telefone],
        ['Reserva', v.hotel.reserva],
        ['Entrada', [UI.dmy(v.hotel.dataEntrada), v.hotel.checkin].filter(Boolean).join(' · ')],
        ['Saída', [UI.dmy(v.hotel.dataSaida), v.hotel.checkout].filter(Boolean).join(' · ')],
      ],
      extra: v.hotel.telefone ? `<div class="row" style="margin-top:12px">
        <a class="btn ghost sm" href="tel:${E(v.hotel.telefone.replace(/\s/g, ''))}">Ligar para o hotel</a>
        ${v.hotel.endereco ? `<a class="btn ghost sm" target="_blank" rel="noopener" href="https://maps.google.com/?q=${encodeURIComponent(v.hotel.endereco)}">Mapa</a>` : ''}
      </div>` : '',
    });

    const transporte = cartao({
      titulo: 'Transfer e carro', acao: 'transporte',
      linhas: [
        ['Transfer', v.transfer.empresa], ['Tel. transfer', v.transfer.telefone],
        ['Locadora', v.carro.companhia], ['Reserva carro', v.carro.reserva],
        ['Retirada', UI.dmy(v.carro.retirada)], ['Devolução', UI.dmy(v.carro.devolucao)],
      ],
    });

    const volta = cartao({
      titulo: 'Retorno', acao: 'volta',
      linhas: [
        ['Data', UI.dmy(v.volta.data)], ['Destino', v.volta.destino], ['Aeroporto', v.volta.aeroporto],
        ['Companhia', v.volta.companhia], ['Voo', v.volta.voo], ['Saída', v.volta.saida],
        ['Conexão', v.volta.conexao], ['Chegada local', v.volta.chegada],
      ],
    });

    const anexos = `<div class="card">
      <div class="spread" style="margin-bottom:8px">
        <h2 class="sec">Documentos da viagem<span class="count">${(v.anexos || []).length}</span></h2>
        <button class="btn quiet sm" data-edit="anexos">Gerenciar</button>
      </div>
      ${(v.anexos || []).length
        ? `<div class="files">${v.anexos.map(id => { const m = Att.info(id) || { nome: 'arquivo' };
            return `<div class="file" data-open="${id}"><svg viewBox="0 0 24 24"><path d="M14 3v5h5M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/></svg>
              <span class="fname">${E(m.nome)}</span><span class="fsize">${UI.kb(m.tamanho)}</span></div>`; }).join('')}</div>`
        : '<div class="empty">Passagens, seguro, vistos — anexe aqui os arquivos gerais da viagem.</div>'}
    </div>`;

    return `${hero}${indicadores}
      <section class="block">${ida}${hotel}${transporte}${volta}</section>
      <section class="block">${anexos}</section>`;
  }

  async function editar(qual) {
    const v = Store.state.viagem;
    if (qual === 'viagem') {
      const r = await UI.form({ title: 'Dados gerais', campos: [
        { k: 'titulo', label: 'Nome da viagem', ph: 'Japão 2026' },
        { k: 'destinoPrincipal', label: 'Destino principal', ph: 'Tóquio, Japão' },
        { k: 'dataInicio', label: 'Início', type: 'date', half: true },
        { k: 'dataFim', label: 'Fim', type: 'date', half: true },
        { k: 'orcamento', label: 'Orçamento total em reais', type: 'number', ph: '0,00', hint: 'Opcional — usado nas barras de progresso.' },
      ], valores: { ...v } });
      if (r) Store.commit(s => Object.assign(s.viagem, {
        titulo: r.titulo, destinoPrincipal: r.destinoPrincipal,
        dataInicio: r.dataInicio, dataFim: r.dataFim, orcamento: r.orcamento,
      }));
      return;
    }
    if (qual === 'ida' || qual === 'volta') {
      const r = await UI.form({ title: qual === 'ida' ? 'Voo de ida' : 'Voo de retorno', campos: CAMPOS_VOO(), valores: { ...v[qual] } });
      if (r) Store.commit(s => Object.assign(s.viagem[qual], r));
      return;
    }
    if (qual === 'hotel') {
      const r = await UI.form({ title: 'Hospedagem', campos: CAMPOS_HOTEL, valores: { ...v.hotel } });
      if (r) Store.commit(s => Object.assign(s.viagem.hotel, r));
      return;
    }
    if (qual === 'transporte') {
      const r = await UI.form({ title: 'Transfer e aluguel de carro', campos: CAMPOS_TRANSPORTE, valores: {
        tEmpresa: v.transfer.empresa, tTelefone: v.transfer.telefone, tObs: v.transfer.obs,
        cCompanhia: v.carro.companhia, cReserva: v.carro.reserva, cRetirada: v.carro.retirada,
        cDevolucao: v.carro.devolucao, cObs: v.carro.obs,
      } });
      if (r) Store.commit(s => {
        Object.assign(s.viagem.transfer, { empresa: r.tEmpresa, telefone: r.tTelefone, obs: r.tObs });
        Object.assign(s.viagem.carro, { companhia: r.cCompanhia, reserva: r.cReserva, retirada: r.cRetirada, devolucao: r.cDevolucao, obs: r.cObs });
      });
      return;
    }
    if (qual === 'anexos') {
      const r = await UI.form({ title: 'Documentos da viagem', sub: 'Vouchers, ingressos, contratos e seguros',
        campos: [{ k: 'anexos', label: 'Arquivos', type: 'files' }], valores: { anexos: v.anexos || [] } });
      if (r) Store.commit(s => { s.viagem.anexos = r.anexos; });
    }
  }

  function bind(root) {
    root.addEventListener('click', e => {
      if (App.rota !== 'resumo') return;
      const b = e.target.closest('[data-edit]');
      if (b) { UI.haptic(); editar(b.dataset.edit); return; }
      const f = e.target.closest('[data-open]');
      if (f) Att.abrir(f.dataset.open);
    });
  }

  return { render, bind, titulo: 'Resumo' };
})();
