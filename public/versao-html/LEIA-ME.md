# DTFLEXPRO — Versão HTML (todas as ferramentas)

Edição **estática em HTML** do DTFLEXPRO: a **última versão** do Halftone e
todas as ferramentas locais, sem servidor, sem login e sem build.

## Como usar

1. Baixe `DTFLEXPRO-versao-html.zip` e extraia a pasta.
2. Abra `index.html` no navegador (Chrome/Edge/Firefox recentes).
3. Mantenha as pastas `halftone/` e `camisetas/` **junto** do `index.html`.

Também funciona servido por qualquer hospedagem estática — neste repositório
ela fica em `/versao-html/` (pasta `public/versao-html/`).

> Dica: abrindo pelo arquivo (`file://`), alguns navegadores limitam recursos
> entre janelas. Para 100% das funções, sirva a pasta com um servidinho local,
> ex.: `npx serve .` ou `python -m http.server`, e acesse o endereço local.

## Ferramentas incluídas

| Ferramenta | Nesta edição HTML |
|---|---|
| **Halftone (última versão)** | O Halftone Engine web atual (`public/dtflex-tool`, build `dpi300-universal-v71`), copiado para `halftone/` só com caminhos relativos — JS/CSS com MD5 idêntico ao original. Export A2/A3/A4 em 300 DPI (pHYs). |
| Removedor de fundo | Local, por cor + flood-fill a partir das bordas, com tolerância, suavização e limpeza de Alpha. |
| Melhorador de imagem | Upscale 1–4x, nitidez (unsharp), saturação e contraste via canvas. |
| Mockup de camiseta | 9 modelos × frente/costas/lateral, cor do tecido, arrastar/escala/rotação, export PNG. Fotos convertidas para WebP (17 MB → ~0,7 MB). |
| Montagem DTF | Gang sheet (presets 28/56/58/60 × 100 cm ou livre), auto-organizar, arrastar, DPI efetivo e export PNG com 300 DPI reais (pHYs) ou imprimir/PDF. |
| Catálogo em lote | Mockups em série com código/nome/preço e marca d'água; baixa um **catálogo em HTML** autossuficiente ou imprime/PDF. |
| Biblioteca de artes | **Local**: salva no navegador (IndexedDB), aceita pasta inteira, busca, detecta A2/A3/A4 (dimensões @300 DPI ou nome) e envia para Halftone/Mockup/Montagem. |
| Gestão DTF | Dashboard, pedidos/produção (status), clientes, estoque, financeiro, impostos, usuários, relatórios e configurações — em `localStorage`, com backup JSON. Começa zerada. |
| Calculadora DTF | Área → custo → venda/lucro (mesma fórmula da plataforma) + quantas artes cabem na folha. |

As ferramentas se conversam: Removedor/Melhorador enviam direto para o
Halftone e podem salvar na Biblioteca; a Biblioteca alimenta
Halftone/Mockup/Montagem; o Catálogo pode usar toda a Biblioteca.

## O que fica só na plataforma online

HTML puro não tem servidor, então estas partes **não** entram nesta edição
(continuam no site/`/app`): Biblioteca no Google Drive, login por código e
limite de dispositivos, checkout/assinaturas, catálogo online com link por
token e geração de imagem/mockups por IA no servidor.

## Arquivos

```
index.html                     ← a página com todas as ferramentas
halftone/index.html            ← cópia portátil da última versão do Halftone
halftone/assets/index-*.js|.css← idênticos (MD5) aos de public/dtflex-tool/assets
camisetas/shirt-*.webp         ← fotos dos 9 modelos (1024px, WebP com Alpha)
DTFLEXPRO-versao-html.zip      ← pacote para download (gerado desta pasta)
LEIA-ME.md
```

Para regenerar o `.zip` depois de editar: compacte o conteúdo desta pasta
(excluindo o próprio `.zip`) numa pasta raiz `DTFLEXPRO-versao-html/`.

> Importante: o Halftone original em `public/dtflex-tool/` **não foi alterado**
> (regra de `mem/index.md`). A cópia em `halftone/` muda apenas os dois
> caminhos absolutos de assets para relativos.
