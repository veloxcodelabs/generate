/**
 * Главен сървърен файл (Express + Vite)
 *
 * Интегрира:
 * 1. Stripe Checkout & Webhook с криптографска верификация на подписа.
 * 2. Viggle AI V1 API (POST /api/generate-video и GET /api/video-status/:renderId).
 * 3. Логика за кредитен баланс с идемпотентна защита.
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { StripeController } from './src/server/controllers/stripeController.ts';
import { stripeRouter } from './src/server/routes/stripeRoutes.ts';
import { viggleRouter } from './src/server/routes/viggleRoutes.ts';
import { userRouter } from './src/server/routes/userRoutes.ts';
import { uploadRouter } from './src/server/routes/uploadRoutes.ts';
import { config } from './src/server/config.ts';
import fs from 'fs';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Директория за съхранение на качени потребителски файлове (изображения и моушън видеа)
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  // Публично статично сервиране на качените файлове с подходящи заглавни части
  app.use('/uploads', express.static(uploadsDir, {
    maxAge: '1d',
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
    },
  }));

  // --------------------------------------------------------------------------
  // 1. STRIPE WEBHOOK ROUTE (ТРЯБВА ДА Е ПРЕДИ express.json())
  // --------------------------------------------------------------------------
  // Stripe изисква суровото тяло (raw Buffer), за да валидира криптографския подпис
  // на събитието checkout.session.completed чрез stripe.webhooks.constructEvent
  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json' }),
    StripeController.handleWebhook
  );

  // --------------------------------------------------------------------------
  // 2. СТАНДАРТНИ BODY PARSERS ЗА ОСТАНАЛИТЕ ЕНДПОЙНТИ
  // --------------------------------------------------------------------------
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // --------------------------------------------------------------------------
  // 3. API МАРШРУТИ
  // --------------------------------------------------------------------------
  // Проверка за работоспособност
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Viggle AI & Stripe Credit Backend',
      timestamp: new Date().toISOString(),
      stripeConfigured: config.isStripeConfigured(),
      viggleConfigured: config.isViggleConfigured(),
    });
  });

  // Ендпойнти за Viggle AI (директно на /api/generate-video и /api/video-status/:renderId)
  app.use('/api', viggleRouter);

  // Ендпойнт за качване на медийни файлове (POST /api/upload)
  app.use('/api', uploadRouter);

  // Ендпойнти за Stripe (пакети, checkout session, тестова симулация)
  app.use('/api/stripe', stripeRouter);

  // Ендпойнти за потребителски профил и история
  app.use('/api/user', userRouter);

  // --------------------------------------------------------------------------
  // 4. VITE MIDDLEWARE (DEVELOPMENT) ИЛИ СТАТИЧНИ ФАЙЛОВЕ (PRODUCTION)
  // --------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // --------------------------------------------------------------------------
  // 5. СТАРТИРАНЕ НА СЪРВЪРА (0.0.0.0:3000)
  // --------------------------------------------------------------------------
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`🚀 Сървърът работи на: http://0.0.0.0:${PORT}`);
    console.log(`💳 Stripe Webhook: POST http://0.0.0.0:${PORT}/api/stripe/webhook`);
    console.log(`🎬 Viggle Render:  POST http://0.0.0.0:${PORT}/api/generate-video`);
    console.log(`🔍 Viggle Status:  GET  http://0.0.0.0:${PORT}/api/video-status/:renderId`);
    console.log(`⚙️ Stripe конфигуриран: ${config.isStripeConfigured() ? 'ДА' : 'НЕ (тестов режим)'}`);
    console.log(`⚙️ Viggle конфигуриран: ${config.isViggleConfigured() ? 'ДА' : 'НЕ (симулиран режим)'}`);
    console.log(`=======================================================`);
  });
}

startServer().catch((err) => {
  console.error('Грешка при стартиране на сървъра:', err);
  process.exit(1);
});
