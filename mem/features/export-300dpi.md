---
name: Export PNG 300 DPI real (A4 + A3 + A2)
description: Patch no iframe DTFLEXPRO que grava pHYs em 300 DPI e preserva o enquadramento manual em A4, A3 e A2
type: feature
---

Local: `public/dtflex-tool/index.html` (bloco script no <head>).

Comportamento:
- Intercepta `HTMLCanvasElement.prototype.toBlob` e `toDataURL` para `image/png`.
- Reescreve o buffer PNG inserindo um chunk `pHYs` (x/y = 11811 px/m, unit = 1) com CRC-32 recalculado, antes do primeiro chunk não-IHDR.
- Antes do download final, valida e, se preciso, regrava o pHYs.
- O enquadramento permite ajustes manuais pelas quatro alças de canto e pelos botões −/+.
- A referência dos formatos é calculada em milímetros a 300 DPI; retrato e paisagem apenas invertem largura e altura.
- Antes de salvar, o canvas é validado contra as dimensões exatas: A2 4961×7016, A3 3508×4961 e A4 2480×3508, invertidas em paisagem.
- A arte inteira é encaixada proporcionalmente e centralizada, sem corte ou distorção; transparência PNG é preservada.
- Injeta dois botões ao lado do "Exportar Master":
  - "Salvar PNG A4 (300 DPI)": canvas 2480 x 3508, centralizado, transparente.
  - "Salvar PNG A3 (300 DPI)": canvas 3508 x 4961, centralizado, transparente.
  - "Salvar PNG A2 (300 DPI)": canvas 4961 x 7016, centralizado, transparente.
- Todos passam pelo mesmo pipeline pHYs (300 DPI cravado).
- Bundle minificado da ferramenta (`assets/index-*.js`) NÃO é modificado.

Regra: nunca remover esse patch. Validar abrindo o PNG exportado em Photoshop/identify — deve mostrar 300 DPI, não 72/96/150. A4 já está validado; A3 segue o mesmo caminho via `makeSizedCanvas`.

