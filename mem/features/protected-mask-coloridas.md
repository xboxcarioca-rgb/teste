---
name: Protected Mask e halftone adaptativo (tecidos coloridos)
description: Regras em public/dtflex-tool/index.html — máscara protegida de elementos principais, proteção do preto, tolerância/suavização do fundo, halftone adaptativo e pincéis manuais
type: feature
---

Local: `public/dtflex-tool/index.html` (bloco "HALFTONE DTF INTELIGENTE" + `removeBackgroundAuto`).

- PROTECTED MASK: depois do flood-fill de borda, a arte remanescente vira máscara protegida e o preto vizinho à arte (contornos, cabelo, roupa, texto) é reconquistado por BFS limitada a ~1,2% da menor dimensão. Pixel protegido nunca é apagado.
- `S.protectArt` (🛡️ Preservar arte principal, padrão ON) e `S.protectBlack` (padrão ON). Com protectArt ligado, `blackMode` nunca fica em `remover`; escolher "remover o preto" desliga protectArt explicitamente com aviso.
- `S.bgTol` (30–200%) multiplica LOCAL/GLOBAL/EDGE do flood-fill. `S.maskSmooth` (0–3 px) só suaviza a franja do recorte, nunca o núcleo.
- Halftone adaptativo: `S.htIntensity` (30–100%) reduz pontos progressivamente só acima de `shadowLevel` (áreas claras), preservando densidade em sombras e pretos.
- Máscara visual + pincéis: botão "🎭 Máscara e pincéis" abre overlay vermelho=removido / verde=preservado / preto=protegido, com pincel preservar (2), remover (1), borracha (0), tamanho e antes/depois. Resultado fica em `window.__DTF_USER_MASK` e é aplicado em `applyArtRules` sobre o arquivo final.
- `window.__DTF_LAST_MASK = { w, h, bg, prot }` é publicado pelo removedor para a visualização.
- Regra de qualidade: preferir manter um pouco de fundo a remover parte da arte.
- A cor da camiseta é somente referência de preview/retícula/base branca. Foi removida toda regra de apagar ou reticular uma cor específica isoladamente.
- `S.removalIntensity` (0–100%, padrão 55%) regula apenas o crescimento da região de fundo conectada às bordas; 0% não remove nada.
- `S.detailProtection` (0–100%, padrão 85%) torna as barreiras de contraste e a recuperação contextual de detalhes internos mais conservadoras, sem bloquear uma cor específica.
