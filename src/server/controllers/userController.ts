/**
 * User Controller
 * Връща информация за текущия потребител, баланс на кредити и история
 */

import { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/db.ts';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + '_salt_viggle_ai').digest('hex');
}

export class UserController {
  /**
   * POST /api/auth/google
   * Вход и регистрация с Google / Gmail
   */
  static async googleAuth(req: Request, res: Response) {
    try {
      const { email, name, avatarUrl } = req.body;
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'Невалиден Google / Gmail имейл адрес.' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      let user = await db.getUserByEmail(normalizedEmail);
      let isNew = false;

      if (!user) {
        isNew = true;
        user = await db.createUser({
          email: normalizedEmail,
          name: name || normalizedEmail.split('@')[0],
          avatarUrl: avatarUrl || undefined,
          authProvider: 'google',
          credits: 1, // 1 бонус кредит за нови регистрации
        });
      } else {
        // Обновяване на името или аватара при необходимост
        if ((name && name !== user.name) || (avatarUrl && avatarUrl !== user.avatarUrl)) {
          user = await db.updateUserProfile(user.id, {
            name: name || user.name,
            avatarUrl: avatarUrl || user.avatarUrl,
          });
        }
      }

      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          credits: user.credits,
          avatarUrl: user.avatarUrl,
          authProvider: user.authProvider,
        },
        isNew,
        message: isNew
          ? 'Успешна регистрация с Google! Получихте 1 начален видео кредит.'
          : 'Успешен вход с Вашия Google акаунт.',
      });
    } catch (error: any) {
      console.error('[UserController] Грешка при Google автентикация:', error);
      return res.status(500).json({ error: error.message || 'Грешка при вход с Google.' });
    }
  }

  /**
   * POST /api/auth/register
   * Регистрация с имейл и парола
   */
  static async register(req: Request, res: Response) {
    try {
      const { email, password, name } = req.body;

      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'Моля, въведете валиден имейл адрес.' });
      }

      if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: 'Паролата трябва да съдържа минимум 6 символа.' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const existingUser = await db.getUserByEmail(normalizedEmail);

      if (existingUser) {
        return res.status(400).json({
          error: 'Вече съществува профил с този имейл адрес. Моля, влезте в профила си.',
        });
      }

      const passwordHash = hashPassword(password);
      const newUser = await db.createUser({
        email: normalizedEmail,
        name: name?.trim() || normalizedEmail.split('@')[0],
        passwordHash,
        authProvider: 'email',
        credits: 1, // 1 бонус кредит при регистрация
      });

      return res.status(201).json({
        success: true,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          credits: newUser.credits,
          avatarUrl: newUser.avatarUrl,
          authProvider: newUser.authProvider,
        },
        message: 'Акаунтът е създаден успешно! Получихте 1 бонус кредит.',
      });
    } catch (error: any) {
      console.error('[UserController] Грешка при регистрация:', error);
      return res.status(500).json({ error: error.message || 'Грешка при създаване на профил.' });
    }
  }

  /**
   * POST /api/auth/login
   * Вход с имейл и парола
   */
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Моля, попълнете имейл и парола.' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const user = await db.getUserByEmail(normalizedEmail);

      if (!user) {
        return res.status(401).json({ error: 'Няма намерен профил с този имейл адрес.' });
      }

      if (user.authProvider === 'google' && !user.passwordHash) {
        return res.status(400).json({
          error: 'Този профил е регистриран чрез Google. Моля, използвайте бутона "Продължи с Google / Gmail".',
        });
      }

      const expectedHash = hashPassword(password);
      if (user.passwordHash !== expectedHash) {
        return res.status(401).json({ error: 'Грешна парола. Моля, опитайте отново.' });
      }

      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          credits: user.credits,
          avatarUrl: user.avatarUrl,
          authProvider: user.authProvider,
        },
        message: 'Успешен вход!',
      });
    } catch (error: any) {
      console.error('[UserController] Грешка при вход:', error);
      return res.status(500).json({ error: error.message || 'Грешка при вход в системата.' });
    }
  }

  /**
   * GET /api/user/me
   * Връща потребителски данни и баланс на кредити
   */
  static async getProfile(req: Request, res: Response) {
    try {
      const userId = (req.query.userId as string) || 'usr_demo_123';
      const email = (req.query.email as string) || undefined;
      const name = (req.query.name as string) || undefined;

      let user = await db.getUserById(userId);

      if (!user && email) {
        user = await db.getUserByEmail(email);
      }

      if (!user) {
        if (userId && userId !== 'usr_demo_123') {
          user = await db.getOrCreateUser(userId, {
            email: email || `${userId}@user.local`,
            name: name || 'Потребител',
            credits: 0,
          });
        } else {
          user = await db.getOrCreateDefaultUser();
        }
      }

      const transactions = await db.listTransactions(user.id);
      const videos = await db.listVideoRenders(user.id);

      return res.json({
        user,
        transactionsCount: transactions.length,
        videosCount: videos.length,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/user/reset-credits
   * Спомагателен инструмент за тестване на баланса
   */
  static async resetCredits(req: Request, res: Response) {
    try {
      const { userId = 'usr_demo_123', credits = 0 } = req.body;
      let user = await db.getUserById(userId);
      if (!user) {
        user = await db.getOrCreateUser(userId, { credits: Number(credits) });
      } else {
        user = await db.setCredits(userId, Number(credits));
      }
      return res.json({
        success: true,
        message: `Балансът бе обновен на ${user.credits} кредита.`,
        user,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/user/transactions
   */
  static async getTransactions(req: Request, res: Response) {
    try {
      const userId = (req.query.userId as string) || 'usr_demo_123';
      const transactions = await db.listTransactions(userId);
      return res.json({ transactions });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}
