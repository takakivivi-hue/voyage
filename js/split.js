/* Split — motor do rateio e do acerto final.
   Tudo é calculado em centavos de real (inteiros) para que a soma das partes
   feche exatamente com o total: dividir R$ 100 entre 7 pessoas dá 6×14,29 +
   1×14,28, e não sete valores arredondados que sobram ou faltam um centavo.

   Regra do acerto: saldo = o que a pessoa pagou − o que ela consumiu
                            + o que já transferiu − o que já recebeu.
   Saldo positivo = tem a receber. Negativo = tem a pagar. */

const Split = (() => {
  const cent = v => Math.round((Number(v) || 0) * 100);
  const real = c => c / 100;

  /* Reparte `totalC` centavos entre `ids`, jogando a sobra (ou a falta) de
     centavos nos primeiros da lista. Funciona com total negativo também. */
  function distribuir(map, ids, totalC, zerar) {
    if (zerar) ids.forEach(id => map.set(id, 0));
    if (!totalC || !ids.length) return;
    const n = ids.length;
    const base = Math.trunc(totalC / n);
    const resto = totalC - base * n;
    const passo = resto >= 0 ? 1 : -1;
    ids.forEach((id, i) => {
      const v = base + (i < Math.abs(resto) ? passo : 0);
      map.set(id, (map.get(id) || 0) + v);
    });
  }

  /* Quem participa de um gasto, já descartando ids de viajantes apagados. */
  function participantes(g, viajantes) {
    const todos = viajantes.map(v => v.id);
    const d = g.divisao || {};
    if (d.rateio === 'alguns' || d.rateio === 'valores') {
      const brutos = d.rateio === 'valores'
        ? Object.keys(d.valores || {}).filter(id => Number(d.valores[id]) > 0)
        : (d.participantes || []);
      const sel = brutos.filter(id => todos.includes(id));
      return sel.length ? sel : todos;
    }
    return todos;
  }

  /* Quanto cada participante deve daquele gasto, em centavos de real. */
  function partes(g, viajantes) {
    const totalC = cent(UI.conv(g.realizado).brl);
    const out = new Map();
    if (!totalC) return { totalC: 0, out };

    const d = g.divisao || {};
    const ids = participantes(g, viajantes);
    if (!ids.length) return { totalC, out };

    if (d.rateio === 'valores') {
      // a moeda em que os valores individuais foram digitados
      const base = d.base || (g.realizado && g.realizado.base) || 'BRL';
      let soma = 0;
      ids.forEach(id => {
        const c = cent(UI.conv({ base, v: Number((d.valores || {})[id]) || 0 }).brl);
        out.set(id, c); soma += c;
      });
      // o que sobrou (couvert, gorjeta, taxa) entra igual para todos
      distribuir(out, ids, totalC - soma);
    } else {
      distribuir(out, ids, totalC, true);
    }
    return { totalC, out };
  }

  /* Acerto do período: o que cada um pagou, consumiu e o saldo resultante. */
  function calcular({ gastos, viajantes, acertos = [], de = '', ate = '' }) {
    const zero = () => new Map(viajantes.map(v => [v.id, 0]));
    const pagou = zero(), consumiu = zero(), enviado = zero(), recebido = zero();
    const noPeriodo = d => (!de && !ate) || UI.noPeriodo(d, de, ate);

    let totalC = 0, semPagador = 0, semPagadorC = 0, semValor = 0;
    const porGasto = [];

    for (const g of gastos) {
      if (!noPeriodo(g.data)) continue;
      const { totalC: tc, out } = partes(g, viajantes);
      if (!tc) { semValor++; continue; }
      totalC += tc;
      if (g.pagador && pagou.has(g.pagador)) pagou.set(g.pagador, pagou.get(g.pagador) + tc);
      else { semPagador++; semPagadorC += tc; }
      out.forEach((c, id) => consumiu.set(id, (consumiu.get(id) || 0) + c));
      porGasto.push({ gasto: g, totalC: tc, partes: out });
    }

    for (const a of acertos) {
      if (!noPeriodo(a.data)) continue;
      const c = cent(a.valor);
      if (enviado.has(a.de)) enviado.set(a.de, enviado.get(a.de) + c);
      if (recebido.has(a.para)) recebido.set(a.para, recebido.get(a.para) + c);
    }

    const linhas = viajantes.map(v => {
      const p = pagou.get(v.id) || 0, c = consumiu.get(v.id) || 0;
      const e = enviado.get(v.id) || 0, r = recebido.get(v.id) || 0;
      return { ...v, pagouC: p, consumiuC: c, enviadoC: e, recebidoC: r, saldoC: p - c + e - r };
    });

    return {
      linhas, totalC, semPagador, semPagadorC, semValor,
      transferencias: transferir(linhas), porGasto,
      real,
    };
  }

  /* Menor número de transferências: o maior devedor paga o maior credor,
     repetindo até zerar. */
  function transferir(linhas) {
    const dev = linhas.filter(l => l.saldoC < -0).map(l => ({ ...l, v: -l.saldoC })).sort((a, b) => b.v - a.v);
    const cre = linhas.filter(l => l.saldoC > 0).map(l => ({ ...l, v: l.saldoC })).sort((a, b) => b.v - a.v);
    const out = [];
    let i = 0, j = 0;
    while (i < dev.length && j < cre.length) {
      const v = Math.min(dev[i].v, cre[j].v);
      if (v > 0) out.push({
        de: dev[i].id, deNome: dev[i].nome,
        para: cre[j].id, paraNome: cre[j].nome, valorC: v,
      });
      dev[i].v -= v; cre[j].v -= v;
      if (dev[i].v <= 0) i++;
      if (cre[j].v <= 0) j++;
    }
    return out;
  }

  /* Resumo curto da divisão, para o cartão do gasto. */
  function resumoDivisao(g, viajantes) {
    const d = g.divisao || {};
    const ids = participantes(g, viajantes);
    if (d.rateio === 'valores') return `valor por pessoa · ${ids.length}`;
    if (ids.length === viajantes.length) return `dividido entre ${ids.length}`;
    if (ids.length === 1) {
      const v = viajantes.find(x => x.id === ids[0]);
      return `só ${v ? v.nome : '1 pessoa'}`;
    }
    return `dividido entre ${ids.length}`;
  }

  return { calcular, partes, participantes, transferir, resumoDivisao, cent, real };
})();
