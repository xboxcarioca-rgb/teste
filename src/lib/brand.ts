/**
 * Identidade visual da marca.
 *
 * Os arquivos ficam em `public/brand/` e são servidos pelo próprio app — não
 * dependa do CDN da Lovable (`__l5e/assets-v1/...`): fora da Lovable essa URL
 * responde 500 e a logo simplesmente não aparece.
 */
export const BRAND_NAME = "DTFLEXPRO";

/** Ícone (quadrado, marca "d" + nome) — 512×512. */
export const brandIconUrl = "/brand/dtflexpro-icon.png";

/** Wordmark horizontal, apenas "DTFLEXPRO", fundo transparente — 654×60. */
export const brandWordmarkUrl = "/brand/dtflexpro-wordmark.png";

/** Versão 2× do wordmark para telas retina. */
export const brandWordmark2xUrl = "/brand/dtflexpro-wordmark@2x.png";

/** Logo padrão usada nos cabeçalhos (wordmark, sem o ícone). */
export const brandLogoUrl = brandWordmarkUrl;

/** Ícone menor para favicon / apple-touch-icon. */
export const brandFaviconUrl = brandIconUrl;

/** Imagem de compartilhamento (WhatsApp, Instagram, Twitter…). */
export const brandSocialImageUrl = brandIconUrl;

/** Proporção do wordmark (largura / altura) — evita "pulo" de layout. */
export const BRAND_WORDMARK_RATIO = 654 / 60;
