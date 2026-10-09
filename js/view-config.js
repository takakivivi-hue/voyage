/* Ajustes — moeda e cotação, listas editáveis (grupos e categorias),
   backup em arquivo JSON e reinício. */

const Config = (() => {
  const E = UI.esc;

  const LISTAS = {
    categorias: { titulo: 'Grupos de gasto', campo: 'categorias', usoEm: g => g.categoria, col: 'gastos' },
    gruposCheck: { titulo: 'Grupos do plano', campo: 'gruposCheck', usoEm: i => i.grupo, col: 'checklist' },
    gruposMala: { titulo: 'Grupos da mala', campo: 'gruposMala', usoEm: i => i.grupo, col: 'mala' },
    pagamentos: { titulo: 'Formas de pagamento', campo: 'pagamentos', usoEm: g => g.pagamento, col: 'gastos' },
  };

  function listaHTML(key) {
    const L = LISTAS[key], s = Store.state;
    return `<div class="card">
      <div class="spread" style="margin-bottom:8px">
        <h2 class="sec">${E(L.titulo)}<span class="count">${s[L.campo].length}</span></h2>
        <button class="btn quiet sm" data-add-lista="${key}">+ adicionar</button>
      </div>
      <div class="chips">${s[L.campo].map((x, i) => `<span class="chip">${E(x)}
        <button data-ren-lista="${key}" data-i="${i}" style="background:none;border:0;color:var(--ink-mute);cursor:pointer;padding:0 2px;display:grid">
          <svg viewBox="0 0 24 24" style="width:12px;height:12px"><path d="M4 20h4l10-10-4-4L4 16v4z"/></svg></button>
        <button data-del-lista="${key}" data-i="${i}" style="background:none;border:0;color:var(--ink-mute);cursor:pointer;padding:0 2px;display:grid">
          <svg viewBox="0 0 24 24" style="width:12px;height:12px"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </span>`).join('')}</div>
    </div>`;
  }

  function render() {
    const s = Store.state;
    const tudo = s.checklist.length + s.mala.length + s.agenda.length + s.gastos.length;
    return `
      <div class="card">
        <div class="spread">
          <div><span class="eyebrow">Moeda do destino</span>
            <div class="money-lg num" style="margin-top:2px">1 ${E(s.moeda.codigo)} = R$ ${UI.n2(s.moeda.cotacao)}</div>
            <div class="tiny muted">${s.moeda.nome ? E(s.moeda.nome) : 'Defina a cotação que você quer usar'}</div></div>
          <button class="btn gold sm" data-cot>Alterar</button>
        </div>
        <div class="fhint" style="margin-top:10px">Os valores são guardados na moeda em que você digitou. Ao mudar a cotação, todas as conversões — antigas e novas — são recalculadas.</div>
      </div>

      <div class="card">
        <div class="spread" style="margin-bottom:8px">
          <h2 class="sec">Viajantes<span class="count">${s.viajantes.length}</span></h2>
          <button class="btn quiet sm" data-novo-viajante>+ adicionar</button>
        </div>
        ${s.viajantes.length ? `<div class="chips">${s.viajantes.map((v, i) =>
          `<button class="chip" data-viajante="${v.id}">${UI.av(v.nome, i)}${E(v.nome)}
            <svg viewBox="0 0 24 24" style="width:12px;height:12px;opacity:.5"><path d="M4 20h4l10-10-4-4L4 16v4z"/></svg></button>`).join('')}</div>`
          : '<div class="empty">Ninguém cadastrado ainda.</div>'}
        <div class="fhint" style="margin-top:10px">Quem viaja com você. Cada gasto registra quem pagou e entre quem foi dividido; a aba Acerto fecha a conta.</div>
      </div>

      ${listaHTML('categorias')}
      ${listaHTML('gruposCheck')}
      ${listaHTML('gruposMala')}
      ${listaHTML('pagamentos')}

      <section class="block">
        <h2 class="sec">Instalação e offline</h2>
        <div class="card">
          <div data-diag><div class="tiny muted">verificando…</div></div>
          <div class="row wrap" style="margin-top:14px">
            <button class="btn gold sm" data-pwa-instalar>Como instalar</button>
            <button class="btn ghost sm" data-pwa-atualizar>Atualizar o app</button>
          </div>
          <div class="fhint" style="margin-top:10px">"Atualizar o app" busca a versão mais nova e recarrega. Seus dados não são apagados — só os arquivos do programa.</div>
        </div>
      </section>

      <section class="block">
        <h2 class="sec">Leitor de notas</h2>
        <div class="card">
          <div class="tiny muted">A leitura da foto acontece dentro do aparelho e não usa internet — mas o motor de leitura (cerca de 9 MB) precisa ser baixado uma vez. <b>Faça isso antes de viajar</b>, no Wi-Fi de casa.</div>
          <div class="row wrap" style="margin-top:12px">
            <button class="btn ghost sm" data-preparar-ocr>Baixar agora para uso offline</button>
          </div>
          <div class="tiny muted" style="margin-top:10px" data-ocr-status></div>
        </div>
      </section>

      <section class="block">
        <h2 class="sec">Backup</h2>
        <div class="card">
          <div class="tiny muted">Os dados ficam só neste aparelho, no navegador. Exporte de vez em quando — e antes de trocar de celular.</div>
          <div class="row wrap" style="margin-top:12px">
            <button class="btn ghost sm" data-export>Exportar arquivo</button>
            <label class="btn ghost sm file-pick">Importar arquivo<input type="file" accept="application/json,.json" data-import></label>
          </div>
          <div class="tiny muted" style="margin-top:10px">${tudo} registros · ${s.viagem.titulo ? E(s.viagem.titulo) : 'sem nome'}</div>
        </div>
      </section>

      <section class="block">
        <h2 class="sec">Zona de risco</h2>
        <div class="card">
          <div class="row wrap">
            <button class="btn danger sm" data-limpar-gastos>Apagar todos os gastos</button>
            <button class="btn danger sm" data-reset>Começar viagem nova</button>
          </div>
          <div class="tiny muted" style="margin-top:10px">“Começar viagem nova” apaga tudo e recria os checklists padrão. Exporte antes.</div>
        </div>
      </section>

      <div class="center tiny muted" style="margin-top:24px">Voyage · planejamento, roteiro e finanças de viagem</div>`;
  }

  async function addLista(key) {
    const L = LISTAS[key];
    const v = await UI.prompt({ title: L.titulo, label: 'Novo item' });
    if (v) Store.commit(s => { if (!s[L.campo].includes(v)) s[L.campo].push(v); });
  }

  async function renLista(key, i) {
    const L = LISTAS[key], antigo = Store.state[L.campo][i];
    const v = await UI.prompt({ title: 'Renomear', label: L.titulo, value: antigo,
      hint: 'Os itens que já usam este nome são atualizados.' });
    if (!v || v === antigo) return;
    Store.commit(s => {
      s[L.campo][i] = v;
      const chave = L.col === 'gastos' && key === 'pagamentos' ? 'pagamento' : (L.col === 'gastos' ? 'categoria' : 'grupo');
      s[L.col].forEach(it => { if (it[chave] === antigo) it[chave] = v; });
      if (key === 'categorias') s.agenda.forEach(a => { if (a.categoria === antigo) a.categoria = v; });
    });
  }

  async function delLista(key, i) {
    const L = LISTAS[key], nome = Store.state[L.campo][i];
    const usos = Store.state[L.col].filter(it => L.usoEm(it) === nome).length;
    const msg = usos ? `"${nome}" está em ${usos} registro(s). Eles continuam com esse nome, mas ele sai da lista de opções. Remover?`
                     : `Remover "${nome}" da lista?`;
    if (!(await UI.confirmar(msg, { ok: 'Remover', perigo: true }))) return;
    Store.commit(s => { s[L.campo].splice(i, 1); });
  }

  /* Diagnóstico da instalação: diz em uma olhada o que falta para o app
     virar aplicativo de verdade e funcionar sem internet. */
  const linhaDiag = (ok, titulo, nota) => `<div class="diag ${ok ? 'sim' : 'nao'}">
    <span class="mark"><svg viewBox="0 0 24 24">${ok ? '<path d="M5 12.5l4.5 4.5L19 7.5"/>' : '<path d="M12 7v7M12 17.2v.3"/>'}</svg></span>
    <span class="txt">${titulo}${nota ? `<small>${nota}</small>` : ''}</span></div>`;

  async function pintarDiagnostico(root) {
    const alvo = root.querySelector('[data-diag]');
    if (!alvo) return;
    const d = await Pwa.diagnostico();
    alvo.innerHTML = [
      linhaDiag(d.https,
        d.https ? (d.protocolo === 'https' ? 'Endereço seguro (https)' : 'Contexto seguro (localhost)') : 'Endereço não é https',
        d.https
          ? (d.protocolo === 'https' ? E(d.host) : `${E(d.host)} — vale como seguro só neste computador. No celular, pela rede local, não vale.`)
          : `Agora em ${E(d.protocolo)}://${E(d.host)}. Fora de localhost, o navegador só liga instalação e modo offline em https — é regra do navegador, não do app.`),
      linhaDiag(d.sw, d.sw ? 'Motor offline ativo' : 'Motor offline desligado',
        d.sw ? 'O app sabe se abrir sem internet.'
             : (d.https ? 'O endereço está certo, mas este navegador recusou o registro. Em um Safari ou Chrome comum funciona.'
                        : 'Depende do https acima.')),
      linhaDiag(d.offlinePronto,
        d.offlinePronto ? `App guardado para uso offline (${d.arquivosGuardados} arquivos)` : 'App ainda não guardado',
        d.offlinePronto ? 'Abre no avião, no metrô, sem sinal.'
          : (d.arquivosGuardados ? `${d.arquivosGuardados} arquivos guardados, mas a página principal não. Use "Atualizar o app" abaixo.`
                                 : 'Toque em "Atualizar o app" abaixo e abra de novo.')),
      linhaDiag(d.ocrPronto, d.ocrPronto ? 'Leitor de notas guardado' : 'Leitor de notas não guardado',
        d.ocrPronto ? '' : 'Use o botão abaixo antes de viajar.'),
      linhaDiag(d.instalado, d.instalado ? 'Rodando como app instalado' : 'Rodando dentro do navegador',
        d.instalado ? 'Tela cheia, sem barra de endereço.' : (d.iOS ? 'No Safari: Compartilhar → Adicionar à Tela de Início.' : 'Menu do navegador → Instalar app.')),
      d.online ? '' : linhaDiag(false, 'Sem internet agora', 'Os dados continuam no aparelho; só a sincronia de arquivos novos espera.'),
    ].join('');
    Pwa.atualizarBotoes();
  }

  /* Puxa os arquivos do leitor para o cache, para a primeira leitura na viagem
     não depender de internet. */
  async function prepararOcr(root) {
    const alvo = root.querySelector('[data-ocr-status]');
    const arquivos = [
      'leitor/tesseract/tesseract.min.js', 'leitor/tesseract/worker.min.js',
      'leitor/tesseract/tesseract-core-simd-lstm.js', 'leitor/tesseract/tesseract-core-simd-lstm.wasm',
      'leitor/tesseract/tesseract-core-lstm.js', 'leitor/tesseract/tesseract-core-lstm.wasm',
      'leitor/tessdata/por.traineddata.gz', 'leitor/tessdata/eng.traineddata.gz',
    ];
    let ok = 0;
    for (const a of arquivos) {
      if (alvo) alvo.textContent = `baixando ${ok + 1} de ${arquivos.length}…`;
      try { const r = await fetch(a, { cache: 'reload' }); if (r.ok) { await r.blob(); ok++; } }
      catch (e) { /* segue para o próximo */ }
    }
    if (alvo) alvo.textContent = ok === arquivos.length
      ? 'Pronto. O leitor de notas já funciona offline.'
      : `${ok} de ${arquivos.length} arquivos baixados — tente de novo com uma conexão melhor.`;
    UI.toast(ok === arquivos.length ? 'Leitor pronto para offline' : 'Download incompleto');
    pintarDiagnostico(root);
  }

  async function exportar() {
    const dados = { app: 'voyage', exportadoEm: new Date().toISOString(), dados: Store.state };
    // anexos entram em base64 para o backup ser autossuficiente
    try {
      const arqs = await Att.all();
      dados.anexos = await Promise.all(arqs.map(a => new Promise(res => {
        const fr = new FileReader();
        fr.onload = () => res({ id: a.id, nome: a.nome, tipo: a.tipo, tamanho: a.tamanho, b64: fr.result });
        fr.onerror = () => res(null);
        fr.readAsDataURL(a.blob);
      })));
      dados.anexos = dados.anexos.filter(Boolean);
    } catch (e) { dados.anexos = []; }

    const nome = `viagem-${(Store.state.viagem.titulo || 'backup').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${UI.hoje()}.json`;
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 20000);
    UI.toast('Backup gerado');
  }

  async function importar(file) {
    if (!file) return;
    if (!(await UI.confirmar('Importar substitui todos os dados atuais. Continuar?', { ok: 'Importar', perigo: true }))) return;
    try {
      const txt = await file.text();
      const j = JSON.parse(txt);
      const dados = j.dados || j;
      if (!dados || !dados.viagem) throw new Error('formato');
      if (Array.isArray(j.anexos)) {
        for (const a of j.anexos) {
          const blob = await (await fetch(a.b64)).blob();
          await Att.registrar(new File([blob], a.nome, { type: a.tipo }))
            .then(m => { /* ids novos; remapeados abaixo */ a.novoId = m.id; });
        }
        // remapeia os ids antigos nos registros importados
        const mapa = new Map(j.anexos.map(a => [a.id, a.novoId]));
        const tr = ids => (ids || []).map(x => mapa.get(x) || x);
        dados.viagem.anexos = tr(dados.viagem.anexos);
        ['checklist', 'agenda', 'gastos'].forEach(c => (dados[c] || []).forEach(i => { i.anexos = tr(i.anexos); }));
      }
      Store.replace(dados);
      UI.toast('Dados importados');
    } catch (e) {
      UI.toast('Arquivo inválido');
    }
  }

  function abrir() {
    let off = () => {};
    const sh = UI.sheet({ title: 'Ajustes', body: render(), onClose: () => off() });
    const repinta = () => { sh.body.innerHTML = render(); pintarDiagnostico(sh.body); };
    off = Store.sub(repinta);
    pintarDiagnostico(sh.body);

    sh.body.addEventListener('click', async e => {
      if (e.target.closest('[data-cot]')) { await Gastos.editarCotacao(); repinta(); return; }
      const a = e.target.closest('[data-add-lista]'); if (a) return addLista(a.dataset.addLista);
      const r = e.target.closest('[data-ren-lista]'); if (r) return renLista(r.dataset.renLista, +r.dataset.i);
      const d = e.target.closest('[data-del-lista]'); if (d) return delLista(d.dataset.delLista, +d.dataset.i);
      if (e.target.closest('[data-novo-viajante]')) return ViewAcerto.novoViajante();
      const vj = e.target.closest('[data-viajante]');
      if (vj) return ViewAcerto.editarViajante(vj.dataset.viajante);
      if (e.target.closest('[data-pwa-instalar]')) return Pwa.instalar();
      if (e.target.closest('[data-pwa-atualizar]')) {
        if (await UI.confirmar('Buscar a versão mais nova e recarregar? Seus dados da viagem não são apagados.', { ok: 'Atualizar' }))
          return Pwa.forcarAtualizacao();
        return;
      }
      if (e.target.closest('[data-preparar-ocr]')) return prepararOcr(sh.body);
      if (e.target.closest('[data-export]')) return exportar();
      if (e.target.closest('[data-limpar-gastos]')) {
        if (await UI.confirmar('Apagar todos os lançamentos de gasto?', { ok: 'Apagar', perigo: true })) {
          Store.commit(s => { s.gastos = []; }); UI.toast('Gastos apagados');
        }
        return;
      }
      if (e.target.closest('[data-reset]')) {
        if (await UI.confirmar('Apagar tudo e começar uma viagem nova?', { ok: 'Apagar tudo', perigo: true })) {
          Store.reset(); await Att.limpar(); sh.close(); UI.toast('Pronto para a próxima viagem');
        }
      }
    });
    sh.body.addEventListener('change', e => {
      const imp = e.target.closest('[data-import]');
      if (imp) importar(imp.files[0]);
    });
  }

  return { abrir };
})();
