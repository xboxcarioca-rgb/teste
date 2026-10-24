# Biblioteca DTFLEXPRO conectada ao Google Drive

## O que será construído

### 1. Nova experiência da área do cliente
- Transformar a área protegida em uma plataforma visual DTFLEXPRO, inspirada na organização do site de referência, sem copiar nome, marca ou textos.
- Manter toda a ferramenta de halftone atual intacta.
- Criar navegação clara entre **Biblioteca**, **Halftone** e as ferramentas já existentes.
- Usar somente nome, identidade visual e conteúdo da DTFLEXPRO.

### 2. Biblioteca de artes do Google Drive
- Usar a pasta informada como raiz da biblioteca.
- Mostrar pastas em cartões com capa, nome e quantidade de itens quando disponível.
- Permitir abrir subpastas, voltar pelo caminho de navegação e pesquisar pelo nome.
- Mostrar imagens e arquivos compatíveis em grade, com prévia, tipo e data.
- Permitir abrir ou baixar o arquivo original sem expor credenciais do Google Drive.
- Atualizar automaticamente quando arquivos ou pastas forem organizados no Drive.

### 3. Capas e organização
- Usar como capa a primeira imagem compatível encontrada em cada pasta.
- Quando não houver imagem, mostrar uma capa DTFLEXPRO consistente com o tipo da pasta.
- Diferenciar visualmente pastas, imagens, PDFs e arquivos de arte.
- Adicionar estados claros de carregamento, pasta vazia e falha de conexão.

### 4. Segurança e acesso
- A biblioteca ficará dentro da área já protegida por código e dispositivo.
- Todas as consultas ao Google Drive ocorrerão no servidor.
- A conexão será do proprietário da DTFLEXPRO; clientes não precisarão conectar contas Google.
- Acesso restrito à pasta raiz informada e aos seus descendentes.

### 5. Compatibilidade e validação
- Ajustar o novo painel para computador, tablet e celular.
- Preservar login, expiração, avisos, administrador, halftone e demais ferramentas existentes.
- Validar abertura de pastas, busca, capas, downloads e retorno à ferramenta de halftone.
- Garantir títulos e descrições próprios da DTFLEXPRO na nova página.

## Detalhes técnicos
- Criar funções seguras para listar pastas, arquivos e buscar conteúdo via Google Drive.
- Criar entrega protegida de miniaturas e arquivos pelo próprio site.
- Manter cache curto para navegação rápida sem impedir atualizações do Drive.
- Não alterar o arquivo minificado nem o processamento atual do halftone.

## Resultado esperado
Ao entrar, o cliente verá uma biblioteca profissional DTFLEXPRO com pastas e capas do Google Drive, podendo navegar e baixar artes, além de abrir a ferramenta de halftone e os recursos atuais no mesmo ambiente.
