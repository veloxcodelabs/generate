/**
 * Маршрути за Stripe интеграция
 */

import { Router } from 'express';
import { StripeController } from '../controllers/stripeController.ts';

export const stripeRouter = Router();

// Връща наличните пакети с кредити (малък и голям)
stripeRouter.get('/packages', StripeController.getPackages);

// Създаване на Stripe Checkout Session
stripeRouter.post('/create-checkout-session', StripeController.createCheckoutSession);

// Тестова симулация на Webhook (за локално тестване)
stripeRouter.post('/simulate-webhook', StripeController.simulateWebhook);
