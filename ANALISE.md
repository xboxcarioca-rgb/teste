# Análise do projeto — `dtflex.zip` (DTFLEXPRO)

Análise feita na importação do projeto inteiro para este repositório, em 24/out/2026.

## 1. Origem e integridade

| Item | Valor |
|---|---|
| Arquivo | `dtflex.zip` (Google Drive, id `1P9-WKBASwFuSshqLyMJaLIky93CTe_6I`, pasta “projeto”) |
| Tamanho | 56.899.121 bytes (~54 MB) |
| MD5 conferido | `0269166f0b8cf74135aa2858e3dd2016` — bate com o metadado do Drive |
| Conteúdo | 257 arquivos, ~57,3 MB descompactado, sem caminhos perigosos (zip-slip) |
| Origem do código | Projeto **Lovable** (TanStack Start) — pastas `.lovable/plan/` (12 planos), `mem/` (9 memórias), `AGENTS.md`, `@lovable.dev/*` nas dependências |

A pasta inicialmente linkada (“projeto dtf”) estava vazia; o projeto válido é este zip.

## 2. O que é o produto

**DTFLEXPRO** — SaaS para quem trabalha com impressão DTF ( dtflexpro.com ):

1. **Landing page** de vendas (`/`) com hero em vídeo, estúdio de mockup de camiseta
   interativo, preços, FAQ, prova social e botão de WhatsApp.
2. **Ferramenta Halftone** (`/app`): gera retícula (Rosette CMYK / Round Clean) e exporta
   PNG transparente **A2/A3/A4 a 300 DPI reais**, com motores por cor de tecido
   (preto = fluxo com remoção; branco/colorido = “Halftone Universal” só PNG, sem remoção,
   preservando Alpha e cores). A ferramenta em si é um **bundle estático separado**
   servido em iframe (`public/dtflex-tool/`), com um patch que injeta o chunk `pHYs`
   (11811 px/m) no PNG — documentado como intocável em `mem/index.md`.
3. **Biblioteca de Artes** conectada ao **Google Drive** do operador
   (`drive-library.*`, `api/drive-file`): navegação por pastas com capas rotativas,
   classificação automática A2/A3/A4 e “halftone”, envio direto Biblioteca → Halftone.
4. **Ferramentas**: montagem de folha/gang sheet (`DTFGangSheetStudio`), recorte
   inteligente/remoção de fundo (`SmartCutoutStudio`, `@imgly/background-removal`),
   melhorador de imagem, calculadora DTF, **Catálogo em Lote** (20–100 PNGs → mockups →
   PDF/ZIP e catálogo online por token em `/catalogo/$token`) e **Gestão DTF**
   (`DTFBusinessManager`, dados isolados por cliente).
5. **Comercial**: acesso por **e-mail + código** (identidade própria `user_access`, sem
   senha/Auth tradicional), limite de dispositivos com sessões duráveis compartilhadas
   entre web e desktop, planos **R$ 47/mês** e **R$ 147/ano** (cartão recorrente via
   Stripe ou PIX único que estende o acesso), confirmação de compra, afiliados
   (`/afiliado`, `/$slug`), admin de pedidos de halftone, e **app Windows (Electron)**
   100% offline com ativação por licença (`desktop-activate`, `electron/license.cjs`,
   instalador NSIS em `setup.nsi`).
6. **Integrações de agente**: servidor **MCP** (`/mcp`, `src/lib/mcp/`) com ferramentas
   de conta/assinatura/planos, OAuth consent do Lovable e fila de e-mails.

## 3. Arquitetura e números

- **~29.650 linhas** de código/docs: 92 arquivos `.tsx` (14.932 linhas), 48 `.ts`
  (7.462), 22 `.sql` (1.103), 4 `.html` (4.408 — inclui as ferramentas estáticas).
- **24 rotas** em `src/routes/` (páginas, APIs públicas de webhook/ativação/download,
  MCP, OAuth, fila de e-mail).
- **30 componentes** próprios (fora os ~48 de `components/ui/` do shadcn) e
  **25 módulos** em `src/lib/` (server functions do TanStack Start).
- **Banco Supabase** com **24 tabelas** (`user_access`, `access_subscriptions`,
  `access_device_sessions`, `payments`, `payment_webhook_events`, `plans`,
  `subscriptions`, `catalog_batches/products/templates`, `halftone_orders`,
  `affiliates`, `affiliate_sales`, tabelas de e-mail/auditoria/segurança…),
  14 migrations em `supabase/migrations/` + 8 em `drizzle/migrations/`.
- **Assets pesados**: `src/assets/hero-video.mp4` (25,3 MB) + 20 PNGs de mockups de
  camiseta (~25 MB no total) — juntos, ~88% do tamanho do projeto.
- **Testes**: apenas **1 arquivo** (`src/lib/payment-catalog.test.ts`, Vitest).
  Nenhum `TODO/FIXME` no código-fonte.

## 4. Segurança — o que foi verificado

- **Nenhum segredo de servidor vazado no código**: sem `sk_live/sk_test`, `whsec_` ou
  chaves privadas hardcoded. `SUPABASE_SERVICE_ROLE_KEY`, chaves Stripe do gateway,
  segredos de webhook etc. são lidos de `process.env` no servidor
  (`stripe.server.ts`, `client.server.ts`) — e **não vinham no zip** (ficam na hospedagem).
