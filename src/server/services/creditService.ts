/**
 * Сервиз за управление на кредити и транзакции (Credit Management Service)
 */

import { db } from '../db/db.ts';
import { User, Transaction } from '../db/types.ts';

export class CreditService {
  /**
   * Проверява дали даден потребител има поне минималния изискван брой кредити
   */
  static async hasSufficientCredits(userId: string, requiredCredits: number = 1): Promise<boolean> {
    let user = await db.getUserById(userId);
    if (!user) {
      user = await db.getOrCreateUser(userId);
    }
    return user.credits >= requiredCredits;
  }

  /**
   * Удържа кредити от баланса на потребителя (напр. 1 кредит за генериране на видео)
   */
  static async deductCredits(userId: string, creditsToDeduct: number = 1): Promise<User> {
    if (creditsToDeduct <= 0) {
      throw new Error('Броят кредити за удържане трябва да бъде положителен.');
    }

    let user = await db.getUserById(userId);
    if (!user) {
      user = await db.getOrCreateUser(userId);
    }

    if (user.credits < creditsToDeduct) {
      throw new Error(
        `Нямате достатъчно кредити! Налични: ${user.credits}, Необходими: ${creditsToDeduct}. Моля, закупете още кредити.`
      );
    }

    // Удържане на кредитите в базата данни
    const updatedUser = await db.updateUserCredits(user.id, -creditsToDeduct);
    return updatedUser;
  }

  /**
   * Добавя кредити към потребител при успешно плащане през Stripe Webhook.
   * Включва идемпотентност (idempotency check) срещу двойно отчитане при повтарящи се webhook извиквания.
   */
  static async addCreditsFromPayment(params: {
    userId: string;
    stripeSessionId: string;
    stripePaymentId?: string;
    creditsToAdd: number;
    amountPaid: number;
    currency: string;
    packageKey?: string;
  }): Promise<{ user: User; transaction: Transaction; alreadyProcessed: boolean }> {
    const { userId, stripeSessionId, stripePaymentId, creditsToAdd, amountPaid, currency, packageKey } = params;

    // 1. Проверка дали тази Stripe сесия вече е обработена (Идемпотентност)
    const existingTx = await db.getTransactionBySessionId(stripeSessionId);
    if (existingTx && existingTx.status === 'COMPLETED') {
      console.log(`[CreditService] Stripe сесия ${stripeSessionId} вече е обработена. Пропуска се повторно кредитиране.`);
      const user = (await db.getUserById(userId))!;
      return { user, transaction: existingTx, alreadyProcessed: true };
    }

    // 2. Намиране на потребителя
    let user = await db.getUserById(userId);
    if (!user) {
      // Ако потребителят не е намерен по ID, създаваме/свързваме го
      user = await db.createUser({ id: userId, email: `user_${userId}@example.com`, credits: 0 });
    }

    // 3. Увеличаване на кредитите на потребителя
    const updatedUser = await db.updateUserCredits(userId, creditsToAdd);

    // 4. Записване на транзакцията в базата данни
    const transaction = await db.recordTransaction({
      userId,
      packageKey,
      stripeSessionId,
      stripePaymentId,
      amountPaid,
      currency,
      creditsAdded: creditsToAdd,
      status: 'COMPLETED',
    });

    console.log(
      `[CreditService] Успешно добавени ${creditsToAdd} кредита на потребител ${userId}. Нов баланс: ${updatedUser.credits}`
    );

    return { user: updatedUser, transaction, alreadyProcessed: false };
  }
}
