# Biblioteca leve, atualizada e organizada

## Objetivo
Deixar a biblioteca do Google Drive rápida, estável e sempre sincronizada, refletindo arquivos adicionados, alterados, movidos ou apagados sem exigir recarregar a página.

## Implementação
- Manter a pasta atual visível durante atualizações, evitando telas vazias e carregamentos piscando.
- Atualizar automaticamente em intervalos leves, ao voltar para a aba e por um botão de atualização manual.
- Controlar requisições concorrentes para que respostas antigas nunca substituam a pasta mais recente.
- Tratar atalhos quebrados, arquivos apagados durante o carregamento e falhas temporárias sem derrubar a tela.
- Adicionar tentativas curtas para falhas temporárias do Google Drive e cache breve para reduzir chamadas repetidas.
- Buscar miniaturas otimizadas para capas e imagens, sem baixar os arquivos originais completos no preview.
- Usar carregamento progressivo das imagens e manter um ícone leve quando uma miniatura não estiver disponível.
- Organizar automaticamente o conteúdo em categorias: Coleções, Imagens, PDFs, Vetores e Outros arquivos.
- Ordenar cada categoria de forma estável e natural pelo nome, mantendo pastas antes dos arquivos.
- Mostrar a última atualização e um indicador discreto enquanto a sincronização acontece.

## Detalhes técnicos
- Estender os metadados recebidos do Drive com miniatura e versão de modificação.
- Usar cache curto no servidor com revalidação forçada quando solicitado pela interface.
- Gerar URLs de preview com versão do arquivo para invalidar apenas imagens realmente alteradas.
- Filtrar respostas e caminhos duplicados; validar o caminho atual sem repetir chamadas desnecessárias.
- Preservar autenticação e restrição à pasta principal já configurada.

## Validação
- Navegar rapidamente entre pastas e breadcrumbs sem erro.
- Confirmar atualização após adicionar, alterar, mover e apagar um arquivo.
- Comparar o peso das miniaturas com o arquivo original.
- Testar pastas, atalhos, categorias, busca e download em tela desktop e móvel.
