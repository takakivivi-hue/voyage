/* Anexos (vouchers, ingressos, contratos) guardados em IndexedDB:
   arquivos ficam fora do localStorage, que é pequeno demais para PDFs e fotos. */

const Att = (() => {
  const DB = 'viagem-anexos', STORE = 'arquivos';
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!('indexedDB' in window)) return rej(new Error('IndexedDB indisponível'));
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }

  function run(mode, fn) {
    return open().then(db => new Promise((res, rej) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.onerror = () => rej(tx.error);
      if (req) { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }
      else tx.oncomplete = () => res();
    }));
  }

  async function put(file) {
    const id = Store.uid();
    await run('readwrite', st => st.put({
      id, nome: file.name, tipo: file.type || 'application/octet-stream',
      tamanho: file.size, blob: file, criadoEm: new Date().toISOString(),
    }));
    return { id, nome: file.name, tipo: file.type, tamanho: file.size };
  }

  const get = id => run('readonly', st => st.get(id));
  const all = () => run('readonly', st => st.getAll());
  const remove = id => run('readwrite', st => st.delete(id));

  /* Metadados em cache para a lista desenhar nome/tamanho sem abrir o blob. */
  const meta = new Map();
  async function warm() {
    try {
      const rs = await all();
      rs.forEach(r => meta.set(r.id, { id: r.id, nome: r.nome, tipo: r.tipo, tamanho: r.tamanho }));
    } catch (e) { /* sem IndexedDB: anexos simplesmente não aparecem */ }
    return meta;
  }
  const info = id => meta.get(id) || null;

  async function abrir(id) {
    let r = null;
    try { r = await get(id); } catch (e) { /* tratado abaixo */ }
    if (!r || !r.blob) return UI.toast('Arquivo não encontrado — anexe de novo');
    UI.verArquivo({ nome: r.nome, tipo: r.tipo, blob: r.blob });
  }

  async function registrar(file) {
    const m = await put(file);
    meta.set(m.id, m);
    return m;
  }

  async function apagar(id) {
    try { await remove(id); } catch (e) { /* ignora */ }
    meta.delete(id);
  }

  /* Remove arquivos que não estão mais referenciados por nenhum item. */
  async function limpar() {
    try {
      const s = Store.state;
      const usados = new Set([
        ...(s.viagem.anexos || []),
        ...s.checklist.flatMap(i => i.anexos || []),
        ...s.agenda.flatMap(i => i.anexos || []),
        ...s.gastos.flatMap(i => i.anexos || []),
      ]);
      const rs = await all();
      for (const r of rs) if (!usados.has(r.id)) { await remove(r.id); meta.delete(r.id); }
    } catch (e) { /* ignora */ }
  }

  return { registrar, apagar, abrir, info, warm, limpar, get, all };
})();
