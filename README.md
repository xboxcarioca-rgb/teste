# DTFLEXPRO

Plataforma web (+ app Windows via Electron) para **halftone/retícula DTF profissional**:
landing page de vendas, ferramenta de halftone com exportação A2/A3/A4 em **300 DPI**,
biblioteca de artes conectada ao Google Drive, montagem de folha (gang sheet), mockups de
camisetas, catálogo em lote, Gestão DTF (negócio/produção), assinaturas (cartão e PIX) e
acesso por e-mail + código, com limite de dispositivos.

> Este repositório recebeu o projeto **inteiro** a partir de `dtflex.zip` (Google Drive,
> 24/out/2026 — 257 arquivos, ~57 MB descompactado). A análise completa do que veio no zip,
> da arquitetura e dos problemas encontrados está em **[ANALISE.md](./ANALISE.md)**.
> O zip original não tinha README — este arquivo foi criado na importação.

## Stack

| Camada | Tecnologia |
|---|---|
| Web app | React 19 + TypeScript + TanStack Start/Router (SSR) + Vite 7 (`@lovable.dev/vite-tanstack-config`) |
| UI | Tailwind CSS 4 + shadcn/ui (Radix) + lucide-react + fabric.js (canvas de mockups) |
| Banco / Auth | Supabase (Postgres + RLS) — 24 tabelas; migrations em `supabase/migrations` (14) e `drizzle/migrations` (8) |
| Pagamentos | Stripe via gateway Lovable (planos R$ 47/mês e R$ 147/ano; PIX = pagamento único que estende o acesso) + webhook InfinitePay legado |
| Ferramenta DTF | Bundle estático próprio em `public/dtflex-tool/` (iframe) — **não alterar** (ver `mem/index.md`) |
| Desktop | Electron (`electron/main.cjs`) servindo a cópia estática em `app/` 100% offline + instalador NSIS (`setup.nsi`) |
| Deploy web | Cloudflare Workers (`wrangler.jsonc`, Nitro) |

## Como rodar (web)

```bash
# ATENCAO: os lockfiles originais apontam para um espelho npm interno do Lovable
# e nao instalam fora dele (ver ANALISE.md, item 5.1). Fora do Lovable, regenere:
rm -f package-lock.json bun.lock
npm install
cp .env.example .env   # preencha as variáveis (ver abaixo)
npm run dev        # vite dev
npm run build      # vite build
npm test           # vitest (1 arquivo de teste: src/lib/payment-catalog.test.ts)
npm run lint       # eslint
```

### Variáveis de ambiente

Veja [`.env.example`](./.env.example). Os `.env` reais que vieram no zip **não foram
commitados** (este repositório é público) — eles continham apenas chaves publicáveis
(Supabase publishable e `pk_test_`/`pk_live_` de pagamentos). As chaves **de servidor**
(`SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `STRIPE_*_API_KEY`,
`PAYMENTS_*_WEBHOOK_SECRET`, `LOVABLE_API_KEY`, `RESEND_API_KEY`,
`ADMIN_MASTER_PASSWORD`…) **não vinham no zip**: vivem no ambiente de hospedagem.
Sem elas, a landing abre, mas login por código, checkout/webhooks e funções admin não funcionam.

## Estrutura

```
src/
  routes/          # rotas TanStack (index, app, login, pagamento, admin, afiliado,
                   #   catalogo.$token, api/public/* webhooks e ativacao desktop, mcp…)
  components/      # landing/, ui/ (shadcn), ArtLibrary, DTFGangSheetStudio,
                   #   DTFBusinessManager, BatchCatalogStudio, SmartCutoutStudio…
  lib/             # server functions: acesso, pagamentos, drive-library, catalogos,
                   #   halftone-orders, afiliados, mcp/, stripe.server, payment-catalog
  integrations/supabase/  # clientes (browser, server/service-role) e types gerados
  assets/          # mockups de camisetas, hero-video.mp4 (25 MB), demos
public/dtflex-tool/  # ferramenta halftone compilada (iframe) + patch 300 DPI (pHYs)
app/               # copia estatica da ferramenta usada pelo Electron (offline)
electron/          # app Windows: main, preload, licenca/ativacao, splash, icones
supabase/ drizzle/ # migrations do banco
mem/  .lovable/plan/  roadmap.md  AGENTS.md   # memoria/decisoes do projeto (Lovable)
```

## Regras que não podem quebrar (do próprio projeto)

Resumo de `AGENTS.md` + `mem/index.md` — leia os originais antes de mexer:

- Todo PNG exportado pelo halftone precisa ter **300 DPI reais** nos metadados
  (chunk `pHYs` = 11811 px/m); o patch fica em `public/dtflex-tool/index.html`.
- **Não alterar** o bundle minificado `public/dtflex-tool/assets/index-*.js`.
- O enquadramento A2/A3/A4 confirmado no upload é a fonte única do PNG final;
  não reenquadrar pelo Alpha depois da retícula.
- Preços/planos só em `src/lib/payment-catalog.ts`, validados no servidor;
  toda compra de plano passa pelo **único** webhook público de pagamentos.
- Assinatura pertence à identidade `user_access` (e-mail + código), não ao Auth;
  limite de dispositivos usa sessões duráveis por dispositivo (web + desktop).

## Planos (catálogo atual)

| Plano | Cartão (recorrente) | PIX (único) | Acesso |
|---|---|---|---|
| Mensal | R$ 47 | R$ 47 | 30 dias |
| Anual | R$ 147 | R$ 147 | 365 dias |

Fonte: `src/lib/payment-catalog.ts`. Cobranças reais constam como bloqueadas no
`roadmap.md` até concluir a ativação da conta de pagamentos (checkout validado em teste).
