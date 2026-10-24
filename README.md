# DTFLEXPRO 2410 — plataforma completa para produção DTF

> **Identificador: 2410** · projeto `dtflexpro` · branch de trabalho `arena/9152127f-teste`

Landing page + ferramentas profissionais de DTF em uma só aplicação: **Halftone inteligente**, **Biblioteca de Artes**, **Gestão DTF**, **Montagem (gang sheet)**, **Estúdio de Mockups**, **Catálogo em Lote** e **Calculadora DTF**.

> Última versão consolidada (pacote de 24/10): projeto completo com **checkout Stripe embutido** (cartão + PIX),
> páginas de retorno/confirmação de compra, webhooks de pagamento, gestão de assinatura, ativação do app desktop,
> distribuição do instalador Windows, fila de e-mails e **migrations 0003 a 0008**. Mantém as correções do Catálogo
> em Lote e a landing page com todas as ferramentas. O bloco de planos da landing abre o checkout da **Kiwify**.

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

### Diagnóstico rápido do deploy: `/api/health`

Abra `https://SEU-DOMINIO/api/health`. Ele responde **apenas se** cada variável
existe (nunca o valor) e se o banco está acessível:

```json
{
  "ok": false,
  "login": "indisponível",
  "missing": [
    { "variable": "SUPABASE_SERVICE_ROLE_KEY",
      "ondeObter": "Supabase → Project Settings → API → service_role (secreta)" }
  ],
  "database": { "reachable": false }
}
```

`ok: true` + `HTTP 200` significa que o login está pronto. `503` com `missing`
lista exatamente o que falta configurar.

## Se o login (e-mail + código) parar de funcionar

O app identifica o dispositivo por `device_key_hash` e guarda a sessão em
`session_token_hash` (migrations `0006`/`0007`). Em banco que ainda está no
schema antigo a gravação falha e o login é recusado mesmo com o código certo.

**Correção:** rode `supabase/repair-access-login.sql` no **SQL Editor** do
Supabase (idempotente, não apaga dados). No fim ele executa
`NOTIFY pgrst, 'reload schema'`, que limpa o cache de colunas da API.

Também confira no ambiente do servidor:

| Variável | Efeito se faltar |
| --- | --- |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Nenhuma server function funciona (login, código, catálogo, admin) |
| `SESSION_SECRET` | Não é possível assinar o cookie de sessão |

O código agora devolve uma mensagem explícita quando essas variáveis faltam, em
vez de "Código inválido ou expirado".

## Pagamentos e acesso

| Fluxo | Implementação |
| --- | --- |
| Planos na landing (`#precos`) | Botão abre a Kiwify (`mensal` / `anual`) em nova aba; ao voltar com `?comprou=1` aparece a faixa "Acabei de comprar" com o WhatsApp de suporte |
| Checkout no site (`/pagamento`) | Stripe Embedded Checkout — cartão (assinatura) e PIX (pagamento único que estende o acesso) |
| Retorno / confirmação | `/pagamento-retorno` e `/confirmar-compra` |
| Webhooks | `src/routes/api/public/payments/webhook.ts` (Stripe) e `api/public/infinitepay-webhook.ts` (legado, pedido avulso R$ 5) |
| Assinatura | `src/components/SubscriptionManager.tsx` + `src/lib/payments.functions.ts` |
| App desktop | `api/public/download-windows.ts` (instalador) e `api/public/desktop-activate.ts` (ativação por código) |
| E-mails | `src/routes/lovable/email/queue/process.ts` (fila) |

> Sem `VITE_PAYMENTS_CLIENT_TOKEN` a tela `/pagamento` entra em modo de teste (aviso) — veja `.env.example`.

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
cp .env.example .env    # produção/hosting: preencha todos os valores
# Em desenvolvimento local, prefira .env.local (ignorado pelo git):
#   echo 'SESSION_SECRET="'$(openssl rand -hex 32)'"' >> .env.local
#   echo 'SUPABASE_SERVICE_ROLE_KEY="sua-chave"' >> .env.local

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
