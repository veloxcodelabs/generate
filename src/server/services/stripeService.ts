/**
 * Сервиз за Stripe интеграция (Checkout & Webhooks)
 * Използва официалния Stripe SDK (stripe пакет)
 */

import Stripe from 'stripe';
import { config } from '../config.ts';
import { CREDIT_PACKAGES } from '../db/db.ts';
import { CreditService } from './creditService.ts';

// Мързелива (Lazy) инициализация на Stripe клиента
let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    if (!config.stripe.secretKey) {
      throw new Error(
        'STRIPE_SECRET_KEY липсва в конфигурацията на средата. Моля, задайте го в .env файла.'
      );
    }
    stripeClient = new Stripe(config.stripe.secretKey);
  }
  return stripeClient;
}

export class StripeService {
  /**
   * Създава Stripe Checkout Session за продажба на пакет кредити (Малка или Голяма опция)
   */
  static async createCheckoutSession(params: {
    userId: string;
    packageKey: 'small' | 'large';
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<{ sessionId: string; checkoutUrl: string; isSimulated: boolean; packageDetails: any }> {
    const { userId, packageKey, successUrl, cancelUrl } = params;
    const pkg = CREDIT_PACKAGES[packageKey];

    if (!pkg) {
      throw new Error(`Невалиден пакет: "${packageKey}". Допустими стойности: 'small', 'large'.`);
    }

    const appBaseUrl = config.appUrl.replace(/\/$/, '');
    const finalSuccessUrl = successUrl || `${appBaseUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`;
    const finalCancelUrl = cancelUrl || `${appBaseUrl}/?payment=cancelled`;

    // Ако няма реално конфигуриран Stripe ключ, осигуряваме симулирана сесия за предварителен преглед
    if (!config.isStripeConfigured()) {
      const mockSessionId = `cs_test_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      return {
        sessionId: mockSessionId,
        checkoutUrl: `${appBaseUrl}/?simulated_checkout=true&session_id=${mockSessionId}&package=${packageKey}`,
        isSimulated: true,
        packageDetails: pkg,
      };
    }

    const stripe = getStripeClient();

    // Конфигуриране на артикула за плащане в Stripe
    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = pkg.stripePriceId
      ? {
          price: pkg.stripePriceId,
          quantity: 1,
        }
      : {
          price_data: {
            currency: pkg.currency,
            product_data: {
              name: pkg.name,
              description: `${pkg.description} – Зареждане на ${pkg.credits} кредита за AI Video Studio`,
              metadata: {
                credits: String(pkg.credits),
                packageKey: pkg.key,
              },
            },
            unit_amount: pkg.priceInCents,
          },
          quantity: 1,
        };

    // Създаване на Checkout Session с клиентски референции и метаданни
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      client_reference_id: userId,
      customer_email: undefined, // Може да се подаде потребителски имейл при наличност
      line_items: [lineItem],
      metadata: {
        userId: userId,
        packageKey: pkg.key,
        credits: String(pkg.credits),
      },
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
    });

    if (!session.url) {
      throw new Error('Грешка при генериране на Stripe Checkout URL.');
    }

    return {
      sessionId: session.id,
      checkoutUrl: session.url,
      isSimulated: false,
      packageDetails: pkg,
    };
  }

  /**
   * Проверява и конструира Stripe Webhook събитие от суровото тяло (raw body)
   */
  static constructWebhookEvent(rawPayload: Buffer | string, signature: string): Stripe.Event {
    if (!config.stripe.webhookSecret) {
      throw new Error(
        'STRIPE_WEBHOOK_SECRET липсва в конфигурацията на средата. Моля, конфигурирайте го за валидиране на подписа.'
      );
    }

    const stripe = getStripeClient();
    return stripe.webhooks.constructEvent(rawPayload, signature, config.stripe.webhookSecret);
  }

  /**
   * Обработва потвърдено плащане (checkout.session.completed)
   * Автоматично начислява съответните кредити в базата данни.
   */
  static async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    // 1. Извличане на метаданни и идентификатор на потребителя
    const userId = session.client_reference_id || session.metadata?.userId;
    const packageKey = (session.metadata?.packageKey as 'small' | 'large') || 'small';
    const metadataCredits = session.metadata?.credits ? parseInt(session.metadata.credits, 10) : null;

    // Определяне на точния брой кредити от пакета
    const creditsToAdd = metadataCredits || (CREDIT_PACKAGES[packageKey]?.credits ?? 50);

    if (!userId) {
      console.error('[Stripe Webhook] Грешка: Липсва userId в метаданните на сесията:', session.id);
      throw new Error('Липсва userId (client_reference_id или metadata.userId) в Stripe сесията.');
    }

    const amountPaid = session.amount_total || (CREDIT_PACKAGES[packageKey]?.priceInCents ?? 0);
    const currency = session.currency || 'usd';
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : undefined;

    // 2. Извикване на сервиза за кредити с гаранция за идемпотентност
    const result = await CreditService.addCreditsFromPayment({
      userId,
      stripeSessionId: session.id,
      stripePaymentId: paymentIntentId,
      creditsToAdd,
      amountPaid,
      currency,
      packageKey,
    });

    return result;
  }

  /**
   * Симулира webhook събитие checkout.session.completed (за локални тестове и демонстрация)
   */
  static async simulateCheckoutCompleted(params: {
    userId: string;
    packageKey: 'small' | 'large';
    sessionId?: string;
  }) {
    const { userId, packageKey } = params;
    const pkg = CREDIT_PACKAGES[packageKey] || CREDIT_PACKAGES.small;
    const sessionId = params.sessionId || `cs_simulated_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    return await CreditService.addCreditsFromPayment({
      userId,
      stripeSessionId: sessionId,
      stripePaymentId: `pi_sim_${Date.now()}`,
      creditsToAdd: pkg.credits,
      amountPaid: pkg.priceInCents,
      currency: pkg.currency,
      packageKey: pkg.key,
    });
  }
}
