# Responsividade completa e zoom por pinça

## Resultado
A plataforma inteira se adaptará corretamente a celulares Android, iPhone, tablets, notebooks e monitores maiores. Na ferramenta Halftone, os controles visíveis de zoom serão removidos apenas no celular e substituídos por pinça com dois dedos; no computador, roda do mouse, arrasto e controles atuais continuarão disponíveis.

## Implementação
- Ajustar a área de visualização do Halftone para detectar dois toques, ampliar no ponto central da pinça e permitir arrasto com um dedo quando a arte estiver ampliada.
- Ocultar a barra e os botões de zoom em telas touch pequenas, sem alterar o arquivo exportado nem a lógica de geração da retícula.
- Corrigir alturas dinâmicas, áreas seguras do iPhone, painéis flutuantes, recorte, mensagens e botões para não ficarem fora da tela.
- Adaptar Biblioteca de Artes, Estúdio de Mockups, Montagem DTF, Gestão DTF e menu de ferramentas para celulares, tablets e desktop, com controles confortáveis para toque.
- Impedir rolagem horizontal global e garantir que imagens, canvases, formulários, tabelas e textos permaneçam dentro da largura disponível.

## Detalhes técnicos
- Manter `viewport-fit=cover` e usar `100dvh` com safe areas.
- Usar Pointer Events com rastreamento de múltiplos pontos para a pinça, escala limitada e posicionamento ancorado no centro do gesto.
- Aplicar layouts fluidos com Grid/Flex, `min-width: 0`, limites responsivos e breakpoints de celular/tablet/desktop.
- Preservar o zoom desktop e toda a qualidade/exportação atual em 300 DPI.

## Validação
- Verificar visualmente em 320, 360, 375, 390, 414, 430, 768, 1024, 1280, 1440 e 1920 px.
- Confirmar ausência de overflow horizontal, cortes, sobreposições e botões pequenos.
- Testar pinça e arrasto em contexto touch, além do zoom/arrasto existente no desktop.
