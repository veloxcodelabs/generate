/**
 * Маршрути за потребителски данни и кредитен баланс
 */

import { Router } from 'express';
import { UserController } from '../controllers/userController.ts';

export const userRouter = Router();

// Автентикация: Регистрация и Вход (Google / Имейл)
userRouter.post('/auth/google', UserController.googleAuth);
userRouter.post('/auth/register', UserController.register);
userRouter.post('/auth/login', UserController.login);

// Потребителски профил и баланс
userRouter.get('/me', UserController.getProfile);
userRouter.post('/reset-credits', UserController.resetCredits);
userRouter.get('/transactions', UserController.getTransactions);
