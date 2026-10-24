# Halftone universal para PNG em tecidos brancos e coloridos

## Objetivo
Separar completamente o processamento por tecido: **Camisa preta** mantém o comportamento atual; **Camisa branca** e **Camisa colorida** passam a usar um modo universal que trabalha somente sobre os pixels já visíveis do PNG e preserva sua transparência original.

## Alterações
- Tornar PNG obrigatório para os modos branco e colorido, com aviso claro e retorno ao modo preto quando outro formato for usado.
- Desativar nesses dois modos toda remoção de fundo, segmentação, knockout, máscara manual, proteção semântica e qualquer descarte por branco, preto, luminosidade ou cor do tecido.
- Usar o canal Alpha original como limite imutável da arte: pixels originalmente transparentes continuam transparentes; pixels originalmente visíveis continuam presentes e apenas recebem a retícula.
- Manter RGB, proporção, posição e resolução da arte; aplicar a retícula profissional existente a preto, branco, cinza e todas as cores, sem criar buracos artificiais.
- Garantir que preview e PNG final passem pela mesma função universal; a cor do tecido será somente o fundo visual da simulação.
- Simplificar o painel dos modos universal para mostrar apenas ajustes de retícula/base branca pertinentes, removendo controles de remoção e máscara que contradizem esse fluxo.
- Manter exportação PNG transparente em 300 DPI e formatos finais A2/A3/A4 já existentes.

## Validação
- Criar testes automatizados em canvas para PNGs transparentes com arte preta, branca, mista, colorida, detalhes faciais, roupas, texto, números, linhas finas, sombras e degradês.
- Comparar o Alpha de entrada e saída pixel a pixel nos modos branco/colorido e confirmar que nenhum pixel visível vira totalmente transparente.
- Confirmar que o modo preto continua com seu resultado atual.
- Validar no navegador o aviso para JPG/PDF/PSD, a seleção dos três modos, o preview e uma exportação PNG com metadados de 300 DPI.
