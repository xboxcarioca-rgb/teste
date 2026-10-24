---
name: Remoção de fundo por conectividade (halftone DTF)
description: Regra do modal de upload em public/dtflex-tool/index.html — fundo só é removido por conectividade com as bordas; cor da camisa afeta apenas retícula/preview
type: feature
---

Local: `public/dtflex-tool/index.html`, função `removeBackgroundAuto` no modal de upload.

Regras invioláveis:
- NUNCA usar cor (preto/branco/etc.) como critério de remoção. Nada de chroma key.
- Fundo = componente conectado nascido nas bordas da imagem, com 3 travas: LOCAL_TOL (16) entre vizinhos, EDGE_STOP (34) de gradiente e GLOBAL_TOL (52) vs. cor da semente da borda.
- Detalhes internos (olhos, boca, dentes, cabelo, barba, óculos, correntes, tatuagens, textos, contornos, sombras) são preservados por não serem alcançáveis a partir da borda.
- Se >97% dos pixels seriam apagados, aborta e mantém a imagem original.
- PNG com alpha: alpha existente é preservado como máscara.
- Cor da camiseta (11 presets + color picker) define somente retícula e o preview de simulação. Nunca define remoção.
- Painel de tamanho em cm trabalha travado em 300 DPI: px = cm / 2.54 * 300, com "manter proporção" ligado por padrão.
