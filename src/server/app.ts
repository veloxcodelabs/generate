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

  // Деактивиране на ETag генерацията за Express, за да не се връща 304 Not Modified
  // при периодично запитване (polling) на динамични API ендпойнти като статус на видео и кредити
  app.set('etag', false);

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

  // Забрана за кеширане на всички /api заявки, за да се гарантира винаги актуална информация
  app.use('/api', (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
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
  // --------------------------------------------------------------------------
  // 3. HEALTH CHECK & UPLOADS STATIC SERVING
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

  // Директен ендпойнт за извличане на качен файл от диск (/tmp/uploads или ./uploads)
  const serveUploadFile = (req: Request, res: Response) => {
    const filename = path.basename(req.params.filename || '');
    if (!filename) {
      return res.status(400).json({ error: 'Липсва име на файл.' });
    }
    const possiblePaths = [
      path.join('/tmp', 'uploads', filename),
      path.join(process.cwd(), 'uploads', filename),
    ];
    for (const p of possiblePaths) {
      try {
        if (fs.existsSync(p)) {
          return res.sendFile(p);
        }
      } catch {
        // продължаваме към следващия възможен път
      }
    }
    return res.status(404).json({ error: `Файлът "${filename}" не беше намерен.` });
  };

  app.get('/uploads/:filename', serveUploadFile);
  app.get('/api/uploads/:filename', serveUploadFile);

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

  // --------------------------------------------------------------------------
  // 5. JSON 404 & ГЛОБАЛЕН ERROR HANDLER (Express Никога не връща HTML грешки)
  // --------------------------------------------------------------------------
  app.use('/api', (req: Request, res: Response) => {
    res.status(404).json({
      error: `API маршрутът не е намерен: ${req.method} ${req.originalUrl || req.url}`,
    });
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Express Global Error]:', err);
    if (!res.headersSent) {
      const statusCode = typeof err.statusCode === 'number' && err.statusCode >= 400 ? err.statusCode : 500;
      res.status(statusCode).json({
        error: err.message || 'Възникна сървърна грешка при обработка на заявката.',
        details: err.details || (process.env.NODE_ENV === 'production' ? undefined : err.stack),
      });
    }
  });

  return app;
}

export const app = createExpressApp();

/**
 * Главен експорт съвместим с Vercel Serverless Functions (@vercel/node)
 * и стандартен Express middleware.
 */
export default function handler(req: any, res: any) {
  return app(req, res);
}
