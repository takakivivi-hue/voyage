# Voyage

App de planejamento, roteiro e controle financeiro de viagem. Funciona no celular,
offline, e guarda tudo no próprio aparelho — sem conta, sem servidor, sem nuvem.

## Como abrir

**No computador**

```bash
python3 serve.py
```

Depois abra `http://localhost:4173`.

**No celular (o jeito que vale a pena)**

1. Com o computador e o celular na mesma rede Wi-Fi, rode `python3 serve.py`.
   Ele imprime o endereço do celular, algo como `http://192.168.68.104:4173`.
2. Digite esse endereço no navegador do celular.
3. No Safari: Compartilhar → *Adicionar à Tela de Início*. No Chrome: menu →
   *Instalar app*. Ele passa a abrir em tela cheia, como um app.

Pela rede local o endereço é `http://`, e isso tem uma consequência: o app
abre e funciona, mas **não instala de verdade e não roda offline**. Veja a
seção seguinte.

Para levar na viagem sem depender do computador, vale hospedar a pasta em
qualquer serviço estático gratuito (Netlify Drop, GitHub Pages, Vercel) —
são arquivos soltos, não precisa build.

## Instalar como app (PWA)

O app é um PWA: tem manifest, service worker, ícones e atalhos. Mas o navegador
só liga instalação e modo offline em **contexto seguro** — `https://` ou
`localhost`. Num endereço `http://192.168.x.x` ele se recusa, em silêncio. Essa
é uma regra do navegador, não uma limitação do app.

Na prática:

| Onde você abre | Abre e usa | Instala na tela | Funciona offline |
|---|---|---|---|
| `localhost` no computador | sim | — | sim |
| `http://192.168.x.x` no celular | sim | atalho, mas sem offline | **não** |
| `https://...` (hospedado) | sim | sim | sim |

Para a viagem, o que vale é a terceira linha. A pasta inteira é estática — sem
build, sem servidor — então qualquer hospedagem gratuita serve:

### Publicando no GitHub Pages

O repositório já está inicializado e com o primeiro commit feito.

1. Crie um repositório vazio em <https://github.com/new> com o nome `voyage`,
   marcado como **Public** e **sem** README, .gitignore ou licença.
   (Pages em repositório privado só funciona em conta paga. O código fica
   público; os seus dados de viagem não — eles nunca entram no repositório,
   vivem no navegador do seu celular.)
2. No terminal, trocando `SEU-USUARIO`:

   ```bash
   git remote add origin https://github.com/SEU-USUARIO/voyage.git
   git push -u origin main
   ```

3. No repositório: **Settings → Pages → Source: Deploy from a branch →
   `main` / `(root)` → Save**.
4. Em um ou dois minutos o app está em
   `https://SEU-USUARIO.github.io/voyage/`.

Quando o app mudar, um `git push` publica a versão nova; quem já tem o app
instalado recebe o aviso de atualização na próxima vez que abrir.

O arquivo `.nojekyll` na raiz existe para o Pages publicar os arquivos como
estão, sem passar pelo Jekyll.

Com o endereço `https://` aberto no celular:

- **iPhone (Safari)** — Compartilhar → *Adicionar à Tela de Início*.
  Tem que ser o Safari; no Chrome do iPhone a opção não existe.
- **Android (Chrome)** — menu ⋮ → *Instalar app*.

Depois de instalado ele abre em tela cheia, sem barra de endereço, com ícone
próprio, e sobrevive ao modo avião.

**Ajustes → Instalação e offline** mostra um diagnóstico de cinco linhas
dizendo exatamente o que já está pronto e o que falta — inclusive se o app já
guardou a si mesmo para uso offline e se o leitor de notas já foi baixado.

### O que fica guardado para offline

O service worker guarda o casco do app (html, css, js, ícones) na primeira
visita e passa a servir do cache, revalidando por baixo — abrir fica
instantâneo mesmo em roaming ruim. Os 9 MB do leitor de notas só são baixados
quando você usa a câmera pela primeira vez, ou de uma vez pelo botão em
*Ajustes → Leitor de notas*. Os dados da viagem nunca passam pelo cache: vivem
em `localStorage` e `IndexedDB`, no aparelho.

Quando uma versão nova é publicada, o app avisa com um toque na tela; tocar
recarrega já na versão nova.

## As seis abas

| Aba | O que faz |
|---|---|
| **Resumo** | Dados da viagem: ida, hospedagem, transfer, aluguel de carro e retorno, com todos os campos de voo, reserva, telefone e horário. Mostra contagem regressiva, progresso dos preparativos e quanto já foi gasto do orçamento. |
| **Plano** | Checklist dos preparativos (passagem, hotel, passaporte, vacina, ingressos, seguro, quem leva ao aeroporto…), cada um com grupo, prazo, responsável, custo e **anexos** — voucher, ingresso, contrato. Filtra por grupo e por pendente/resolvido. |
| **Agenda** | Calendário do mês e roteiro dia a dia. Os pontinhos marcam dia com programação, com gasto e com prazo. Clicar no dia abre tudo daquele dia: o que fazer, o que foi gasto e os prazos do plano. Cada compromisso é *planejado*, *realizado* ou *não aconteceu*. |
| **Gastos** | Controle em duas moedas com previsto × realizado, por período e por grupo. |
| **Acerto** | A conta do grupo: quanto cada viajante pagou, quanto deveria ter pago e quem transfere para quem no final. Por dia ou pela viagem inteira. |
| **Mala** | Check list de bagagem por grupo: roupas, acessórios, calçados, remédios, suplementos, receitas médicas, documentos, eletrônicos, higiene. |

