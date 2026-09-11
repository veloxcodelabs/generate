/**
 * User Controller
 * Връща информация за текущия потребител, баланс на кредити и история
 */

import { Request, Response } from 'express';
import { db } from '../db/db.ts';

export class UserController {
  /**
   * GET /api/user/me
   * Връща потребителски данни и баланс на кредити
   */
  static async getProfile(req: Request, res: Response) {
    try {
      const userId = (req.query.userId as string) || 'usr_demo_123';
      let user = await db.getUserById(userId);

      if (!user) {
        user = await db.getOrCreateDefaultUser();
      }

      const transactions = await db.listTransactions(userId);
      const videos = await db.listVideoRenders(userId);

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
      const { userId = 'usr_demo_123', credits = 10 } = req.body;
      const updatedUser = await db.setCredits(userId, Number(credits));
      return res.json({
        success: true,
        message: `Балансът бе обновен на ${updatedUser.credits} кредита.`,
        user: updatedUser,
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
