# Integrar Gestão DTF e organizar a biblioteca

## Objetivo
Adicionar o projeto enviado como uma nova ferramenta do DTFLEXPRO, adaptado ao visual e à navegação atuais, e deixar as categorias da biblioteca mais claras e fáceis de consultar.

## Implementação
- Converter o projeto enviado de aplicativo móvel para uma ferramenta web integrada, mantendo as áreas de painel, produção, pedidos, clientes, estoque, financeiro, impostos, relatórios, configurações e usuários.
- Preservar os cálculos, cadastros, filtros, indicadores e relatórios existentes no projeto enviado, com dados salvos no próprio navegador como já funciona no projeto original.
- Adicionar “Gestão DTF” ao menu recolhível de Ferramentas e abrir a experiência em tela cheia, com botão para voltar à ferramenta principal.
- Adaptar a interface para desktop, tablet e celular usando os componentes e estilos já adotados pelo DTFLEXPRO, sem misturar a navegação do projeto principal com a navegação interna da gestão.
- Reorganizar a biblioteca em categorias consistentes, ordenadas naturalmente, com pastas sempre antes dos arquivos e separação mais precisa entre coleções, imagens, documentos PDF, vetores e demais formatos.
- Exibir as categorias de modo mais compacto e navegável, preservando busca, capas, atualização automática, breadcrumbs e downloads atuais.

## Detalhes técnicos
- Reaproveitar a lógica de negócio e os dados de demonstração do ZIP, substituindo dependências exclusivas de aplicativo móvel por React web e armazenamento local compatível com o navegador.
- Criar componentes web menores por área para evitar um arquivo único pesado e carregar a Gestão DTF somente quando aberta.
- Manter a ferramenta dentro da área autenticada existente; nenhuma nova página pública será criada.
- Não alterar o funcionamento do Halftone, dos mockups, da montagem DTF nem da conexão atual com o Google Drive.

## Validação
- Abrir e fechar “Gestão DTF” pelo menu Ferramentas em desktop e celular.
- Conferir navegação interna, criação/edição/exclusão de registros, cálculos, filtros e persistência após recarregar a página.
- Conferir biblioteca com categorias ordenadas, busca, entrada em pastas, atualização e download.
- Verificar que as ferramentas existentes continuam abrindo normalmente e sem sobreposição.
