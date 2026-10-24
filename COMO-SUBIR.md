# Como subir o projeto manualmente

Pacote: `dtflexpro-2410-codigo.zip` (identificador **2410**).

## O que tem no arquivo

Todo o código-fonte do DTFLEXPRO, já sem:

- `node_modules/` (dependências — instale com `npm install`)
- `.git/` (histórico — se for subir no GitHub, o repo já existe)
- `.output/` e `.wrangler/` (build — gerado por `npm run build`)
- `.env` e `.env.local` (**segredos** — veja o `.env.example`)

## Opção 1 — Subir no GitHub pelo navegador

1. Baixe e **descompacte** o zip.
2. Abra o repositório no GitHub → **Add file** → **Upload files**.
3. Arraste **o conteúdo da pasta** (não a pasta em si) para a área de upload.
4. Em *Commit changes*, escreva uma mensagem e confirme.
5. ⚠️ O limite do navegador é **100 MB por commit**. Este projeto tem ~59 MB
   (o vídeo `src/assets/hero-video.mp4` sozinho tem 26 MB), então cabe — mas
   se o GitHub reclamar, envie em duas partes (primeiro `src/`, depois o resto).

> O `.gitkeep` e arquivos ocultos (`.github/`, `.gitignore`, `.lovable/`) só
> aparecem se você habilitar "mostrar arquivos ocultos" no seu sistema.

## Opção 2 — Subir por linha de comando (recomendado)

```bash
unzip dtflexpro-2410-codigo.zip -d dtflexpro
cd dtflexpro
git init
git add .
git commit -m "DTFlexPRO 2410"
git branch -M main
git remote add origin https://github.com/xboxcarioca-rgb/SEU-REPO.git
git push -u origin main --force
```

## Opção 3 — Subir na hospedagem (Vercel / Cloudflare / Netlify)

O projeto é **TanStack Start + Nitro**, precisa de build no servidor:

| Serviço | Configuração |
| --- | --- |
| Vercel | Framework: **Other** · Build: `npm run build` · Output: `.output` |
| Cloudflare Pages/Workers | Build: `npm run build` · usa o preset Nitro `cloudflare-module` já configurado |
| Netlify | Build: `npm run build` · Publish: `.output/public` |

**Variáveis obrigatórias no painel do serviço:**

```
SUPABASE_URL=https://ifollbyypwxnkddepxae.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role do painel Supabase>
SUPABASE_PUBLISHABLE_KEY=<anon public>
VITE_SUPABASE_URL=https://ifollbyypwxnkddepxae.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon public>
SESSION_SECRET=<openssl rand -hex 32>
```

Depois do deploy, abra `https://SEU-DOMINIO/api/health` — deve responder
`"ok": true`. Se responder 503, a lista `missing` mostra o que falta.

## Rodar na sua máquina

```bash
npm install
cp .env.example .env.local   # preencha os valores
npm run dev                  # http://localhost:8080
```

## Banco de dados

Os scripts de schema e importação **não estão neste zip** (contêm e-mails e
códigos de acesso). Eles ficam em `dtflexpro-2410-banco.zip`, separado.
Rode primeiro o `01-schema.sql` no SQL Editor do Supabase.
