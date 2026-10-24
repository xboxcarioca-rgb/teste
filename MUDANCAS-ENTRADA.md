# DTFLEXPRO 2410 — Nova entrada: só e-mail + liberação no painel

## O que mudou

**Antes:** o cliente precisava de e-mail **+ código de acesso** (que funcionava como
senha). Sem o código, não entrava.

**Agora:** o cliente informa **apenas o e-mail**. O pedido aparece no painel do
administrador, que escolhe o plano e libera. Liberado, o cliente entra sozinho.

Não existe mais nenhum campo de senha na entrada do cliente.

---

## Fluxo

```
CLIENTE                                     ADMINISTRADOR
──────────────────────────────────────────────────────────────────
1. abre /login
   digita só o e-mail
   [Solicitar acesso]
        │
        ├─ dispositivo já liberado antes?
        │     SIM → entra direto (não incomoda o admin)
        │     NÃO ↓
        ▼
2. pedido criado (pendente, 15 min)
   tela: "Aguardando liberação"
   consulta o servidor a cada 3s
                                            3. seção "Pedidos de acesso"
                                               aparece no topo do painel
                                               (atualiza a cada 5s)
                                            4. vê e-mail, navegador, IP,
                                               hora e se é cliente conhecido
                                               [Liberar] [Recusar]
                                            5. escolhe o plano:
                                               Mensal / Anual / Vitalícia /
                                               Personalizado + dispositivos
        ▼
6. entra sozinho em /app
```

---

## Arquivos alterados

| Arquivo | O que mudou |
|---|---|
| `src/routes/login.tsx` | reescrito: só e-mail, tela de espera, consulta automática. Campo de senha removido |
| `src/components/admin/PedidosDeAcesso.tsx` | **novo** — seção de pedidos no painel |
| `src/lib/access.functions.ts` | +`solicitarAcesso`, `consultarPedido`, `listarPedidos`, `decidirPedido`; senha master por hash; `logSecurity` blindado |
| `src/routes/verify-admin.ts` | corrigido: respondia `ok: true` para **qualquer** senha |
| `src/routes/admin.tsx` | seção de pedidos no topo; mensagem de erro real no login |
| `src/components/landing/Header.tsx` | "Teste grátis" não cria mais acesso sozinho — leva ao pedido |
| `supabase/migrations/20261024190000_access_requests.sql` | **novo** — tabela de pedidos |

---

## Instalação (obrigatório)

### 1. Rodar a migração no Supabase

SQL Editor → cole o conteúdo de
`supabase/migrations/20261024190000_access_requests.sql` → Run.

Sem isso, o painel mostra o aviso "A tabela de pedidos ainda não existe no banco"
e nenhum pedido é criado.

### 2. Variáveis de ambiente

Obrigatórias (já eram usadas pelo app):

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SESSION_SECRET
```

Opcionais:

```
ADMIN_MASTER_PASSWORD   → se vazio, vale a senha master de reserva (hash no código)
RESEND_API_KEY          → para enviar o código por e-mail após liberar
```

### 3. Conferir

`https://SEU-SITE/api/health` deve responder `{"ok":true,"login":"pronto"}`.

---

## Senha do painel

A senha master continua sendo digitada só no `/admin` — é o único ponto de senha
que restou, como pedido.

Ela **não está escrita em texto puro** no repositório (que é público). Guardamos o
SHA-256 em `ADMIN_MASTER_HASH`. Para trocar:

1. Prefira definir `ADMIN_MASTER_PASSWORD` nas variáveis da hospedagem — tem prioridade.
2. Ou gere um novo hash e substitua a constante:
   ```bash
   node -e "console.log(require('crypto').createHash('sha256').update('NOVA_SENHA').digest('hex'))"
   ```

---

## Segurança — o que saber

1. **O e-mail vira a chave.** Quem souber `fulano@email.com` gera um pedido. A barreira
   é você clicando em Liberar. Por isso o painel mostra IP, navegador e hora.
2. **Aprovação é por dispositivo.** Aprovado uma vez, aquele aparelho entra direto nas
   próximas. Aparelho novo volta a pedir.
3. **Anti-abuso:** 3 pedidos por IP por hora; pedido expira em 15 minutos.
4. **Cliente x e-mail novo:** o painel marca `● Cliente existente` ou `◆ E-mail novo`.
   Pedido de cliente conhecido vindo de lugar estranho é o caso que merece atenção.
5. **O código de acesso continua sendo gerado e gravado** (é o identificador do cliente
   no banco), e vai por e-mail após a liberação. Ele só não é mais pedido na entrada.

---

## O que foi preservado

- `validateAccessCode` continua no servidor: é usado pelo consentimento OAuth (Lovable/MCP)
  e pela liberação de dispositivo. Só deixou de ser o caminho da tela `/login`.
- `TrialSignupDialog` continua no projeto, mas não é mais renderizado — o botão
  "Teste grátis 7 dias" agora leva ao pedido de acesso, para que todo cadastro passe
  pelo administrador.
- Todos os códigos e acessos já existentes continuam válidos.
