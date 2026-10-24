---
name: HALFTONE DTF INTELIGENTE — tecidos coloridos
description: Halftone universal para PNG em camisas brancas e coloridas — nenhuma remoção, todas as cores e o Alpha original são preservados
type: feature
---

Fluxo de camisa PRETA permanece intocado. Tecidos BRANCOS e COLORIDOS usam o Halftone Universal.

Regras:
- Camisas branca e colorida aceitam SOMENTE PNG. JPG, PDF, PSD e outros formatos recebem advertência e esses modos não são aplicados.
- Nenhuma remoção de fundo, segmentação, knockout, máscara manual ou descarte por cor é executado nesses modos.
- `preserveOriginalAlpha()` usa o Alpha original como limite externo: nunca cria conteúdo onde o PNG já era transparente, mas mantém transparentes os furos produzidos pela retícula dentro da arte.
- O resultado do motor de retícula não recebe uma segunda cópia opaca da arte por baixo; isso evita imagem duplicada e mantém o vazado real dos pontos.
- Preto, branco, cinza, cores, texto, rosto, olhos, boca, cabelo, roupas, sombras e detalhes permanecem presentes.
- Preview e arquivo final usam o mesmo `window.__DTF_SMART_APPLY`; a cor da camiseta aparece somente no fundo da simulação.
- Camisa preta permanece no fluxo próprio anterior, sem alteração.
