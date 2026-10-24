# Exportação final A2, A3 e A4 em 300 DPI

## Resultado
- A escolha A2, A3 ou A4 definirá o tamanho real do PNG final, calculado em milímetros a 300 DPI.
- O usuário poderá escolher retrato ou paisagem, invertendo largura e altura sem distorcer a arte.
- A arte inteira será encaixada proporcionalmente, sem corte automático, mantendo transparência e qualidade máxima.

## Interface
- Mostrar antes da exportação o formato, orientação, dimensão física, 300 DPI e dimensão final em pixels.
- Recalcular imediatamente o enquadramento ao trocar formato ou orientação.

## Validação
- Conferir automaticamente o canvas final antes do download: A2 4961×7016, A3 3508×4961 e A4 2480×3508, invertidos em paisagem.
- Manter os metadados PNG `pHYs` em 11811 pixels por metro para reconhecimento correto de 300 DPI.
