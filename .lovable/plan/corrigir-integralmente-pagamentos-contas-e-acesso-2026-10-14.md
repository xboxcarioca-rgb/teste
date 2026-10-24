# Corrigir integralmente pagamentos, contas e acesso

## Objetivo
Tornar compra, renovação, cancelamento, troca de plano e liberação de acesso confiáveis e testáveis, mantendo o modelo atual de e-mail + código e o Stripe como único provedor dos planos.

## Regras confirmadas
- Cartão cria assinatura renovável; PIX é compra avulsa de 30 ou 365 dias.
- Quem já possui assinatura de cartão não poderá comprar um plano por PIX enquanto ela estiver vigente.
- O site só libera o acesso depois da confirmação real do pagamento; o código é enviado por e-mail.
- Conta apenas vencida pode renovar sozinha e voltar após pagamento confirmado.
- Conta revogada ou excluída continua dependendo do administrador.
- Falha de renovação preserva o acesso somente até o fim do período já pago.
- Cancelamento preserva o acesso até o fim do período pago.
- Troca mensal/anual ocorre na próxima renovação, sem cobrança proporcional imediata.

## Problemas encontrados
- Um evento é marcado como concluído antes de liberar o acesso. Uma falha temporária pode fazer o pagamento aprovado nunca liberar a conta.
- O e-mail de acesso participa da mesma operação crítica; se seu envio falhar, pode comprometer o processamento do pagamento.
- A confirmação de compra de conta existente pode ser consumida duas vezes por requisições simultâneas.
- A escolha teste/produção usa uma heurística ampla de domínio, em vez de uma lista explícita dos domínios oficiais.
- O retorno consulta uma sessão de pagamento apenas pelo identificador presente na URL.
- PIX ainda pode disputar validade com uma assinatura de cartão.
- Renovação redefine o limite especial de dispositivos para 1.
- Mudanças ou cancelamentos feitos no portal podem deixar plano e troca programada divergentes no app.
- Reembolso, disputa e falha de renovação não possuem tratamento completo nem aviso ao cliente.
- O limite de dispositivos usa IP e não contabiliza corretamente limites maiores que 1; a ativação desktop ignora esse limite e não tem proteção contra tentativas repetidas.
- O bloqueio do teste grátis combina dispositivo com IP, permitindo novo teste ao trocar de rede.
- Revogação administrativa pode atingir apenas uma linha duplicada da conta.
- A área administrativa mistura ajustes manuais com dados sincronizados pela cobrança, sem indicar qual fonte prevalece.
- Não há testes automatizados para os fluxos financeiros e de acesso.

## Implementação

### 1. Tornar o webhook recuperável e reconciliável
- Registrar cada evento como `processing`, executar a liberação e só então marcar `processed`.
- Guardar tentativa, erro e horário; permitir nova tentativa segura quando ocorrer falha transitória.
- Separar a liberação do acesso do envio do e-mail: pagamento confirmado sempre grava o acesso; falha de e-mail fica registrada para reenvio, sem desfazer a compra.
- Manter idempotência para que reentregas nunca somem prazo nem enviem códigos duplicados.
- Adicionar tratamento de pagamento assíncrono, renovação paga/falha, cancelamento, reembolso e disputa.
- Reconciliar `user_access` e `access_subscriptions` pelo preço canônico do catálogo em todos os eventos do provedor.

### 2. Fechar concorrência e exposição no checkout
- Consumir a confirmação de e-mail de forma atômica antes de criar uma única sessão e liberar a confirmação se a criação falhar com segurança.
- Mapear explicitamente localhost/preview para teste e os três domínios oficiais para produção; rejeitar qualquer outro domínio.
- Vincular a consulta de retorno a um segredo curto da própria compra, além do ID da sessão, sem expor detalhes de outra conta.
- Bloquear checkout PIX quando o e-mail já tiver assinatura renovável vigente.
- Validar também produto, preço, moeda, recorrência e ambiente no servidor.

