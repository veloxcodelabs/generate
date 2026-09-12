/**
 * Маршрути за Viggle AI API (V1)
 */

import { Router } from 'express';
import { ViggleController } from '../controllers/viggleController.ts';

export const viggleRouter = Router();

// ЕНДПОЙНТ 1: Проверява за поне 1 кредит, изпраща към Viggle, удържа 1 кредит и връща renderId
// Поддържа режими: 'remix', 'text-to-video', 'image-to-video'
viggleRouter.post('/generate-video', ViggleController.generateVideo);

// Директни маршрути за съответните режими
viggleRouter.post('/text-to-video', ViggleController.textToVideo);
viggleRouter.post('/image-to-video', ViggleController.imageToVideo);

// ЕНДПОЙНТ 2: Проверява статуса на задачата към Viggle AI и връща линка към готовото видео
viggleRouter.get('/video-status/:renderId', ViggleController.getVideoStatus);

// Списък с генерираните видеа на потребителя
viggleRouter.get('/videos', ViggleController.listUserVideos);

// Баланс на кредити от реалния Viggle AI акаунт
viggleRouter.get('/viggle/credits', ViggleController.getAccountCredits);
