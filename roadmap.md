# Roadmap

- [x] Alternar automaticamente as capas das pastas entre estampas internas, inclusive em subpastas

- [x] Mostrar somente Download nas artes em halftone e Usar + Download nas demais
- [x] Identificar automaticamente o formato A2/A3/A4 na biblioteca

- [x] Tornar a listagem do Drive resiliente, cacheada e revalidável
- [x] Reduzir o peso das prévias e atualizar arquivos alterados
- [x] Sincronizar a pasta automaticamente sem apagar o conteúdo visível
- [x] Organizar arquivos automaticamente por categorias
- [x] Validar navegação, atualização, busca, previews e telas responsivas

- [x] Integrar o projeto Gestão DTF enviado ao menu Ferramentas
- [x] Reorganizar e refinar as categorias da biblioteca
- [x] Validar a Gestão DTF e as ferramentas existentes
- [x] Usar automaticamente o mesmo acesso da plataforma na Gestão DTF
- [x] Iniciar a Gestão DTF zerada e separar os dados por cliente
- [x] Destacar em amarelo os novos controles e botões de retorno
- [x] Permitir enviar uma arte da Biblioteca diretamente para o Halftone
- [x] Validar o fluxo Biblioteca → Halftone e a persistência isolada da Gestão DTF
- [x] Atualizar a landing page com todas as novas ferramentas da plataforma

- [x] Ajustar a ferramenta Halftone para telas de navegador Android e iPhone.

- [x] Substituir controles de zoom no celular por gesto de pinça no Halftone
- [x] Tornar Halftone, Biblioteca, Mockups, Montagem e Gestão responsivos em celular/tablet/desktop
- [x] Corrigir safe areas, alvos de toque e qualquer rolagem horizontal
- [x] Validar visualmente em Android, iPhone, tablet e desktop

- [x] Adicionar Catálogo em Lote às Ferramentas
- [x] Processar 20–100 PNGs com fila, mockups, códigos e persistência por conta
- [x] Exportar PDF/ZIP e publicar catálogo online compartilhável
- [x] Validar lote, falhas isoladas e telas mobile/desktop
- [x] Simplificar o Catálogo em Lote para download somente em PDF
- [x] Acelerar geração, envio e exportação do catálogo
- [x] Permitir nome manual independente para a marca d'água
- [x] Ajustar a proporção final com ampliação e redução dentro do enquadramento
- [x] Preparar o PDF do Catálogo em Lote para download imediato ao clicar
- [x] Adicionar A2 e ajuste manual pelos quatro cantos ao enquadramento final
- [x] Garantir exportação final A2/A3/A4 pelo tamanho físico em mm, orientação e validação a 300 DPI
- [x] Impedir remoção global pela cor da camiseta e reforçar a segmentação contextual em tecidos coloridos
- [x] Restringir camisas coloridas a PNG, preservar preto e manter intactos os presets preto/branco
- [x] Criar Halftone Universal para PNG em camisas brancas e coloridas, sem remoção e com Alpha original preservado
- [x] Corrigir duplicação visual e restaurar os vazados da retícula na imagem final colorida
- [x] Garantir que o PNG final use exatamente A2/A3/A4 e a orientação escolhida
- [x] Validar transparência, dimensões e 300 DPI no download final
- [x] Ajustar o upload para preencher e recortar exatamente o formato A2/A3/A4 escolhido
- [x] Detectar limites reais da arte no PNG e enquadrar automaticamente em A2/A3/A4 sem cortar conteúdo, mantendo recorte manual opcional
- [x] Fazer −/+ ajustar a arte principal em A2/A3/A4 e salvar o enquadramento exato no PNG final
- [x] Permitir arrastar manualmente a arte no A2/A3/A4 e conservar a posição escolhida no PNG final
- [x] Corrigir a criação do Catálogo em Lote e os erros de geração por arquivo
- [x] Acelerar o PDF e iniciar seu download automaticamente ao terminar o lote
- [x] Corrigir o enquadramento A2/A3/A4 para preservar textos completos no PNG final
- [x] Impedir que a limpeza final apague textos e elementos separados da arte

- [x] Ativar os pagamentos embutidos e preparar a cobrança dos planos dentro do app
- [x] Cadastrar os planos R$ 47 mensal e R$ 147 anual no provedor de pagamentos
- [x] Implementar checkout e regras de compra, cancelamento e troca de plano

## Unificação de pagamentos e acesso
- [x] Usar catálogo único de R$ 47 mensal e R$ 147 anual para cartão e PIX
- [x] Exigir confirmação por e-mail antes de alterar uma conta existente
- [x] Manter somente o webhook de planos Stripe e retirar vendas legadas Nubank/InfinitePay
- [x] Registrar estados pendente, pago, falhou e expirou na página de retorno
- [x] Restringir reativação de conta revogada/excluída ao administrador
- [x] Limitar tentativas de código e invalidar o código anterior ao regenerar
- [x] Preservar acesso até o fim do período já pago quando a renovação falha
- [x] Validar abertura do checkout de cartão e PIX na nova conta de pagamentos reativada
- [ ] Cobranças reais — bloqueadas até concluir a ativação da conta de pagamentos (ativação da conta e chaves reais); checkout em modo de teste já validado no preview
- [x] Tornar eventos de pagamento reprocessáveis sem duplicar acesso
- [x] Separar liberação paga do envio do e-mail e registrar falhas de entrega
- [x] Bloquear PIX quando já existir assinatura de cartão vigente
- [x] Proteger confirmação de compra contra uso simultâneo e consulta de retorno com segredo próprio
- [x] Aplicar limites reais de dispositivo ao navegador e ao aplicativo Windows
- [x] Reconciliar troca/cancelamento e preservar limites definidos pelo administrador
- [x] Validar uma compra completa com cartão no preview após as correções
- [x] Retirar o aviso amarelo de suporte abaixo do botão "Acabei de comprar" (método de pagamento resolvido)

## Integrações de agentes MCP
- [x] Ativar OAuth gerenciado e tela de consentimento
- [x] Expor consultas protegidas de planos, acesso e assinatura
- [x] Vincular o login por e-mail e código ao consentimento OAuth
- [x] Adicionar ferramentas de leitura para agentes no navegador
- [ ] Publicar a nova revisão para disponibilizar o endpoint MCP externo