### 3. Consolidar assinatura, renovação e gestão
- Sincronizar sempre o plano atual pelo `price_id`, inclusive quando a alteração vier do portal.
- Limpar troca programada quando houver cancelamento ou quando a programação deixar de existir.
- Mostrar `ativa`, `em atraso`, `cancelada no fim do período` e `troca programada` na área Minha assinatura.
- Preservar o limite de dispositivos definido pelo administrador durante compras e renovações.
- Separar extensão manual da validade sincronizada pelo pagamento e exibir essa situação no painel administrativo.
- Adicionar aviso por e-mail para falha de renovação, sem cortar antes da data já paga.

### 4. Corrigir identidade, dispositivos e trial
- Criar registros individuais de dispositivo/sessão para aplicar limites 1–20 corretamente, sem usar IP como identidade.
- Aplicar a mesma regra e o mesmo limite de tentativas no navegador e na ativação desktop.
- Fazer liberação de dispositivo exigir credencial válida e registrar/notificar a troca.
- Tornar o bloqueio do teste dependente de uma impressão persistente do dispositivo, sem incorporar IP ao identificador.
- Revogar/excluir todas as credenciais e sessões da mesma conta de forma consistente.
- Manter a ponte OAuth/MCP somente para conta ativa e não vencida; as ferramentas também revalidarão o acesso atual.

### 5. Banco e painel administrativo
- Aplicar uma migração com estados de processamento do webhook, entrega de e-mail, segredo de consulta do pagamento, sessões de dispositivo e restrições de estado.
- Manter todas as tabelas protegidas e acessíveis apenas pelos caminhos necessários.
- Acrescentar ao painel: falhas de liberação, e-mails pendentes, pagamentos para reconciliar, assinatura vigente, override manual e dispositivos ativos.
- Remover/arquivar apenas referências realmente obsoletas do antigo modelo de assinatura, sem apagar histórico financeiro.
- Manter o fluxo isolado de R$5 separado dos planos; endurecer sua confirmação para que um segredo estático sozinho não possa marcar pedido como pago.

### 6. Testes automatizados e validação real
- Testar catálogo e validação dos quatro preços.
- Testar confirmação de e-mail de uso único, inclusive duas requisições simultâneas.
- Testar webhook duplicado, falha no meio do processamento e reentrega posterior.
- Testar cartão aprovado, recusado e com autenticação adicional; PIX pendente, pago, falho e expirado.
- Testar renovação paga/falha, cancelamento, reembolso, disputa e troca mensal/anual.
- Testar conta nova, vencida, revogada e excluída; limite de dispositivos e trial.
- Validar o fluxo completo no preview com leitura posterior do acesso e da assinatura.

## Como testar no preview
1. **Cartão aprovado:** comprar com `4242 4242 4242 4242`, validade futura e qualquer CVC de 3 dígitos. Confirmar página paga, e-mail recebido, código válido e período correto.
2. **Cartão recusado:** usar `4000 0000 0000 0002`. Confirmar que nenhum acesso é liberado.
3. **Autenticação adicional:** usar `4000 0025 0000 3155`, concluir a etapa exibida e confirmar uma única liberação.
4. **PIX:** gerar QR Code/copia e cola no modo de teste e confirmar que o acesso só aparece após o estado pago. Confirmar também que PIX é bloqueado para assinante ativo.
5. **Conta existente:** repetir a compra e confirmar o link por e-mail; abrir duas vezes e verificar que apenas uma sessão é criada.
6. **Renovação e cancelamento:** simular renovação paga, falha e cancelamento; o acesso deve durar exatamente até o fim do período pago.
7. **Troca de plano:** programar mensal ↔ anual e confirmar que a mudança ocorre somente na renovação.
8. **Admin e dispositivos:** revogar/excluir e validar bloqueio; conta apenas vencida deve poder pagar e reativar. Testar o limite no navegador e desktop.
9. **Recuperação:** provocar falha de envio de e-mail e reentrega do mesmo evento; a compra deve continuar registrada, o acesso não pode duplicar e o e-mail deve ficar disponível para reenvio.

## Limite externo
Cobranças reais continuarão indisponíveis até a conta de pagamentos concluir a ativação e liberar as chaves reais. Todas as correções serão validadas primeiro no modo de teste.
