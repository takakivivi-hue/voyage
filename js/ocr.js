/* OCR — lê a foto de uma nota e tenta adivinhar data, valor e categoria.
   Roda inteiramente no aparelho (Tesseract compilado para WebAssembly, que
   fica junto do app), então funciona sem internet e nenhuma foto sai do celular.

   O resultado é sempre um rascunho: a tela de confirmação mostra o que foi lido
   para você corrigir antes de salvar. Nota fiscal amassada, papel térmico
   apagado ou foto torta derrubam muito o acerto — a foto fica anexada de
   qualquer jeito, então o pior caso é digitar como antes. */

const Ocr = (() => {
  // absoluto a partir da página: o worker resolve caminhos contra ele mesmo,
  // e em subpasta (GitHub Pages) um caminho relativo apontaria para o lugar errado
  const BASE = new URL('leitor/', document.baseURI).href;
  let workerP = null, onProg = null;

  /* ---------- carregamento sob demanda ---------- */
  function carregarScript(src) {
    return new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) return res();
      const s = document.createElement('script');
      s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error('falha ao carregar ' + src));
      document.head.appendChild(s);
    });
  }

  // módulo wasm mínimo que só valida onde há suporte a SIMD
  const SIMD = new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]);
  const temSimd = () => { try { return WebAssembly.validate(SIMD); } catch (e) { return false; } };

  function worker() {
    if (workerP) return workerP;
    workerP = (async () => {
      await carregarScript(BASE + 'tesseract/tesseract.min.js');
      return Tesseract.createWorker('por+eng', 1, {
        workerPath: BASE + 'tesseract/worker.min.js',
        corePath: BASE + `tesseract/tesseract-core-${temSimd() ? 'simd-' : ''}lstm.js`,
        langPath: BASE + 'tessdata',
        workerBlobURL: false,
        logger: m => onProg && onProg(m),
      });
    })();
    return workerP;
  }

  /* ---------- preparo da imagem ---------- */
  /* Reduz, tira a cor e estica o contraste: o OCR erra bem menos assim e
     a foto de 4000px do celular não trava o aparelho. */
  async function preparar(file) {
    let bmp;
    try {
      bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (e) {
      bmp = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i); i.onerror = rej;
        i.src = URL.createObjectURL(file);
      });
    }
    const MAX = 1600;
    const esc = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * esc), h = Math.round(bmp.height * esc);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0, w, h);

    const img = ctx.getImageData(0, 0, w, h), d = img.data;
    let min = 255, max = 0;
    for (let i = 0; i < d.length; i += 4) {
      const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
      d[i] = d[i + 1] = d[i + 2] = g;
      if (g < min) min = g;
      if (g > max) max = g;
    }
    const amp = max - min || 1;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.max(0, Math.min(255, ((d[i] - min) * 255 / amp) | 0));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  /* ---------- números ---------- */
  /* Aceita 1.234,56 (Brasil), 1,234.56 (EUA) e 1234 (iene). */
  function valorDe(txt) {
    let s = String(txt).replace(/[^\d.,]/g, '');
    if (!s) return null;
    const ult = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
    if (ult >= 0) {
      const casas = s.length - ult - 1;
      if (casas === 1 || casas === 2) {
        s = s.slice(0, ult).replace(/[.,]/g, '') + '.' + s.slice(ult + 1);
      } else {
        s = s.replace(/[.,]/g, '');
      }
    }
    const v = parseFloat(s);
    return isNaN(v) ? null : v;
  }

  const CHAVES_TOTAL = /\b(total\s*a\s*pagar|valor\s*total|total\s*geral|total\s*due|grand\s*total|importe\s*total|total)\b|合計|総額/i;
  const CHAVES_EVITA = /\b(subtotal|sub-total|troco|change|desconto|discount|servi[çc]o|gorjeta|tip|taxa|imposto|tax|iva|icms|cart[ãa]o|dinheiro|cash|parcel)\b|小計/i;

  function acharValor(linhas) {
    // 1) a última linha que fala em total e tem número
    for (let i = linhas.length - 1; i >= 0; i--) {
      const L = linhas[i];
      if (!CHAVES_TOTAL.test(L) || CHAVES_EVITA.test(L)) continue;
      const nums = L.match(/[\d][\d.,]*/g);
      if (nums && nums.length) {
        const v = valorDe(nums[nums.length - 1]);
        if (v && v > 0) return { valor: v, fonte: L.trim() };
      }
    }
    // 2) senão, o maior número que pareça dinheiro
    let melhor = null;
    for (const L of linhas) {
      if (CHAVES_EVITA.test(L)) continue;
      const nums = L.match(/[\d][\d.,]*\d|\d/g) || [];
      for (const n of nums) {
        if (!/[.,]\d{2}$/.test(n)) continue;       // exige centavos para não pegar CNPJ/telefone
        const v = valorDe(n);
        if (v && (!melhor || v > melhor.valor)) melhor = { valor: v, fonte: L.trim() };
      }
    }
    return melhor;
  }

  /* ---------- data ---------- */
  function acharData(texto) {
    const v = Store.state.viagem;
    const hoje = new Date();
    const cand = [];
    const valida = (a, m, d) => {
      if (!a || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null;
      if (a < 100) a += a > 70 ? 1900 : 2000;
      const dt = new Date(a, m - 1, d);
      if (dt.getFullYear() !== a || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
      const anos = Math.abs(dt - hoje) / 31536000000;
      return anos > 2 ? null : `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    };

    // aaaa-mm-dd  e  aaaa年mm月dd日
    for (const m of texto.matchAll(/(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})/g)) {
      const iso = valida(+m[1], +m[2], +m[3]);
      if (iso) cand.push({ iso, certeza: 2 });
    }
    // dd/mm/aaaa ou mm/dd/aaaa — a ordem depende do país da nota
    for (const m of texto.matchAll(/(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{2,4})/g)) {
      const [, a, b, c] = m;
      const dmy = valida(+c, +b, +a);   // dia/mês/ano
      const mdy = valida(+c, +a, +b);   // mês/dia/ano
      if (+a > 12 && dmy) { cand.push({ iso: dmy, certeza: 2 }); continue; }
      if (+b > 12 && mdy) { cand.push({ iso: mdy, certeza: 2 }); continue; }
      // ambíguo: vence a leitura que cai dentro das datas da viagem
      const dentro = x => x && v.dataInicio && v.dataFim && x >= v.dataInicio && x <= v.dataFim;
      if (dentro(dmy) && !dentro(mdy)) cand.push({ iso: dmy, certeza: 2 });
      else if (dentro(mdy) && !dentro(dmy)) cand.push({ iso: mdy, certeza: 2 });
      else if (dmy) cand.push({ iso: dmy, certeza: 1 });
    }
    if (!cand.length) return null;
    cand.sort((x, y) => y.certeza - x.certeza);
    // certeza 1 = dd/mm e mm/dd eram igualmente possíveis (ex.: 11/03)
    return { iso: cand[0].iso, ambigua: cand[0].certeza < 2 };
  }

  /* ---------- moeda ---------- */
  function acharMoeda(texto) {
    const s = Store.state.moeda;
    const T = texto.toUpperCase();
    if (/R\$|\bBRL\b|\bREAIS?\b/.test(T)) return 'BRL';
    const cod = (s.codigo || '').toUpperCase();
    const sim = (s.simbolo || '').toUpperCase();
    if (cod && new RegExp(`\\b${cod}\\b`).test(T)) return 'FX';
    if (sim && sim !== 'R$' && T.includes(sim)) return 'FX';
    if (/[¥€£₩₫฿]|\bUSD\b|\bEUR\b|\bJPY\b|\bGBP\b/.test(T)) return 'FX';
    // sem pista: no exterior, o mais provável é a moeda do destino
    return cod && cod !== 'BRL' ? 'FX' : 'BRL';
  }

  /* ---------- categoria ---------- */
  const PISTAS = {
    'Alimentação': /restaurant|resto\b|bar\b|caf[eé]|coffee|lanch|pizza|padaria|bakery|burger|sushi|izakaya|ramen|churrasc|cantina|bistr[oô]|food|grill|mercado|supermerc|market|deli\b|doceria|sorvete|gelater|trattoria|osteria|taverna|brasserie|cervejaria|pub\b|steak|noodle|curry|tapas|pastel|a[çc]a[íi]|creper|wok\b|kitchen|cozinha|empor[ií]o|rotisseri/i,
    'Hospedagem': /hotel|hostel|pousada|\binn\b|ryokan|resort|airbnb|booking|hospedagem|di[áa]ria|lodge|guest\s*house/i,
    'Passeio': /tour|museu|museum|ingresso|ticket|parque|\bpark\b|\bzoo\b|aqu[áa]rio|aquarium|cinema|teatro|theat|show|passeio|entrada|admission|galeria|castle|templo|temple|shrine/i,
    'Compras': /loja|store|\bshop|shopping|outlet|souvenir|lembran|boutique|duty\s*free|magazin|department|livraria|papelaria|perfumaria|joalheri|[óo]tica\b/i,
    'Saúde': /farm[áa]cia|pharmac|drogaria|drugstore|cl[íi]nica|clinic|hospital|m[ée]dic|doctor|dentist|[óo]tica/i,
    'Carro': /posto|gasolin|combust[íi]vel|fuel|\bgas\b|shell|petrobras|ipiranga|estacionamento|parking|ped[áa]gio|toll|rent\s*a\s*car|locadora|avis|hertz/i,
    'Transporte': /t[áa]xi|\buber\b|metr[oô]|subway|trem|train|[ôo]nibus|\bbus\b|passagem|bilhete|\bjr\b|airport|aeroporto|ferry|balsa/i,
    'Presentes': /presente|\bgift\b|souven/i,
  };

  function acharCategoria(texto) {
    const disponiveis = Store.state.categorias;
    let melhor = null, pontos = 0;
    for (const [cat, re] of Object.entries(PISTAS)) {
      if (!disponiveis.includes(cat)) continue;
      const n = (texto.match(new RegExp(re.source, 'gi')) || []).length;
      if (n > pontos) { pontos = n; melhor = cat; }
    }
    return melhor;
  }

  /* ---------- estabelecimento ---------- */
  function acharNome(linhas) {
    for (const L of linhas.slice(0, 6)) {
      const s = L.trim();
      if (s.length < 3 || s.length > 42) continue;
      const letras = (s.match(/[A-Za-zÀ-ÿ]/g) || []).length;
      if (letras < 3 || letras / s.length < 0.5) continue;
      if (/^(cnpj|cpf|tel|fone|rua|av\.|avenida|data|hora)/i.test(s)) continue;
      return s.replace(/\s{2,}/g, ' ');
    }
    return '';
  }

  function interpretar(texto) {
    const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);
    const t = acharValor(linhas);
    const d = acharData(texto);
    return {
      texto,
      valor: t ? t.valor : null,
      linhaValor: t ? t.fonte : '',
      data: d ? d.iso : null,
      dataAmbigua: !!(d && d.ambigua),
      base: acharMoeda(texto),
      categoria: acharCategoria(texto),
      nome: acharNome(linhas),
    };
  }

  async function ler(file, progresso) {
    onProg = m => {
      if (!progresso) return;
      if (m.status === 'recognizing text') progresso('lendo a nota', m.progress);
      else if (/traineddata|core|initializ|load/i.test(m.status)) progresso('preparando o leitor', m.progress);
    };
    const img = await preparar(file);
    const w = await worker();
    progresso && progresso('lendo a nota', 0);
    const { data } = await w.recognize(img);
    onProg = null;
    return { ...interpretar(data.text || ''), confianca: data.confidence };
  }

  return { ler, interpretar, valorDe, preparar };
})();
