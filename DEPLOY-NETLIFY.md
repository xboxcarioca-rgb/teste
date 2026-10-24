# Publicar o DTFLEXPRO 2410 na Netlify

O projeto é **TanStack Start + Nitro**: tem SSR (server functions para login,
catálogo, pagamentos), então **não é um site estático**. Na Netlify o front vai
para `dist/` e o servidor vira uma Function.

Duas formas — escolha uma.

---

## Opção A — Subir arquivos prontos (mais rápido, sem build na Netlify)

Pacote: **`dtflexpro-2410-netlify.zip`**

Ele já vem **construído**, nesta estrutura:

```
dist/                     → site (HTML, assets, brand, dtflex-tool)
functions/server/         → SSR (o app inteiro roda aqui)
netlify.toml              → publish = "dist", functions = "functions"
```

### A1. Pelo site da Netlify (drag & drop)

1. Descompacte o zip.
2. Entre em **app.netlify.com** → **Sites** → **Add new site** → **Deploy manually**.
3. Arraste a **pasta** que contém `dist`, `functions` e `netlify.toml`.
4. A Netlify lê o `netlify.toml`, publica `dist` e registra a function do SSR.

> Se o arrastar não aceitar a estrutura, use a CLI (A2) — ela respeita o
> `netlify.toml` de forma confiável.

### A2. Pela CLI (recomendado)

```bash
npm install -g netlify-cli
netlify login

unzip dtflexpro-2410-netlify.zip -d dtflexpro-netlify
cd dtflexpro-netlify

netlify deploy --dir=dist --functions=functions --prod
```

A CLI sobe `dist` + a function e devolve a URL do site.

---

## Opção B — Conectar o repositório do GitHub (build automático)

1. Netlify → **Add new site** → **Import an existing project** → GitHub →
   escolha o repositório.
2. A Netlify lê o `netlify.toml` da raiz e já configura:
   - **Build command:** `DEPLOY_TARGET=netlify npm run build`
   - **Publish directory:** `dist`
   - **Functions directory:** `.netlify/functions-internal`
3. **Não** precisa mudar nada — só confirmar.
4. Cada push na branch escolhida gera um deploy novo.

> Para buildar localmente do mesmo jeito: `npm run build:netlify`

---

## Variáveis de ambiente (obrigatório)

Netlify → **Site configuration** → **Environment variables**:

| Variável | Valor |
| --- | --- |
| `SUPABASE_URL` | `https://ifollbyypwxnkddepxae.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | chave `service_role` do Supabase (**secreta**) |
| `SUPABASE_PUBLISHABLE_KEY` | chave `anon public` |
| `VITE_SUPABASE_URL` | `https://ifollbyypwxnkddepxae.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | chave `anon public` |
| `SESSION_SECRET` | `openssl rand -hex 32` |
| `APP_URL` | `https://SEU-SITE.netlify.app` |

Opcionais (só se usar o recurso): `RESEND_API_KEY`, `LOVABLE_API_KEY`,
`LOVABLE_SEND_URL`, `VITE_PAYMENTS_CLIENT_TOKEN`, `STRIPE_WEBHOOK_SECRET`,
`INFINITEPAY_WEBHOOK_SECRET`, `ADMIN_MASTER_PASSWORD`.

> ⚠️ **Variável só entra em deploy novo.** Depois de salvar, faça
> **Deploys → Trigger deploy → Deploy site** (ou rode `netlify deploy --prod` de novo).

---

## Como saber se subiu certo

Abra **`https://SEU-SITE.netlify.app/api/health`**.

```json
{ "ok": true, "login": "pronto", "missing": [], "database": { "reachable": true } }
```

- `200` + `"ok": true` → login funcionando.
- `503` + `missing: [...]` → falta configurar a variável listada.
- `database.reachable: false` → a chave existe mas o banco recusou (URL errada
  ou chave de outro projeto).

---

## Antes do login funcionar de fato

O banco precisa ter as colunas que o código exige. No **SQL Editor** do Supabase,
rode (nesta ordem, do pacote `dtflexpro-2410-banco.zip`):

1. `01-schema.sql`
2. `06-meu-acesso.sql` (seu acesso: `xboxcarioca@gmail.com`)

---

## Limitações da Netlify que valem saber

| Item | Detalhe |
| --- | --- |
| Tempo da function | 10 s (padrão) / 26 s no plano Pro. Geração de catálogo em lote é no navegador, então não afeta. |
| Tamanho | Este deploy tem ~50 MB (o vídeo do hero tem 26 MB). Cabe, mas é bom saber. |
| Cold start | A primeira requisição depois de um tempo parado leva ~1 s a mais. |
| Domínio próprio | **Domain management** → **Add domain** → `dtflexpro.com` e ajuste o DNS. O `vite.config.ts` já libera esse host. |
| Formulários/e-mail | Não usamos Netlify Forms; os e-mails saem pela fila do próprio app (Resend). |
