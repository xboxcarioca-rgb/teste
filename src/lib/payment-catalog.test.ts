import { describe, expect, it } from 'vitest';
import {
  allowedPaymentOrigin,
  getBuildPaymentEnvironment,
  PAYMENT_CATALOG,
  paymentEnvironmentForOrigin,
  paymentPriceId,
} from './payment-catalog';

describe('payment catalog', () => {
  it('keeps the four canonical prices and periods', () => {
    expect(PAYMENT_CATALOG.dtflexpro_mensal).toMatchObject({ amount: 4700, currency: 'brl', recurring: true, accessDays: 30 });
    expect(PAYMENT_CATALOG.dtflexpro_anual).toMatchObject({ amount: 14700, currency: 'brl', recurring: true, accessDays: 365 });
    expect(PAYMENT_CATALOG.dtflexpro_mensal_pix).toMatchObject({ amount: 4700, recurring: false, accessDays: 30 });
    expect(PAYMENT_CATALOG.dtflexpro_anual_pix).toMatchObject({ amount: 14700, recurring: false, accessDays: 365 });
  });

  it('maps plan and method to stable lookup keys', () => {
    expect(paymentPriceId('mensal', 'card')).toBe('dtflexpro_mensal');
    expect(paymentPriceId('mensal', 'pix')).toBe('dtflexpro_mensal_pix');
    expect(paymentPriceId('anual', 'card')).toBe('dtflexpro_anual');
    expect(paymentPriceId('anual', 'pix')).toBe('dtflexpro_anual_pix');
  });

  it('uses an explicit origin to environment map', () => {
    expect(paymentEnvironmentForOrigin('http://localhost:8080')).toBe('sandbox');
    expect(paymentEnvironmentForOrigin('https://id-preview--a7fd8d4e-d446-4b6e-a7ae-aab9c3c7e970.lovable.app')).toBe('sandbox');
    expect(paymentEnvironmentForOrigin('https://dtflexpro.com')).toBe('live');
    expect(paymentEnvironmentForOrigin('https://www.dtflexpro.com')).toBe('live');
    expect(paymentEnvironmentForOrigin('https://dtflex.lovable.app')).toBe('live');
    expect(paymentEnvironmentForOrigin('https://attacker.lovable.app')).toBeNull();
    expect(allowedPaymentOrigin('https://attacker.lovable.app')).toBeNull();
  });

  it('fails closed when the test runner has no payment token', () => {
    expect(() => getBuildPaymentEnvironment()).toThrow('Os pagamentos ainda não estão configurados');
  });
});