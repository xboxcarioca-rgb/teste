/**
 * Identidade visual da marca.
 *
 * A logo fica em `public/brand/` e é servida pelo próprio app — não dependa do
 * CDN da Lovable (`__l5e/assets-v1/...`): fora da Lovable essa URL responde 500
 * e a logo simplesmente não aparece.
 */
export const BRAND_NAME = "DTFLEXPRO";

/** Arquivo físico: public/brand/dtflexpro-icon.png (512×512) */
export const brandLogoUrl = "/brand/dtflexpro-icon.png";

/** Ícone menor para favicon / apple-touch-icon. */
export const brandFaviconUrl = brandLogoUrl;

/** Imagem de compartilhamento (WhatsApp, Instagram, Twitter…). */
export const brandSocialImageUrl = brandLogoUrl;
