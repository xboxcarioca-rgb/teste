# DTFLEXPRO — plataforma completa para produção DTF

Landing page + ferramentas profissionais de DTF em uma só aplicação: **Halftone inteligente**, **Biblioteca de Artes**, **Gestão DTF**, **Montagem (gang sheet)**, **Estúdio de Mockups**, **Catálogo em Lote** e **Calculadora DTF**.

> Última versão consolidada: landing page atualizada com todas as ferramentas, correções do Catálogo em Lote (criação, erros por arquivo e PDF automático) e migração do bucket de storage.

---

## Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | [TanStack Start](https://tanstack.com/start) + React 19 + Vite 7 |
| Linguagem | TypeScript (strict) |
| Estilos | Tailwind CSS 4 + shadcn/ui (Radix) |
| Backend/DB | Supabase (Postgres + Storage + Auth) via server functions |
| Migrações | Drizzle (`drizzle/migrations`) |
| PDF | jsPDF (Catálogo em Lote) |
| Canvas/Foto | fabric, `@imgly/background-removal`, ImageBitmap |
| Desktop | Electron + NSIS (`electron/`, `setup.nsi`) |
| Deploy | Cloudflare (Wrangler/Nitro) ou qualquer host Node/estático |

## Ferramentas

| Ferramenta | Onde vive |
| --- | --- |
| Halftone Engine (retícula, A2/A3/A4 300 DPI, tecido preto/branco/colorido) | `public/dtflex-tool/` (bundle embutido no iframe de `/app`) |
| Biblioteca de Artes (Drive com capas, busca, envio direto ao Halftone) | `src/components/ArtLibrary.tsx` |
| Gestão DTF (pedidos, clientes, estoque, financeiro, relatórios) | `src/components/DTFBusinessManager.tsx` |
| Montagem DTF / gang sheet (folhas 58×100 cm, PNG/PDF 300 DPI) | `src/components/DTFGangSheetStudio.tsx` |
| Estúdio de Mockups (camisas frente/costas, cores, sem marca d'água) | `src/components/landing/shirt-studio/` |
| Catálogo em Lote (20–100 PNGs → mockups + códigos + PDF) | `src/components/BatchCatalogStudio.tsx` + `src/lib/catalog.functions.ts` |
| Calculadora DTF | `src/components/DTFCalculatorDialog.tsx` |
| Removedor de fundos | overlay externo (`ExternalToolOverlay`) |

**Landing page:** `src/components/LandingPage.tsx` + `src/components/landing/*`
(Hero, PlatformSuite, Features, ShirtStudio, Pricing, FAQ, Afiliado… — rota `/`).

**Rotas principais:** `/` (landing), `/login` (código de acesso), `/app` (ferramentas), `/afiliado`, `/pagamento`, `/pedido`, `/admin`, `/catalogo/:token` (catálogo publicado), `/sobre-halftone`.

## Como rodar

```bash
# 1) dependências (bun recomendado — há bun.lock; npm também funciona)
bun install            # ou: npm install

# 2) variáveis de ambiente
cp .env.example .env   # preencha SESSION_SECRET e SUPABASE_SERVICE_ROLE_KEY

# 3) desenvolvimento
bun run dev            # ou: npm run dev

# 4) produção
bun run build          # vite build → .output/
bun run preview        # serve do build
```

Scripts disponíveis: `dev`, `build`, `build:dev`, `preview`, `lint`, `format`.

### Variáveis de ambiente

Obrigatórias no servidor: `SESSION_SECRET` (assina cookies de sessão) e
`SUPABASE_SERVICE_ROLE_KEY` (server functions). Sem elas, login, catálogo e
biblioteca respondem erro de configuração — veja `.env.example` para a lista
completa (`APP_URL`, `RESEND_API_KEY`, webhooks, `LOVABLE_API_KEY`…).

> ⚠️ A chave `service_role` e o `SESSION_SECRET` **não** podem ser commitados.

### Banco e Storage

Migrações em `drizzle/migrations/` (aplicar na ordem do `_journal.json`):

- `0000` — tabelas `catalog_batches`, `catalog_products`, `catalog_templates` (+RLS service_role)
- `0001`/`0002` — remoção de policies redundantes
- `0003` — **bucket `catalog-assets`** (necessário para o Catálogo em Lote; sem ele todo upload falha)

Também existem migrações históricas em `supabase/migrations/`.

## Estrutura

```
src/
├── routes/            # rotas file-based (index, app, login, admin, api…)
├── components/
│   ├── landing/       # blocos da landing page
│   ├── admin/         # painel admin (pedidos halftone)
│   └── *.tsx          # ferramentas (biblioteca, gestão, montagem, catálogo…)
├── lib/               # regras de negócio (access, catalog, affiliate…)
├── integrations/      # cliente Supabase (browser + service role no server)
public/dtflex-tool/    # bundle da ferramenta de halftone (não editar o JS minificado)
electron/              # app desktop Windows
drizzle/migrations/    # SQL das tabelas/bucket
mem/ e roadmap.md      # memória do projeto e pendências
```

## Notas importantes

- **300 DPI real:** todo PNG exportado pelo halftone leva chunk `pHYs` (11811 px/m). O patch fica em `public/dtflex-tool/index.html`.
- **Não editar** `public/dtflex-tool/assets/index-*.js` (bundle minificado do halftone — comportamento já validado).
- **Anti-print:** `/app` bloqueia Ctrl+P, PrintScreen, contexto e devtools.
- **1 dispositivo por conta:** sessão de acesso com heartbeat e expiração visível no topo.
- **Catálogo em Lote:** as configurações são congeladas no início da fila (arquivos do meio da execução não mudam mais), `createImageBitmap` tem fallback para navegadores sem suporte, uploads aguardam todos os envios (`Promise.allSettled`) e o PDF é montado em blocos com download automático ao final.

## Roadmap (ver `roadmap.md`)

Pendência conhecida: arrasto manual da arte no enquadramento A2/A3/A4 com
persistência da posição no PNG final — requer alteração no **fonte** da
ferramenta de halftone (o bundle minificado em `public/dtflex-tool/` está
propositadamente travado por memória do projeto).
