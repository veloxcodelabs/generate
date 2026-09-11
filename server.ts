/**
 * Главен сървърен файл (Express + Vite)
 *
 * Интегрира:
 * 1. Stripe Checkout & Webhook с криптографска верификация на подписа.
 * 2. AI Video API (POST /api/generate-video и GET /api/video-status/:renderId).
 * 3. Логика за кредитен баланс с идемпотентна защита.
 * 4. Съвместимост с Vite middleware локално и Vercel Serverless при деплоймънт.
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { app } from './src/server/app.ts';
import { config } from './src/server/config.ts';

const PORT = 3000;

async function startServer() {
  // --------------------------------------------------------------------------
  // VITE MIDDLEWARE (DEVELOPMENT) ИЛИ СТАТИЧНИ ФАЙЛОВЕ (PRODUCTION)
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
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // --------------------------------------------------------------------------
  // СТАРТИРАНЕ НА СЪРВЪРА (0.0.0.0:3000)
  // --------------------------------------------------------------------------
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`🚀 Сървърът работи на: http://0.0.0.0:${PORT}`);
    console.log(`💳 Stripe Webhook: POST http://0.0.0.0:${PORT}/api/stripe/webhook`);
    console.log(`🎬 AI Video Render:  POST http://0.0.0.0:${PORT}/api/generate-video`);
    console.log(`🔍 AI Video Status:  GET  http://0.0.0.0:${PORT}/api/video-status/:renderId`);
    console.log(`⚙️ Stripe конфигуриран: ${config.isStripeConfigured() ? 'ДА' : 'НЕ (тестов режим)'}`);
    console.log(`⚙️ Видео API конфигуриран: ${config.isViggleConfigured() ? 'ДА' : 'НЕ (симулиран режим)'}`);
    console.log(`=======================================================`);
  });
}

startServer().catch((err) => {
  console.error('Грешка при стартиране на сървъра:', err);
  process.exit(1);
});

