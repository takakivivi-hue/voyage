/* Store — estado único da viagem, persistido em localStorage.
   Dinheiro é sempre guardado como {base:'BRL'|'FX', v:number}: a moeda em que
   você digitou é a fonte da verdade e a outra coluna é derivada da cotação.
   Assim, mudar a cotação reconverte tudo que já foi anotado. */

const Store = (() => {
  const KEY = 'viagem.v1';
  let listeners = [];

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const CATEGORIAS = ['Alimentação', 'Hospedagem', 'Passeio', 'Compras', 'Saúde', 'Carro', 'Presentes', 'Transporte', 'Outros'];
  const GRUPOS_CHECK = ['Documentos', 'Transporte', 'Hospedagem', 'Passeios', 'Saúde', 'Financeiro', 'Outros'];
  const GRUPOS_MALA = ['Roupas', 'Acessórios', 'Calçados', 'Remédios', 'Suplementos', 'Receitas médicas', 'Documentos', 'Eletrônicos', 'Higiene'];
  const PAGAMENTOS = ['Cartão de crédito', 'Cartão internacional', 'Dinheiro', 'Pix', 'Débito', 'Outro'];

  const checkSeed = [
    ['Comprar passagem aérea', 'Transporte'],
    ['Reservar hotel', 'Hospedagem'],
    ['Verificar validade do passaporte', 'Documentos'],
    ['Verificar vacinas necessárias', 'Saúde'],
    ['Reservar aluguel de carro', 'Transporte'],
    ['Comprar ingressos dos passeios', 'Passeios'],
    ['Definir quem levará ao aeroporto', 'Transporte'],
    ['Reservar restaurantes', 'Passeios'],
    ['Reservar shows / eventos', 'Passeios'],
    ['Contratar seguro viagem', 'Saúde'],
    ['Comprar moeda / cartão em moeda estrangeira', 'Financeiro'],
    ['Avisar banco e operadora de cartão', 'Financeiro'],
    ['Chip internacional ou eSIM', 'Outros'],
    ['Fazer check-in online', 'Transporte'],
    ['Verificar tomadas e adaptadores', 'Outros'],
  ];

  const malaSeed = [
    ['Roupas', ['Camisetas', 'Calças', 'Roupa de frio', 'Roupa íntima', 'Pijama', 'Roupa de banho']],
    ['Acessórios', ['Óculos de sol', 'Cinto', 'Bolsa / mochila', 'Guarda-chuva']],
    ['Calçados', ['Tênis confortável', 'Sapato social', 'Chinelo']],
    ['Remédios', ['Analgésico', 'Antialérgico', 'Remédio de uso contínuo', 'Curativos']],
    ['Suplementos', ['Vitaminas', 'Proteína / shake']],
    ['Receitas médicas', ['Receita dos remédios de uso contínuo', 'Relatório médico em inglês']],
    ['Documentos', ['Passaporte', 'RG / CNH', 'Carteira de vacinação', 'Seguro viagem impresso']],
    ['Eletrônicos', ['Carregadores', 'Adaptador de tomada', 'Power bank', 'Fones']],
    ['Higiene', ['Escova e pasta de dente', 'Protetor solar', 'Desodorante', 'Hidratante']],
  ];

  function vazio() {
    return {
      versao: 1,
      viagem: {
        titulo: 'Minha viagem',
        destinoPrincipal: '', dataInicio: '', dataFim: '', orcamento: null,
        ida: { data: '', destino: '', aeroporto: '', companhia: '', voo: '', saida: '', conexao: '', chegada: '' },
        volta: { data: '', destino: '', aeroporto: '', companhia: '', voo: '', saida: '', conexao: '', chegada: '' },
        hotel: { nome: '', endereco: '', telefone: '', reserva: '', dataEntrada: '', checkin: '', dataSaida: '', checkout: '' },
        transfer: { empresa: '', telefone: '', obs: '' },
        carro: { companhia: '', reserva: '', retirada: '', devolucao: '', obs: '' },
        anexos: [],
      },
      moeda: { codigo: 'USD', simbolo: 'US$', nome: 'Dólar americano', cotacao: 5.4, atualizadaEm: '' },
      viajantes: [{ id: uid(), nome: 'Eu' }],
      acertos: [],
      categorias: [...CATEGORIAS],
      gruposCheck: [...GRUPOS_CHECK],
      gruposMala: [...GRUPOS_MALA],
      pagamentos: [...PAGAMENTOS],
      checklist: checkSeed.map(([titulo, grupo]) => ({
        id: uid(), titulo, grupo, feito: false, prazo: '', resp: '', obs: '',
        custo: null, anexos: [],
      })),
      mala: malaSeed.flatMap(([grupo, itens]) => itens.map(nome => ({
        id: uid(), nome, grupo, qtd: '', feito: false, obs: '',
      }))),
      agenda: [],
      gastos: [],
    };
  }

  let state = vazio();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) state = migrar(JSON.parse(raw));
    } catch (e) {
      console.warn('Não foi possível ler os dados salvos:', e);
    }
    return state;
  }

  /* Garante que dados salvos por versões anteriores ganhem campos novos. */
  function migrar(s) {
    const base = vazio();
    const out = { ...base, ...s };
    out.viagem = { ...base.viagem, ...(s.viagem || {}) };
    for (const k of ['ida', 'volta', 'hotel', 'transfer', 'carro']) {
      out.viagem[k] = { ...base.viagem[k], ...((s.viagem || {})[k] || {}) };
    }
    out.moeda = { ...base.moeda, ...(s.moeda || {}) };
    for (const k of ['categorias', 'gruposCheck', 'gruposMala', 'pagamentos',
                     'checklist', 'mala', 'agenda', 'gastos', 'viajantes', 'acertos']) {
      if (!Array.isArray(out[k])) out[k] = base[k];
    }
    // gastos anteriores à divisão de despesas ganham os campos novos
    out.gastos = out.gastos.map(g => ({
      pagador: '', ...g,
      divisao: { rateio: 'todos', participantes: [], valores: {}, ...(g.divisao || {}) },
    }));
    return out;
  }

  let pending = null;
  function save() {
    clearTimeout(pending);
    pending = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); }
      catch (e) { console.warn('Falha ao salvar', e); UI && UI.toast('Espaço de armazenamento cheio'); }
    }, 120);
  }

  function emit() { listeners.forEach(fn => fn(state)); }
  function sub(fn) { listeners.push(fn); return () => { listeners = listeners.filter(f => f !== fn); }; }

  /* Toda mutação passa por aqui: salva e notifica a tela. */
  function commit(fn) {
    fn(state);
    save();
    emit();
  }

  /* ---- coleções ---- */
  function add(col, obj) {
    const item = { id: uid(), ...obj };
    commit(s => { s[col].push(item); });
    return item;
  }
  function upd(col, id, patch) {
    commit(s => {
      const i = s[col].findIndex(x => x.id === id);
      if (i >= 0) s[col][i] = { ...s[col][i], ...patch };
    });
  }
  function del(col, id) {
    commit(s => { s[col] = s[col].filter(x => x.id !== id); });
  }
  function find(col, id) { return state[col].find(x => x.id === id); }

  function replace(novo) {
    state = migrar(novo);
    save(); emit();
  }
  function reset() { state = vazio(); save(); emit(); }

  return {
    get state() { return state; },
    load, save, sub, commit, add, upd, del, find, replace, reset, uid, vazio,
    defaults: { CATEGORIAS, GRUPOS_CHECK, GRUPOS_MALA, PAGAMENTOS },
  };
})();
