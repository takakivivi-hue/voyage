/* UI — helpers de formatação, conversão de moeda, sheet modal e construtor de formulários. */

const UI = (() => {
  const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const DIAS = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'];

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  const n2 = v => nf2.format(Number(v) || 0);
  const nk = v => { const x = Math.abs(Number(v) || 0); return x >= 1000 ? nf0.format(Math.round(x)) : nf2.format(x); };

  /* Aceita "1.234,56", "1234.56", "1234" */
  function num(str) {
    if (str == null || str === '') return null;
    if (typeof str === 'number') return str;
    let s = String(str).trim().replace(/[^\d.,-]/g, '');
    if (s === '' || s === '-') return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
    const v = parseFloat(s);
    return isNaN(v) ? null : v;
  }

  /* --- conversão: a moeda digitada manda, a outra é derivada da cotação --- */
  const cot = () => Number(Store.state.moeda.cotacao) || 0;
  const sim = () => Store.state.moeda.simbolo || Store.state.moeda.codigo || '$';

  function conv(m, rate) {
    const r = rate == null ? cot() : rate;
    if (!m || m.v == null || isNaN(m.v)) return { brl: 0, fx: 0, vazio: true };
    return m.base === 'FX'
      ? { brl: m.v * r, fx: m.v, vazio: false }
      : { brl: m.v, fx: r ? m.v / r : 0, vazio: false };
  }
  const brlDe = m => conv(m).brl;

  const brl = v => `<span class="num"><span class="cur">R$</span>${n2(v)}</span>`;
  const fx = v => `<span class="num fx"><span class="cur">${esc(sim())}</span>${n2(v)}</span>`;

  /* --- datas (ISO yyyy-mm-dd, sem fuso) --- */
  const hoje = () => new Date().toISOString().slice(0, 10);
  function dmy(iso) { if (!iso) return ''; const [a, m, d] = iso.split('-'); return `${d}/${m}/${a}`; }
  function dm(iso) { if (!iso) return ''; const [, m, d] = iso.split('-'); return `${d}/${m}`; }
  function extenso(iso) {
    if (!iso) return '';
    const [a, m, d] = iso.split('-').map(Number);
    const dt = new Date(a, m - 1, d);
    return `${DIAS[dt.getDay()]}, ${d} de ${MESES[m - 1]}`;
  }
  function diasEntre(a, b) {
    if (!a || !b) return null;
    return Math.round((new Date(b + 'T00:00') - new Date(a + 'T00:00')) / 86400000);
  }
  const noPeriodo = (d, de, ate) => !!d && (!de || d >= de) && (!ate || d <= ate);

  function haptic(ms = 8) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }

  /* --- toast --- */
  let tEl, tTimer;
  function toast(msg) {
    if (!tEl) { tEl = el('<div class="toast"></div>'); document.body.appendChild(tEl); }
    tEl.textContent = msg;
    // cada aviso começa sem ação: um toast já invisível não pode continuar
    // interceptando toques perto da barra de baixo
    tEl.onclick = null;
    tEl.style.pointerEvents = 'none';
    tEl.style.cursor = '';
    requestAnimationFrame(() => tEl.classList.add('on'));
    clearTimeout(tTimer);
    tTimer = setTimeout(() => {
      tEl.classList.remove('on');
      tEl.onclick = null;
      tEl.style.pointerEvents = 'none';
    }, 2200);
  }

  /* --- sheet (bottom sheet no mobile, diálogo central no desktop) --- */
  let abertas = 0;
  function sheet({ title, sub, body, footer, onClose }) {
    const layer = document.getElementById('layer');
    const scrim = el('<div class="scrim"></div>');
    const s = el(`<div class="sheet" role="dialog" aria-modal="true">
      <div class="sheet-grab"><i></i></div>
      <div class="sheet-head">
        <div><h3>${esc(title || '')}</h3>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>
        <button class="icon-btn" data-x aria-label="Fechar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <div class="sheet-body"></div>
    </div>`);
    const bodyEl = s.querySelector('.sheet-body');
    if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
    if (footer) { const f = el('<div class="sheet-foot"></div>'); if (typeof footer === 'string') f.innerHTML = footer; else f.appendChild(footer); s.appendChild(f); }

    layer.append(scrim, s);
    abertas++;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => { scrim.classList.add('on'); s.classList.add('on'); });

    let closed = false;
    function close(val) {
      if (closed) return; closed = true;
      scrim.classList.remove('on'); s.classList.remove('on');
      abertas = Math.max(0, abertas - 1);
      if (!abertas) document.body.style.overflow = '';
      setTimeout(() => { scrim.remove(); s.remove(); }, 340);
      document.removeEventListener('keydown', onKey);
      onClose && onClose(val);
    }
    const onKey = e => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', onKey);
    scrim.onclick = () => close(null);
    s.querySelector('[data-x]').onclick = () => close(null);
    return { el: s, body: bodyEl, close };
  }

  function confirmar(msg, { ok = 'Confirmar', perigo = false } = {}) {
    return new Promise(res => {
      let done = false;
      const sh = sheet({
        title: 'Confirmar',
        body: `<p style="margin:2px 0 6px;line-height:1.5">${esc(msg)}</p>`,
        footer: `<button class="btn ghost" data-no>Cancelar</button><button class="btn ${perigo ? 'danger' : 'gold'}" data-yes>${esc(ok)}</button>`,
        onClose: () => { if (!done) res(false); },
      });
      sh.el.querySelector('[data-no]').onclick = () => { done = true; sh.close(); res(false); };
      sh.el.querySelector('[data-yes]').onclick = () => { done = true; sh.close(); res(true); };
    });
  }

  /* ===================== construtor de formulário =====================
     campos: {k, label, type, opts, hint, ph, half, rows}
     type: text | textarea | date | time | number | tel | select | money | files | grupo
     money guarda {base:'BRL'|'FX', v:number}; files guarda array de ids de anexo. */

  function campoHTML(f, val) {
    const id = 'f_' + f.k;
    if (f.type === 'grupo') return `<div class="fgroup">${esc(f.label)}</div>`;

    let inner = '';
    if (f.type === 'textarea') {
      inner = `<textarea id="${id}" data-k="${f.k}" rows="${f.rows || 3}" placeholder="${esc(f.ph || '')}">${esc(val || '')}</textarea>`;
    } else if (f.type === 'select') {
      const opts = (typeof f.opts === 'function' ? f.opts() : f.opts) || [];
      inner = `<select id="${id}" data-k="${f.k}">${f.vazia !== false ? `<option value="">${esc(f.ph || '—')}</option>` : ''}` +
        opts.map(o => { const v = typeof o === 'object' ? o.v : o, t = typeof o === 'object' ? o.t : o;
          return `<option value="${esc(v)}"${String(val) === String(v) ? ' selected' : ''}>${esc(t)}</option>`; }).join('') + `</select>`;
    } else if (f.type === 'money') {
      const c = conv(val);
      const srcB = !val || val.base !== 'FX';
      inner = `<div class="pair" data-money="${f.k}" data-base="${val && val.base === 'FX' ? 'FX' : 'BRL'}">
        <div class="mi ${srcB ? 'src' : ''}"><span>R$</span><input inputmode="decimal" data-cur="BRL" value="${c.vazio ? '' : n2(c.brl)}" placeholder="0,00"></div>
        <div class="mi ${srcB ? '' : 'src'}"><span>${esc(sim())}</span><input inputmode="decimal" data-cur="FX" value="${c.vazio ? '' : n2(c.fx)}" placeholder="0,00"></div>
      </div>`;
    } else if (f.type === 'divisao') {
      inner = `<div class="divisao" data-divisao="${f.k}">
        <div class="chips" style="margin-bottom:10px">
          <button type="button" class="chip tgl" data-modo="todos">Todos</button>
          <button type="button" class="chip tgl" data-modo="alguns">Escolher quem</button>
          <button type="button" class="chip tgl" data-modo="valores">Valor por pessoa</button>
        </div>
        <div class="div-lista"></div>
        <div class="fhint" data-dica></div>
      </div>`;
    } else if (f.type === 'files') {
      inner = `<div class="files" data-files="${f.k}"><div class="flist"></div>
        <label class="btn ghost sm file-pick"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Anexar arquivo
          <input type="file" multiple accept="image/*,application/pdf,.pdf,.png,.jpg,.jpeg,.heic,.webp,.txt,.doc,.docx"></label></div>`;
    } else {
      const t = f.type === 'number' ? 'text' : (f.type || 'text');
      const im = f.type === 'number' ? ' inputmode="decimal"' : (f.type === 'tel' ? ' inputmode="tel"' : '');
      const v = f.type === 'number' ? (val == null || val === '' ? '' : n2(val)) : (val ?? '');
      inner = `<input id="${id}" type="${t}"${im} data-k="${f.k}" value="${esc(v)}" placeholder="${esc(f.ph || '')}">`;
    }
    return `<div class="field"${f.half ? ' data-half="1"' : ''}>
      ${f.label ? `<label for="${id}">${esc(f.label)}</label>` : ''}${inner}
      ${f.hint ? `<div class="fhint">${esc(f.hint)}</div>` : ''}</div>`;
  }

  function montar(campos, valores) {
    const wrap = document.createElement('div');
    let i = 0;
    while (i < campos.length) {
      const f = campos[i];
      // dois campos "half" seguidos ficam na mesma linha
      if (f.half && campos[i + 1] && campos[i + 1].half) {
        const r = el('<div class="frow"></div>');
        r.innerHTML = campoHTML(f, valores[f.k]) + campoHTML(campos[i + 1], valores[campos[i + 1].k]);
        wrap.appendChild(r);
        if (wrap.children.length > 1) r.style.marginTop = '13px';
        i += 2; continue;
      }
      const n = el(campoHTML(f, valores[f.k]));
      if (wrap.children.length && f.type !== 'grupo') n.style.marginTop = '13px';
      wrap.appendChild(n);
      i++;
    }
    return wrap;
  }

  /* par de moedas: digitar em um lado recalcula o outro e define a base */
  function ligarMoeda(root) {
    root.querySelectorAll('[data-money]').forEach(pair => {
      const ins = pair.querySelectorAll('input');
      ins.forEach(inp => {
        inp.addEventListener('input', () => {
          const cur = inp.dataset.cur, r = cot();
          pair.dataset.base = cur;
          pair.querySelectorAll('.mi').forEach(mi => mi.classList.toggle('src', mi.contains(inp)));
          const outro = [...ins].find(x => x !== inp);
          const v = num(inp.value);
          if (v == null) outro.value = '';
          else outro.value = r ? n2(cur === 'BRL' ? v / r : v * r) : '';
          root.dispatchEvent(new CustomEvent('moeda:change', { bubbles: false }));
        });
        inp.addEventListener('blur', () => { const v = num(inp.value); if (v != null) inp.value = n2(v); });
      });
    });
  }

  /* anexos: sobem para o IndexedDB na hora da escolha e viram chips removíveis */
  function ligarArquivos(root, valores) {
    root.querySelectorAll('[data-files]').forEach(box => {
      const k = box.dataset.files;
      valores[k] = Array.isArray(valores[k]) ? [...valores[k]] : [];
      const lista = box.querySelector('.flist');
      const pintar = () => {
        lista.innerHTML = valores[k].map(id => {
          const m = Att.info(id) || { nome: 'arquivo', tamanho: 0 };
          return `<div class="file" data-id="${id}">
            <svg viewBox="0 0 24 24"><path d="M14 3v5h5M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/></svg>
            <span class="fname">${esc(m.nome)}</span><span class="fsize">${kb(m.tamanho)}</span>
            <button type="button" data-rm aria-label="Remover"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`;
        }).join('');
      };
      pintar();
      lista.addEventListener('click', async e => {
        const row = e.target.closest('.file'); if (!row) return;
        if (e.target.closest('[data-rm]')) {
          valores[k] = valores[k].filter(x => x !== row.dataset.id);
          await Att.apagar(row.dataset.id); pintar();
        } else Att.abrir(row.dataset.id);
      });
      box.querySelector('input[type=file]').addEventListener('change', async e => {
        for (const f of e.target.files) {
          if (f.size > 12 * 1024 * 1024) { toast(`"${f.name}" passa de 12 MB`); continue; }
          try { const m = await Att.registrar(f); valores[k].push(m.id); } catch (err) { toast('Não foi possível anexar'); }
        }
        e.target.value = ''; pintar();
      });
    });
  }

  const kb = b => !b ? '' : b < 1024 * 1024 ? Math.round(b / 1024) + ' KB' : (b / 1048576).toFixed(1) + ' MB';

  /* Mostra um anexo sem sair do app.
     window.open() é bloqueado dentro de um app instalado na tela de início do
     iPhone, então nada de abrir aba nova: a imagem ou o PDF são desenhados
     aqui mesmo, e quem quiser levar o arquivo para outro app usa o botão de
     compartilhar do próprio sistema. */
  function verArquivo({ nome, tipo = '', blob }) {
    if (!blob || !blob.size) {
      return sheet({ title: nome || 'Arquivo',
        body: '<div class="empty">Este arquivo está vazio ou se perdeu. Anexe de novo.</div>' });
    }

    const url = URL.createObjectURL(blob);
    const ehImagem = /^image\//.test(tipo) || /\.(png|jpe?g|heic|heif|webp|gif|avif)$/i.test(nome || '');
    const ehPdf = /pdf/i.test(tipo) || /\.pdf$/i.test(nome || '');
    const ehTexto = /^text\//.test(tipo) || /\.(txt|csv|md)$/i.test(nome || '');

    let corpo;
    if (ehImagem) corpo = `<img class="visor-img" src="${url}" alt="${esc(nome || '')}">`;
    else if (ehPdf) corpo = `<iframe class="visor-pdf" src="${url}" title="${esc(nome || '')}"></iframe>
      <div class="fhint" style="margin-top:10px">Se o PDF aparecer em branco, use <b>Abrir em outro app</b> abaixo — alguns PDFs só abrem no leitor do sistema.</div>`;
    else if (ehTexto) corpo = `<div class="preview-txt" data-texto>carregando…</div>`;
    else corpo = `<div class="empty">Este tipo de arquivo não tem visualização aqui dentro.<br>Use <b>Abrir em outro app</b> abaixo.</div>`;

    const arquivo = new File([blob], nome || 'arquivo', { type: tipo || 'application/octet-stream' });
    const podeMandar = typeof navigator.canShare === 'function' &&
      (() => { try { return navigator.canShare({ files: [arquivo] }); } catch (e) { return false; } })();

    const sh = sheet({
      title: nome || 'Arquivo',
      sub: `${tipo || 'arquivo'} · ${kb(blob.size)}`,
      body: `<div class="visor">${corpo}</div>`,
      footer: `${podeMandar ? '<button class="btn gold" data-abrir>Abrir em outro app</button>' : ''}
               <button class="btn ghost" data-aba>Abrir numa aba</button>`,
      onClose: () => setTimeout(() => URL.revokeObjectURL(url), 1000),
    });

    if (ehTexto) blob.text().then(t => {
      const alvo = sh.body.querySelector('[data-texto]');
      if (alvo) alvo.textContent = t.slice(0, 20000);
    }).catch(() => {});

    const bAbrir = sh.el.querySelector('[data-abrir]');
    if (bAbrir) bAbrir.onclick = async () => {
      haptic(12);
      try { await navigator.share({ files: [arquivo], title: nome }); }
      catch (e) { if (e && e.name !== 'AbortError') toast('Não consegui compartilhar este arquivo'); }
    };

    // o clique num link conta como gesto do usuário e passa onde window.open não passa
    sh.el.querySelector('[data-aba]').onclick = () => {
      haptic();
      const a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
    };

    return sh;
  }

  /* A área de transferência moderna exige contexto seguro; o textarea escondido
     é o jeito antigo, que funciona também em http da rede local. */
  async function copiar(txt) {
    try {
      await navigator.clipboard.writeText(txt);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = txt;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, txt.length);
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      ta.remove();
      return ok;
    }
  }

  const podeCompartilhar = () => typeof navigator.share === 'function';

  /* Abre a folha de compartilhamento do celular (WhatsApp, e-mail, etc.). */
  async function compartilhar(texto, titulo) {
    if (!podeCompartilhar()) return false;
    try {
      await navigator.share({ title: titulo, text: texto });
      return true;
    } catch (e) {
      return false; // o usuário cancelou — não é erro
    }
  }

  /* Pré-visualização de um texto pronto para enviar. */
  function enviarTexto({ title, sub, texto, nomeBotao = 'Compartilhar' }) {
    const sh = sheet({
      title, sub,
      body: `<div class="preview-txt">${esc(texto)}</div>`,
      footer: `${podeCompartilhar() ? `<button class="btn gold" data-share>${esc(nomeBotao)}</button>` : ''}
               <button class="btn ghost" data-copy>Copiar texto</button>`,
    });
    const share = sh.el.querySelector('[data-share]');
    if (share) share.onclick = async () => {
      haptic(12);
      const ok = await compartilhar(texto, title);
      if (ok) sh.close();
    };
    sh.el.querySelector('[data-copy]').onclick = async () => {
      haptic(12);
      toast((await copiar(texto)) ? 'Texto copiado — cole no grupo' : 'Não consegui copiar; selecione o texto acima');
    };
    return sh;
  }

  /* Iniciais para o avatar do viajante. */
  function iniciais(nome) {
    const ps = String(nome || '?').trim().split(/\s+/);
    return ((ps[0] || '?')[0] + (ps.length > 1 ? ps[ps.length - 1][0] : '')).toUpperCase();
  }
  const av = (nome, i = 0) => `<span class="av" style="--i:${i % 8}">${esc(iniciais(nome))}</span>`;

  /* Campo de divisão: modo + participantes + valores individuais.
     Os valores por pessoa são digitados na mesma moeda do campo Realizado. */
  function ligarDivisao(root, valores) {
    const box = root.querySelector('[data-divisao]');
    if (!box) return;
    const k = box.dataset.divisao;
    const v = valores[k] = { rateio: 'todos', participantes: [], valores: {}, ...(valores[k] || {}) };
    const lista = box.querySelector('.div-lista');
    const dica = box.querySelector('[data-dica]');
    const pessoas = () => Store.state.viajantes;

    const parTotal = () => {
      const pair = root.querySelector('[data-money="realizado"]');
      if (!pair) return { brl: 0, base: 'BRL' };
      const base = pair.dataset.base || 'BRL';
      const n = num(pair.querySelector(`input[data-cur="${base}"]`).value);
      return { brl: conv(n == null ? null : { base, v: n }).brl, base };
    };

    function pintar() {
      const ps = pessoas();
      box.querySelectorAll('[data-modo]').forEach(b => b.setAttribute('aria-pressed', b.dataset.modo === v.rateio));
      if (!ps.length) {
        lista.innerHTML = '<div class="empty" style="padding:14px">Cadastre os viajantes em Ajustes para dividir os gastos.</div>';
        dica.textContent = '';
        return;
      }
      const { brl, base } = parTotal();
      v.base = base;

      if (v.rateio === 'valores') {
        lista.innerHTML = ps.map((p, i) => `<div class="div-row">
          ${av(p.nome, i)}<span class="grow">${esc(p.nome)}</span>
          <div class="mi" style="width:120px"><span>${esc(base === 'BRL' ? 'R$' : sim())}</span>
            <input inputmode="decimal" data-val="${p.id}" value="${v.valores[p.id] ? n2(v.valores[p.id]) : ''}" placeholder="0,00"></div>
        </div>`).join('');
        const soma = ps.reduce((a, p) => a + (Number(v.valores[p.id]) || 0), 0);
        const somaBrl = conv({ base, v: soma }).brl;
        const sobra = brl - somaBrl;
        dica.textContent = Math.abs(sobra) < 0.005
          ? `Soma exata: R$ ${n2(brl)}.`
          : sobra > 0
            ? `Faltam R$ ${n2(sobra)} — essa sobra (taxa, gorjeta) é dividida igualmente entre quem tem valor lançado.`
            : `Passou R$ ${n2(-sobra)} do total do gasto — ajuste algum valor.`;
        return;
      }

      const sel = v.rateio === 'alguns'
        ? (v.participantes.length ? v.participantes : ps.map(p => p.id))
        : ps.map(p => p.id);
      v.participantes = v.rateio === 'alguns' ? sel : [];

      lista.innerHTML = `<div class="chips">${ps.map((p, i) => `
        <button type="button" class="chip tgl pessoa" data-p="${p.id}" aria-pressed="${sel.includes(p.id)}"
          ${v.rateio === 'todos' ? 'disabled' : ''}>${av(p.nome, i)}${esc(p.nome)}</button>`).join('')}</div>`;

      const n = sel.length || 1;
      dica.textContent = brl
        ? `R$ ${n2(brl / n)} para cada um dos ${n}.`
        : (v.rateio === 'todos' ? 'Dividido igualmente entre todos os viajantes.' : 'Dividido igualmente entre os escolhidos.');
    }

    box.addEventListener('click', e => {
      const m = e.target.closest('[data-modo]');
      if (m) { v.rateio = m.dataset.modo; haptic(5); pintar(); return; }
      const p = e.target.closest('[data-p]');
      if (p && !p.disabled) {
        const id = p.dataset.p;
        const atual = new Set(v.participantes);
        atual.has(id) ? atual.delete(id) : atual.add(id);
        v.participantes = [...atual];
        haptic(5); pintar();
      }
    });
    box.addEventListener('input', e => {
      const i = e.target.closest('[data-val]');
      if (!i) return;
      v.valores[i.dataset.val] = num(i.value) || 0;
      const { brl, base } = parTotal();
      const soma = pessoas().reduce((a, p) => a + (Number(v.valores[p.id]) || 0), 0);
      const sobra = brl - conv({ base, v: soma }).brl;
      dica.textContent = Math.abs(sobra) < 0.005 ? `Soma exata: R$ ${n2(brl)}.`
        : sobra > 0 ? `Faltam R$ ${n2(sobra)} — divididos igualmente entre quem tem valor lançado.`
        : `Passou R$ ${n2(-sobra)} do total do gasto.`;
    });
    root.addEventListener('moeda:change', () => { if (v.rateio !== 'valores') pintar(); });
    pintar();
  }

  function colher(root, campos, valores) {
    const out = { ...valores };
    campos.forEach(f => {
      if (f.type === 'grupo') return;
      if (f.type === 'money') {
        const pair = root.querySelector(`[data-money="${f.k}"]`);
        if (!pair) return;
        const base = pair.dataset.base || 'BRL';
        const v = num(pair.querySelector(`input[data-cur="${base}"]`).value);
        out[f.k] = v == null ? null : { base, v };
        return;
      }
      if (f.type === 'files' || f.type === 'divisao') { out[f.k] = valores[f.k]; return; }
      const inp = root.querySelector(`[data-k="${f.k}"]`);
      if (!inp) return;
      out[f.k] = f.type === 'number' ? num(inp.value) : inp.value.trim();
    });
    return out;
  }

  /* Abre um formulário em sheet. Resolve com os valores ou null se cancelado.
     onDelete (opcional) adiciona o botão de excluir. */
  function form({ title, sub, campos, valores = {}, ok = 'Salvar', onDelete }) {
    return new Promise(res => {
      const vals = { ...valores };
      const corpo = montar(campos, vals);
      let done = false;
      const sh = sheet({
        title, sub, body: corpo,
        footer: `${onDelete ? '<button class="btn danger sm" data-del aria-label="Excluir"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>' : ''}
                 <button class="btn gold" data-ok>${esc(ok)}</button>`,
        onClose: () => { if (!done) res(null); },
      });
      ligarMoeda(sh.body);
      ligarArquivos(sh.body, vals);
      ligarDivisao(sh.body, vals);
      sh.el.querySelector('[data-ok]').onclick = () => {
        done = true; haptic(12);
        const out = colher(sh.body, campos, vals);
        sh.close(); res(out);
      };
      const d = sh.el.querySelector('[data-del]');
      if (d) d.onclick = async () => {
        if (!(await confirmar('Excluir este item? Não dá para desfazer.', { ok: 'Excluir', perigo: true }))) return;
        done = true; sh.close(); onDelete(); res(null);
      };
      const first = sh.body.querySelector('input,textarea,select');
      if (first && window.matchMedia('(min-width:640px)').matches) setTimeout(() => first.focus(), 360);
    });
  }

  /* Edição rápida de um valor único. */
  function prompt({ title, label, value = '', type = 'text', ok = 'Salvar', hint }) {
    return form({ title, campos: [{ k: 'v', label, type, hint }], valores: { v: value }, ok })
      .then(r => (r ? r.v : null));
  }

  const badgeAnexos = ids => (ids && ids.length)
    ? `<span class="att-badge"><svg viewBox="0 0 24 24"><path d="M21 12.5l-8.5 8.5a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8"/></svg>${ids.length}</span>` : '';

  return { esc, el, n2, nk, num, conv, brlDe, brl, fx, cot, sim, hoje, dmy, dm, extenso, diasEntre, noPeriodo,
           MESES, DIAS, haptic, toast, sheet, confirmar, form, prompt, kb, badgeAnexos, av, iniciais,
           copiar, compartilhar, podeCompartilhar, enviarTexto, verArquivo };
})();