- Os `.env` do zip têm só chaves **publicáveis** (Supabase publishable/anon e
  `pk_test_`/`pk_live_` de pagamentos). Mesmo assim, como este repositório é **público**,
  os 3 arquivos `.env*` **não foram commitados**: foram incluídos no `.gitignore` e
  substituídos por [`.env.example`](./.env.example) com os nomes das variáveis.
  Os arquivos reais continuam existindo localmente e no zip do Drive.
- Webhook de pagamentos tem verificação própria de assinatura HMAC com tolerância de
  5 min (`verifyWebhook` em `stripe.server.ts`); eventos são reprocessáveis sem
  duplicar acesso (decisão registrada em `AGENTS.md`/`roadmap.md`).
- Pontos de atenção herdados (não corrigidos nesta importação fiel):
  `ADMIN_MASTER_PASSWORD` como senha-mestra por env; rotas `verify-admin` e
  `validate-access-code` na raiz merecem revisão de rate-limit no servidor;
  `electron/main.cjs` desabilita `OutOfBlinkCors` (ok para app offline local, mas é
  uma redução de isolamento a ter ciência); workflow `static.yml` publica o
  **repositório inteiro** no GitHub Pages (path `.`) — revisar antes de ativar Pages
  neste repo, e `npm-publish.yml` é o template padrão do GitHub (publicaria no npm
  em release, com `private: true` no `package.json` ele falharia — é resíduo de template).

## 5. Problemas / dívidas encontrados (sem alterar o original)

1. **Duplicidade de lockfiles**: `bun.lock` **e** `package-lock.json` — escolher um
   gerenciador (o `package.json` se chama `tanstack_start_ts`, nome de template).
2. **Ferramenta duplicada**: `app/` (Electron) e `public/dtflex-tool/` (web) são duas
   cópias parecidas, mas **não idênticas**, do bundle do halftone — risco de divergência;
   inclui ainda um `index-*.js.bak` (backup solto de 254 KB) dentro de `public/`.
3. **Peso para o Git**: vídeo de 25 MB e PNGs de mockup versionados; para crescer,
   o ideal é Git LFS ou CDN/storage. Nesta importação eles foram mantidos (projeto inteiro).
4. **Cobertura de testes mínima** (1 arquivo) para um sistema com pagamentos e licenças.
5. **Acoplamento com o Lovable**: build depende de `@lovable.dev/vite-tanstack-config`,
   gateway de pagamentos/e-mail/MCP do Lovable e envs `LOVABLE_*`. Rodar 100% fora do
   Lovable exige trocar essas peças (principalmente pagamentos e envio de e-mail).
6. **Duas trilhas de migration** (Supabase CLI + Drizzle) para o mesmo banco — funciona,
   mas exige cuidado para não aplicar a mesma mudança duas vezes.
7. Sem `README` no original (criado nesta importação) e `roadmap.md` indica que as
   **cobranças reais ainda estão bloqueadas** aguardando ativação da conta de pagamentos
   (checkout validado em modo de teste).

## 6. O que foi feito nesta importação

- Download do zip do Drive, conferência de MD5 e extração segura.
- Projeto copiado **inteiro** para a raiz deste repositório (257 arquivos originais).
  Únicas diferenças em relação ao zip, ambas documentadas:
  1. `.env`, `.env.development`, `.env.production` **fora do Git** (`.gitignore` +
     `.env.example` novo) por segurança — repositório público;
  2. Arquivos novos de documentação: `README.md` (o repo só tinha “# teste”) e este
     `ANALISE.md`;
  3. Único ajuste em código: `server/preview.allowedHosts: true` em `vite.config.ts`,
     para o dev server aceitar hosts de preview/sandbox além de `localhost`
     (sem efeito em produção). **Todo o resto do código está idêntico ao zip.**
- O `dtflex.zip` em si não foi commitado (duplicaria 54 MB; o original segue no Drive).
- **Verificação local executada** (Node 22, ambiente sem as chaves de servidor da
  hospedagem; instalação feita com lockfile temporário regenerado do npmjs, depois
  descartado — os lockfiles commitados são os originais, MD5 conferido):
  - `npm ci` e `bun install --frozen-lockfile` com os locks originais: **falham**
    fora do Lovable (item 5.1 acima);
  - `npm test` (Vitest): **4/4 testes passaram** (`payment-catalog.test.ts`);
  - `npx tsc --noEmit`: **sem erros**;
  - `npm run build`: **build de produção concluído** (Nitro/Cloudflare, `.output/`
    gerado e descartado — é artefato, está no `.gitignore`).

## 7. Próximos passos sugeridos

1. Preencher o `.env` local a partir do zip e rodar `npm run dev` para validar a landing.
2. Decidir o gerenciador de pacotes (bun **ou** npm) e apagar o outro lockfile.
3. Remover resíduos: `*.js.bak`, workflows de template (`npm-publish.yml`, revisar `static.yml`).
4. Mover `hero-video.mp4` e mockups para Git LFS/CDN se o repo for crescer.
5. Se a ideia é **refazer o projeto de forma diferente** (como pedido antes), usar este
   commit como base histórica e abrir a nova versão em seguida, aproveitando as regras
   de `AGENTS.md`/`mem/` (300 DPI, enquadramento, catálogo de preços único).
