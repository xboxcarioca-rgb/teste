---
name: Motor universal de cor do tecido (halftone DTF)
description: Regra em public/dtflex-tool/index.html — qualquer HEX de tecido vira variável que calcula base branca, choke, sombra e limite de preto; cor do tecido nunca apaga pixel
type: feature
---

Local: bloco "HALFTONE DTF INTELIGENTE" em `public/dtflex-tool/index.html`.

- `fabricProfile()` recebe `window.__DTF_SHIRT_HEX` (qualquer cor/HEX) e calcula luminosidade, saturação e contraste contra tinta branca/preta.
- `applyFabricAuto()` deriva automaticamente: cobertura de base branca (25–95%), choke (0–2 px), alcance de sombra (130–220), limite de preto (45–80) e nível de preservação de detalhes. Nada de preset manual por cor.
- Checkbox "Motor universal (calcula pela cor)" liga/desliga o cálculo automático; mexer nos sliders desliga o automático (override manual).
- O painel mostra a leitura do tecido (claro/escuro, luz %, saturação %) e os valores calculados.
- Invariável: a cor do tecido NUNCA é critério de remoção de pixel. Remoção continua só por conectividade com as bordas. Modo "remover o preto" nunca é ativado automaticamente.
