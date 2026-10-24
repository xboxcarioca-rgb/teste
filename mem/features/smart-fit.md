---
name: Ajuste inteligente da arte ao formato
description: A2/A3/A4 usam os limites reais do Alpha da arte, não as margens vazias do PNG; sem corte é padrão e preenchimento com recorte é opcional
type: feature
---

Ao escolher A2, A3 ou A4 na ferramenta DTF, detectar os limites de todos os pixels visíveis, inclusive sombras translúcidas e detalhes finos, ignorando apenas Alpha igual a zero. O ajuste padrão é SEM CORTE: ampliar proporcionalmente o conteúdo real ao máximo, centralizar com pequena margem de segurança e preservar cores, transparência e todos os detalhes. Orientação detectada pela arte, com escolha manual retrato/paisagem. Mostrar formato, dimensão física, pixels, 300 DPI, tamanho e posição da arte. Oferecer separadamente PREENCHER FORMATO com recorte manual; nunca cortar automaticamente arte real. Preview e PNG final devem mostrar o mesmo enquadramento; PNG final mantém dimensões físicas exatas e metadados 300 DPI.