export const PAYMENT_CATALOG = {
  dtflexpro_mensal: { amount: 4700, currency: 'brl', recurring: true, planCode: 'mensal', accessDays: 30 },
  dtflexpro_anual: { amount: 14700, currency: 'brl', recurring: true, planCode: 'anual', accessDays: 365 },
  dtflexpro_mensal_pix: { amount: 4700, currency: 'brl', recurring: false, planCode: 'mensal', accessDays: 30 },
  dtflexpro_anual_pix: { amount: 14700, currency: 'brl', recurring: false, planCode: 'anual', accessDays: 365 },
} as const;

export type PaymentPriceId = keyof typeof PAYMENT_CATALOG;
export type PaymentEnvironment = 'sandbox' | 'live';

export function getBuildPaymentEnvironment(): PaymentEnvironment {
  const token = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;
  if (token?.startsWith('pk_test_')) return 'sandbox';
  if (token?.startsWith('pk_live_')) return 'live';
  throw new Error('Os pagamentos ainda não estão configurados para esta versão.');
}

export function paymentPriceId(plan: 'mensal' | 'anual', method: 'card' | 'pix'): PaymentPriceId {
  if (plan === 'anual') return method === 'pix' ? 'dtflexpro_anual_pix' : 'dtflexpro_anual';
  return method === 'pix' ? 'dtflexpro_mensal_pix' : 'dtflexpro_mensal';
}

const LIVE_PAYMENT_HOSTS = new Set(['dtflexpro.com', 'www.dtflexpro.com', 'dtflex.lovable.app']);
const SANDBOX_PAYMENT_HOSTS = new Set([
  'localhost',
  'id-preview--a7fd8d4e-d446-4b6e-a7ae-aab9c3c7e970.lovable.app',
]);

export function paymentEnvironmentForOrigin(value: string): PaymentEnvironment | null {
  try {
    const url = new URL(value);
    if (LIVE_PAYMENT_HOSTS.has(url.hostname)) return 'live';
    if (SANDBOX_PAYMENT_HOSTS.has(url.hostname)) return 'sandbox';
    return null;
  } catch {
    return null;
  }
}

export function allowedPaymentOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') return null;
    if (!paymentEnvironmentForOrigin(value)) return null;
    return url.origin;
  } catch {
    return null;
  }
}