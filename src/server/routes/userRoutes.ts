/**
 * Маршрути за потребителски данни и кредитен баланс
 */

import { Router } from 'express';
import { UserController } from '../controllers/userController.ts';

export const userRouter = Router();

userRouter.get('/me', UserController.getProfile);
userRouter.post('/reset-credits', UserController.resetCredits);
userRouter.get('/transactions', UserController.getTransactions);
