# Checkout e assinaturas DTFLEXPRO

## O que será entregue
- Substituir a cobrança manual do Nubank pelos pagamentos embutidos dos planos Mensal (R$ 47) e Anual (R$ 147).
- Pedir o e-mail da compra e mostrar o formulário de pagamento dentro da página, sem depender de comprovante no WhatsApp.
- Liberar ou renovar automaticamente o código de acesso após a confirmação do pagamento e enviar o código por e-mail.
- Manter o acesso até o fim do período já pago quando houver cancelamento.
- Registrar a troca Mensal ↔ Anual para valer somente na próxima renovação.
- Mostrar avisos claros de modo de teste, sucesso, pagamento pendente e erro.

## Regras da assinatura
- Compra confirmada: ativa o plano e sincroniza a validade com o período pago.
- Renovação confirmada: estende a validade automaticamente.
- Pagamento em processamento: não libera antes da confirmação.
- Falha de pagamento: mantém o estado registrado sem conceder um novo período.
- Cancelamento: não corta imediatamente; o acesso termina na data final já paga.
- Troca de plano: entra em vigor no próximo ciclo, sem cobrança proporcional imediata.

## Impostos e disponibilidade
- Como a conta opera no Brasil e o cálculo automático não está disponível para este país, os impostos ficam sob responsabilidade do vendedor e não bloqueiam o pagamento.
- O checkout funcionará primeiro no modo de teste. Pagamentos reais exigem concluir a ativação da conta de pagamentos.

## Detalhes técnicos
- Usar checkout embutido e os identificadores permanentes `dtflexpro_mensal` e `dtflexpro_anual`.
- Persistir assinaturas separadamente por ambiente de teste/produção e associá-las ao acesso por e-mail.
- Validar a assinatura de cada notificação do provedor antes de alterar qualquer acesso.
- Fazer o processamento de eventos de forma idempotente para impedir liberações duplicadas.
- Manter o fluxo antigo isolado, sem expor chaves privadas no navegador.

## Validação
- Conferir mensal e anual no navegador, incluindo retorno após pagamento.
- Simular criação, renovação, cancelamento e mudança programada sem duplicar códigos.
- Confirmar que as páginas continuam funcionando em computador e celular e que o site compila sem erros.
