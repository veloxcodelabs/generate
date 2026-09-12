/**
 * Конфигурация на сървъра и външните услуги (Environment Configuration)
 */

export const config = {
  port: 3000,
  appUrl: process.env.APP_URL || 'http://localhost:3000',

  // Stripe ключове
  stripe: {
    secretKey: (process.env.STRIPE_SECRET_KEY || '').trim(),
    webhookSecret: (process.env.STRIPE_WEBHOOK_SECRET || '').trim(),
    priceIdSmall: (process.env.STRIPE_PRICE_ID_SMALL || '').trim(),
    priceIdLarge: (process.env.STRIPE_PRICE_ID_LARGE || '').trim(),
  },

  // Viggle AI V1 API
  viggle: {
    apiKey: (process.env.VIGGLE_API_KEY || 'sk-SuAlHcvgGMTdtUIQc45SjvCg1bsOgT-3m16osUPzwWXYh').trim(),
    apiBaseUrl: (process.env.VIGGLE_API_BASE_URL || 'https://apis.viggle.ai/v1').trim().replace(/\/$/, ''),
  },

  // Проверка дали ключовете са конфигурирани
  isStripeConfigured(): boolean {
    return Boolean(this.stripe.secretKey && !this.stripe.secretKey.includes('sk_test_...'));
  },

  isViggleConfigured(): boolean {
    return Boolean(this.viggle.apiKey && this.viggle.apiKey !== 'your_viggle_api_key_here');
  },
};
