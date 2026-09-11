/**
 * Stripe Controller
 * Управлява създаването на Checkout сесии и обработката на Webhooks
 */

import { Request, Response } from 'express';
import { StripeService } from '../services/stripeService.ts';
import { CREDIT_PACKAGES } from '../db/db.ts';

export class StripeController {
  /**
   * Връща наличните пакети с кредити (Малка и Голяма опция)
   * GET /api/stripe/packages
   */
  static async getPackages(req: Request, res: Response) {
    return res.json({
      packages: Object.values(CREDIT_PACKAGES),
    });
  }

  /**
   * Създава Stripe Checkout Session за покупка на кредити
   * POST /api/stripe/create-checkout-session
   * Body: { userId: string, packageKey: 'small' | 'large' }
   */
  static async createCheckoutSession(req: Request, res: Response) {
    try {
      const { userId = 'usr_demo_123', packageKey } = req.body;

      if (!packageKey || !['small', 'large'].includes(packageKey)) {
        return res.status(400).json({
          error: 'Невалиден пакет. Моля изберете "small" (50 кредита) или "large" (200 кредита).',
        });
      }

      const result = await StripeService.createCheckoutSession({
        userId,
        packageKey,
      });

      return res.json(result);
    } catch (error: any) {
      console.error('[StripeController] Грешка при създаване на сесия:', error);
      return res.status(500).json({
        error: error.message || 'Възникна грешка при създаване на платежната сесия в Stripe.',
      });
    }
  }

  /**
   * Stripe Webhook Endpoint
   * POST /api/stripe/webhook
   * ВАЖНО: Този ендпойнт изисква express.raw({ type: 'application/json' }), за да се верифицира подписът!
   */
  static async handleWebhook(req: Request, res: Response) {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      console.error('[Stripe Webhook] Липсва stripe-signature заглавие.');
      return res.status(400).send('Липсва stripe-signature заглавие.');
    }

    try {
      // 1. Верифициране на криптографския подпис на Stripe с помощта на STRIPE_WEBHOOK_SECRET
      const event = StripeService.constructWebhookEvent(req.body, signature);

      console.log(`[Stripe Webhook] Получено валидно събитие: ${event.type} [${event.id}]`);

      // 2. Обработка на събитието checkout.session.completed
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as any;
        const result = await StripeService.handleCheckoutSessionCompleted(session);

        console.log(`[Stripe Webhook] Успешно обработено плащане за потребител: ${result.user.id}`);
      } else {
        console.log(`[Stripe Webhook] Пренебрегнато събитие от тип: ${event.type}`);
      }

      // 3. Връщане на 200 OK към Stripe, за да се маркира успешното получаване
      return res.status(200).json({ received: true });
    } catch (err: any) {
      console.error(`[Stripe Webhook] Грешка при валидиране/обработка:`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }

  /**
   * Тестов ендпойнт за директна симулация на checkout.session.completed от UI прегледа
   * POST /api/stripe/simulate-webhook
   */
  static async simulateWebhook(req: Request, res: Response) {
    try {
      const { userId = 'usr_demo_123', packageKey = 'small', sessionId } = req.body;
      const result = await StripeService.simulateCheckoutCompleted({
        userId,
        packageKey,
        sessionId,
      });

      return res.json({
        success: true,
        message: `Успешно симулирано плащане! Добавени са ${result.transaction.creditsAdded} кредита.`,
        user: result.user,
        transaction: result.transaction,
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }
}