## Como funciona a conversão de moeda

Cada valor é guardado **na moeda em que você digitou**, junto com a informação de
qual foi. A outra coluna é sempre calculada na hora pela cotação atual.

- Digitou em reais → a coluna em moeda estrangeira aparece convertida.
- Digitou na moeda do país → a coluna em reais aparece convertida.
- Mudou a cotação → **todo o histórico é reconvertido na hora**, porque nada foi
  gravado como número convertido.

A cotação é sua: você escolhe o valor que quer usar (o do cartão, o da casa de
câmbio, a média que preferir) no botão ⇄ do topo ou em Ajustes. O app nunca
busca cotação na internet.

## Previsto × realizado

Os dois aparecem lado a lado em todo lugar:

- **Gastos** — cada lançamento tem uma coluna *Previsto* e uma *Realizado*,
  as duas em reais e na moeda local. O resumo mostra a diferença e a
  porcentagem; a barra por grupo desenha o realizado sobre o previsto.
- **Agenda** — cada compromisso nasce *planejado* e você marca como *realizado*
  (ou *não aconteceu*) durante a viagem, com o custo previsto ao lado.

## Dividir os gastos do grupo

Cadastre os viajantes em **Ajustes → Viajantes**. A partir daí, cada gasto
guarda duas informações a mais:

- **Quem pagou** — a pessoa que botou a mão no bolso na hora.
- **Divisão** — entre quem aquele gasto se reparte. Três modos:
  - *Todos* — igual entre todos os viajantes (o caso comum).
  - *Escolher quem* — igual entre os selecionados (o táxi que só dois pegaram).
  - *Valor por pessoa* — cada um com o seu valor (o jantar em que cada prato
    custou diferente). O que sobrar do total — couvert, gorjeta, taxa — é
    rateado igualmente entre quem tem valor lançado.

A aba **Acerto** fecha a conta:

- quanto cada um **pagou** e quanto **deveria ter pago**;
- o **saldo** de cada viajante — quem tem a receber e quem tem a pagar;
- **como acertar**: a menor lista possível de transferências ("Diego paga
  Vivian R$ 250,00"). Toque numa linha para registrar que o pagamento foi feito,
  e o saldo se atualiza;
- **Compartilhar resumo**: monta um texto pronto para o grupo, com o saldo de
  cada um e a lista de quem paga quem. No celular abre direto a tela de
  compartilhar (WhatsApp, e-mail); no computador, copia para colar. As linhas
  cabem em 40 colunas de propósito, para não quebrarem no WhatsApp. Respeita o
  período escolhido — dá para mandar o fechamento de um dia só.

Como o app não sincroniza entre aparelhos, esse botão é o que mantém o grupo
informado: uma pessoa é o caixa e manda o resumo no fim do dia.

Tudo acerta em reais. As contas são feitas em centavos inteiros, então a soma
das partes bate exatamente com o total — R$ 100 entre 7 vira 4×14,29 + 3×14,28,
e não sete valores que deixam centavo sobrando.

Gastos sem pagador definido não entram no acerto; a tela avisa quantos são e
leva direto para corrigi-los.

## Ler a nota pela foto

Na aba Gastos, o botão de câmera abre a câmera do celular. O app lê a foto e
preenche um rascunho com **data**, **valor**, **moeda**, **estabelecimento** e
**grupo** — e sempre mostra uma tela de conferência antes de salvar, dizendo de
qual linha da nota tirou cada valor. A foto fica anexada ao gasto.

A leitura roda inteiramente dentro do aparelho: nenhuma foto sai do celular e
não é preciso internet. Em compensação, a precisão depende muito da foto:

- cupom impresso, reto e bem iluminado costuma sair certo;
- papel térmico apagado, nota amassada ou foto torta erram bastante;
- notas em alfabeto não latino (japonês, árabe, tailandês) não são lidas — só
  os números costumam sair.

Quando a nota escreve a data só com números (`11/03/2026`), não há como saber se
é 11 de março ou 3 de novembro — o app avisa que a data está ambígua em vez de
chutar calado.

O pior caso é digitar como antes, com a foto já anexada. **Antes de viajar**,
vá em *Ajustes → Leitor de notas* e toque em *Baixar agora para uso offline*:
são cerca de 9 MB que precisam ser baixados uma única vez.

## Onde ficam os dados

No navegador do aparelho: textos e valores em `localStorage`, anexos em
`IndexedDB`. Nada sai dali. Por isso:

- Use **Ajustes → Exportar arquivo** de vez em quando. O backup é um `.json`
  único, com os anexos embutidos, e pode ser importado em outro celular.
- Limpar os dados do site no navegador apaga a viagem. Exporte antes.

## Estrutura

```
index.html          casco do app e barra de abas
styles.css          design system (paleta, vidro, tipografia)
serve.py            servidor local para desenvolvimento
sw.js               cache offline
manifest.json       instalação como app
js/store.js         estado da viagem e persistência
js/db.js            anexos em IndexedDB
js/ui.js            formatação, conversão, sheets e formulários
js/split.js         rateio e acerto (centavos inteiros, sem perda)
js/ocr.js           leitura da nota pela foto
js/pwa.js           instalação, atualização e diagnóstico offline
js/view-*.js        uma tela por arquivo
vendor/             motor de OCR offline (Tesseract + dados de idioma)
```

## Design

Paleta *quiet luxury* sobre vidro: areia `#F4F1EA` de fundo, azul-noite
`#1D2A44` em texto e navegação, dourado champagne `#D4AF37` restrito a ações
principais e marcadores. Títulos em Playfair Display, números e listas em Inter.
Modo escuro automático pelo tema do sistema.
