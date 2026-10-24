/**
 * Checkout da Kiwify — fonte única dos links de pagamento.
 *
 * Estes links são abertos por <a href> (nunca por window.open): com
 * `noopener` o window.open devolve null e ainda é barrado por bloqueadores de
 * pop-up e WebViews (Instagram, Facebook, WhatsApp).
 */
export const KIWIFY_CHECKOUT = {
  mensal: "https://pay.kiwify.com.br/Fgy8j0i",
  anual: "https://pay.kiwify.com.br/SppG0CG",
} as const;

export type KiwifyPlan = keyof typeof KIWIFY_CHECKOUT;

/** URL de checkout para um plano, com "anual" como padrão seguro. */
export function kiwifyCheckoutUrl(plan: string | null | undefined): string {
  return (plan === "mensal" || plan === "anual" ? KIWIFY_CHECKOUT[plan] : KIWIFY_CHECKOUT.anual);
}

/**
 * O Stripe só está utilizável quando existe um token público válido
 * (pk_test_/pk_live_). Sem ele `getStripeEnvironment()` lança erro, então a
 * página precisa cair para a Kiwify em vez de mostrar um botão que não faz nada.
 */
export function isStripeConfigured(): boolean {
  const token = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;
  return typeof token === "string" && /^pk_(test|live)_/.test(token);
}
