# Importar / reparar o banco do DTFLEXPRO

O app usa Supabase (Postgres + Storage). O login por **e-mail + código** depende de
colunas criadas nas migrations `0006`/`0007`; se o banco estiver em um schema anterior,
o login é recusado mesmo com o código certo.

## 1. Reparo do schema (obrigatório)

Rode **`supabase/repair-access-login.sql`** no **SQL Editor** do Supabase.
É idempotente: pode rodar quantas vezes quiser, não apaga dados. Ele:

- cria/ajusta `access_device_sessions.device_key_hash`, `session_token_hash`, `session_expires_at`
- faz backfill das linhas antigas e aplica `NOT NULL`
- cria o índice único usado pelo upsert do login
- garante permissões (`service_role`) e o bucket `catalog-assets`
- termina com `NOTIFY pgrst, 'reload schema'` (limpa o cache de colunas da API)

## 2. Dados de acesso

Os arquivos com e-mails e códigos **não ficam neste repositório** (ele é público).
Eles são gerados a partir do export do banco e entregues à parte, na ordem:

| # | Arquivo | Conteúdo |
| --- | --- | --- |
| 1 | `01-schema.sql` | cópia de `repair-access-login.sql` |
| 2 | `02-dados.sql` | acessos/códigos, planos, catálogos, pagamentos, afiliados |
| 3 | `03-logs-opcional.sql` | logs de segurança/auditoria/e-mail (opcional) |
| 4 | `04-verificar.sql` | contagens e situação dos acessos |
| 5 | `05-acesso-manual.sql` | criar/renovar/trocar código de um e-mail |

`access_sessions` e `access_device_sessions` não são importadas de propósito: são
estado de sessão. Assim cada pessoa registra o dispositivo no próximo login, sem
herdar travas antigas de "1 dispositivo".

## 3. Variáveis de ambiente

No painel do Supabase em **Project Settings → API**:

| Variável | Valor |
| --- | --- |
| `SUPABASE_URL` | Project URL (`https://SEU-REF.supabase.co`) |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` | chave `anon public` |
| `SUPABASE_SERVICE_ROLE_KEY` | chave `service_role` — **secreta**, só no servidor |
| `SESSION_SECRET` | gerar com `openssl rand -hex 32` |

As três últimas vão nas variáveis de ambiente da **hospedagem** (Vercel, Cloudflare,
Lovable), nunca no Git. Para rodar local, use `.env.local` (ignorado pelo Git).

## 4. Sintoma → causa

| Sintoma | Causa provável |
| --- | --- |
| "Código inválido ou expirado" com código certo | falta rodar o passo 1 (schema) |
| "Este acesso já está em uso em outro dispositivo" | sessões antigas presas — `05-acesso-manual.sql` seção 5 |
| "Login indisponível: o servidor está sem SUPABASE_SERVICE_ROLE_KEY" | variável não configurada na hospedagem |
| Login funciona mas `/app` cai | código expirado (`expires_at`) — renovar pela seção 2 |
