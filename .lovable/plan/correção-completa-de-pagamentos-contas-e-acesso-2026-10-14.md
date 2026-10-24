# Correção completa de pagamentos, contas e acesso

## Diagnóstico confirmado
- Há dois webhooks de cartão concorrentes. O antigo pode liberar apenas 24 horas, duplicar contas e ocultar falhas; o atual usa os períodos corretos e processamento idempotente.
- O checkout aceita ambiente e URLs de retorno enviados pelo navegador; isso permite misturar teste/produção e redirecionar para domínios externos.
- A página de retorno sempre diz “Pagamento recebido”, sem consultar se está pago, pendente, recusado ou expirado.
- PIX pendente, expirado ou falho não tem estado completo nem orientação clara ao cliente.
- Uma conta revogada/excluída pode ser reativada pelo próprio cliente com o código antigo.
- Trocar o código não invalida o anterior; login não tem proteção suficiente contra tentativas repetidas.
- Limites acima de um dispositivo não são realmente contabilizados; existe apenas uma sessão armazenada por conta.
- Uma compra pode alterar uma conta existente apenas informando seu e-mail, sem confirmação do titular.
- Troca de plano e criação de checkout podem duplicar operações em cliques/requisições concorrentes.
- O catálogo do site e o catálogo de cobrança não são reconciliados. A base local registra o anual como R$ 168,09, enquanto o site e o checkout anunciam R$ 147.
- O checkout do preview abre para cartão e PIX, mas produção ainda aguarda a verificação final da conta no provedor.
- Não existem testes automatizados para compra, webhook, renovação, cancelamento, troca ou bloqueio de acesso.

## Regras confirmadas
- Somente o administrador reativa contas revogadas ou excluídas.
- Falha de renovação mantém o acesso somente até o fim do período já pago.
- Se o e-mail já possuir acesso, a compra só altera a conta após confirmação por e-mail.
- Stripe será o único provedor de planos; Nubank e InfinitePay serão retirados dos fluxos de assinatura.

## Implementação

### 1. Unificar catálogo e ambiente de cobrança
- Criar uma definição única dos quatro preços: cartão mensal/anual e PIX mensal/anual, com R$ 47 e R$ 147.
- Validar no servidor preço, moeda, recorrência e produto retornados pelo provedor antes de criar a cobrança.
- Fixar teste/produção no servidor e rejeitar divergência com a versão publicada.
- Restringir retornos do checkout e portal aos domínios oficiais e ao preview local.
- Adicionar proteção contra criação duplicada de sessão e duplo clique.

### 2. Confirmar titularidade antes de atualizar conta existente
- Criar confirmação de compra com token único, prazo curto e uso único.
- Para e-mail novo, seguir direto ao checkout; para e-mail já cadastrado, enviar o link de confirmação antes de abrir a cobrança.
- Vincular a confirmação ao plano, forma de pagamento e e-mail normalizado, impedindo troca posterior no navegador.
- Não expor na tela se um e-mail possui conta; a mensagem será neutra.

### 3. Consolidar webhooks e estados de pagamento
- Remover a rota antiga de webhook e todo código de venda de planos via Nubank/InfinitePay.
- Manter apenas o webhook oficial separado por teste/produção e sua idempotência por evento.
- Registrar tentativas como `pending`, `paid`, `failed` ou `expired`, incluindo cartão e PIX.
- Processar sucesso, falha assíncrona, expiração, renovação paga, renovação falha, cancelamento e troca de plano.
- Preservar acesso até a data paga em cancelamento ou falha; bloquear somente quando essa data vencer.
- Tornar criação/atualização de acesso segura contra eventos simultâneos e compras repetidas.

### 4. Corrigir conta, códigos e dispositivos
- Impedir auto-reativação de conta revogada/excluída em todos os caminhos.
- Invalidar o código anterior ao gerar um novo.
- Limitar tentativas de login por conta e origem, com mensagens neutras.
- Usar registros individuais de sessão para cumprir o limite real de dispositivos, sem sobrescrever silenciosamente outro aparelho.
- Separar ações administrativas manuais de estados sincronizados pelo provedor, evitando que uma renovação sobrescreva uma decisão administrativa sem aviso.

### 5. Criar retorno e gestão de assinatura confiáveis
- Fazer a página de retorno consultar a compra e mostrar: aguardando PIX, pago e liberado, recusado, expirado ou erro de processamento.
- Atualizar automaticamente enquanto o PIX aguarda confirmação, com opção de tentar novamente.
- Exibir cancelamento, fim do período pago e troca programada na gestão da assinatura.
- Evitar duas trocas simultâneas e reconciliar a tela quando o provedor confirmou uma operação, mas a gravação local falhou.
- Mostrar mensagens seguras ao cliente e manter detalhes técnicos apenas nos registros internos.

### 6. Testes e observabilidade
- Adicionar testes automatizados para catálogo, criação de checkout, confirmação de e-mail, idempotência, PIX, renovação, cancelamento, troca, revogação, códigos e limites de dispositivos.
- Adicionar registros pesquisáveis para falhas de webhook e operações que precisem de reconciliação.
- Validar no preview os fluxos centrais de ponta a ponta e confirmar que nenhuma rota antiga permanece acessível.

## Teste no preview
1. Abrir Mensal → Cartão e usar `4242 4242 4242 4242`, validade futura e qualquer CVC de 3 dígitos. Confirmar pagamento, e-mail e acesso de 30 dias.
2. Repetir no Anual e confirmar período anual, sem criar outro cadastro para o mesmo e-mail após a confirmação do titular.
3. Usar `4000 0000 0000 0002` e confirmar recusa sem liberar acesso.
4. Usar `4000 0025 0000 3155` e concluir a autenticação adicional; confirmar uma única liberação.
5. Escolher PIX, gerar QR Code/copia e cola de teste e validar os estados aguardando → pago. Também simular expiração/falha sem liberar acesso.
6. Cancelar no portal e confirmar acesso até a data final; programar Mensal ↔ Anual e confirmar mudança somente na próxima renovação.
7. Revogar uma conta no administrador e confirmar que código antigo, liberação de dispositivo e reativação própria não funcionam.
8. Reenviar o mesmo evento de pagamento e confirmar que não duplica validade, código, e-mail ou cadastro.

## Limite externo atual
- O checkout real não poderá cobrar até a verificação final da conta terminar e as chaves de produção serem liberadas. Todo o fluxo será validado primeiro no modo de teste; depois, basta publicar novamente quando a ativação estiver concluída.
