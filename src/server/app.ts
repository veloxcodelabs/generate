/**
 * Главен Express сървърен модул (App instance)
 * Съвместим както с локален Node.js сървър (Docker / Cloud Run),
 * така и с Vercel Serverless Functions (@vercel/node).
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { StripeController } from './controllers/stripeController.ts';
import { stripeRouter } from './routes/stripeRoutes.ts';
import { viggleRouter } from './routes/viggleRoutes.ts';
import { userRouter } from './routes/userRoutes.ts';
import { uploadRouter } from './routes/uploadRoutes.ts';
import { config } from './config.ts';

export function createExpressApp() {
  const app = express();

  // На Vercel Serverless среда файловата система в process.cwd() е read-only.
  // Затова при Vercel деплоймънт ползваме /tmp/uploads.
  const uploadsDir = process.env.VERCEL
    ? path.join('/tmp', 'uploads')
    : path.join(process.cwd(), 'uploads');

  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch (err) {
    console.warn('[App] Предупреждение при създаване на uploads директория:', err);
  }

  // Публично статично сервиране на качените файлове с CORS поддръжка
  app.use('/uploads', express.static(uploadsDir, {
    maxAge: '1d',
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
    },
  }));

  // Глобален CORS за безпроблемна работа при Vercel Preview и Production домейни
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, stripe-signature');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // --------------------------------------------------------------------------
  // 1. STRIPE WEBHOOK ROUTE (ПРЕДИ express.json())
  // --------------------------------------------------------------------------
  // Stripe изисква суровия буфер (raw Buffer), за да валидира криптографския подпис
  app.post(
    ['/api/stripe/webhook', '/stripe/webhook'],
    express.raw({ type: 'application/json' }),
    StripeController.handleWebhook
  );

  // --------------------------------------------------------------------------
  // 2. СТАНДАРТНИ BODY PARSERS ЗА ОСТАНАЛИТЕ ЕНДПОЙНТИ
  // --------------------------------------------------------------------------
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // --------------------------------------------------------------------------
  // 3. HEALTH CHECK ЕНДПОЙНТ
  // --------------------------------------------------------------------------
  const healthHandler = (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'AI Video & Stripe Credit Backend',
      platform: process.env.VERCEL ? 'vercel-serverless' : 'node-server',
      timestamp: new Date().toISOString(),
      stripeConfigured: config.isStripeConfigured(),
      viggleConfigured: config.isViggleConfigured(),
    });
  };

  app.get('/api/health', healthHandler);
  app.get('/health', healthHandler);

  // --------------------------------------------------------------------------
  // 4. API МАРШРУТИ
  // --------------------------------------------------------------------------
  // Поддържаме както стандартния префикс /api/*, така и /* директно
  // в случай, че прокси или Vercel rewrite премахне префикса /api.
  app.use('/api', viggleRouter);
  app.use('/api', uploadRouter);
  app.use('/api/stripe', stripeRouter);
  app.use('/api/user', userRouter);

  // Резервни маршрути
  app.use(viggleRouter);
  app.use(uploadRouter);
  app.use('/stripe', stripeRouter);
  app.use('/user', userRouter);

  return app;
}

export const app = createExpressApp();
export default app;
