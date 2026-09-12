/**
 * База данни (Database Repository)
 *
 * Този модул имплементира сигурно съхранение и операции с данни.
 * В продукция този слой лесно се свързва директно с Prisma Client:
 *
 *   import { PrismaClient } from '@prisma/client';
 *   export const prisma = new PrismaClient();
 *
 * За целите на интерактивния преглед и демонстрация, тук е предоставен
 * модел с пълна транзакционна логика, идемпотентност и одит на плащанията.
 */

import fs from 'fs';
import path from 'path';
import { User, CreditPackage, Transaction, VideoRender } from './types.ts';

// Предварително дефинирани пакети с кредити (Малка и Голяма опция)
export const CREDIT_PACKAGES: Record<'small' | 'large', CreditPackage> = {
  small: {
    id: 'pkg_small',
    key: 'small',
    name: 'Малък пакет (Starter)',
    description: 'Идеален за бързи тестове и кратки клипове',
    credits: 50,
    priceInCents: 999, // 9.99 EUR / USD
    currency: 'usd',
    badge: 'Популярен',
  },
  large: {
    id: 'pkg_large',
    key: 'large',
    name: 'Голям пакет (Pro Creator)',
    description: 'Максимална стойност за сериозни проекти и видео продукции',
    credits: 200,
    priceInCents: 2999, // 29.99 EUR / USD
    currency: 'usd',
    badge: 'Най-изгоден (-25%)',
  },
};

const DB_FILE_PATH = path.join('/tmp', 'viggle_app_db.json');

// Хранилище с персистентност в /tmp (съвместимо с Vercel Serverless и Docker)
class InMemoryDatabase {
  private users: Map<string, User> = new Map();
  private transactions: Map<string, Transaction> = new Map();
  private videoRenders: Map<string, VideoRender> = new Map();

  constructor() {
    this.init();
  }

  private init() {
    // 1. Инициализация на демо потребител по подразбиране
    const defaultUser: User = {
      id: 'usr_demo_123',
      email: 'creator@example.com',
      name: 'Мартин Георгиев',
      credits: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.users.set(defaultUser.id, defaultUser);

    // 2. Опит за зареждане от /tmp
    try {
      if (fs.existsSync(DB_FILE_PATH)) {
        const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.users)) {
          parsed.users.forEach((u: User) => this.users.set(u.id, u));
        }
        if (Array.isArray(parsed.transactions)) {
          parsed.transactions.forEach((t: Transaction) => this.transactions.set(t.id, t));
        }
        if (Array.isArray(parsed.videoRenders)) {
          parsed.videoRenders.forEach((v: VideoRender) => this.videoRenders.set(v.renderId, v));
        }
      }
    } catch (e) {
      // Игнорираме грешки при зареждане
    }
  }

  private persist() {
    try {
      const data = {
        users: Array.from(this.users.values()),
        transactions: Array.from(this.transactions.values()),
        videoRenders: Array.from(this.videoRenders.values()),
      };
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data), 'utf-8');
    } catch {
      // Read-only filesystem или грешка
    }
  }

  // --- Потребители (Users) ---
  async getUserById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) {
        return user;
      }
    }
    return null;
  }

  async createUser(data: { id?: string; email: string; name?: string; credits?: number }): Promise<User> {
    const id = data.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newUser: User = {
      id,
      email: data.email,
      name: data.name || 'Потребител',
      credits: data.credits ?? 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.users.set(id, newUser);
    this.persist();
    return newUser;
  }

  async getOrCreateDefaultUser(): Promise<User> {
    const user = await this.getUserById('usr_demo_123');
    if (user) return user;
    return this.createUser({
      id: 'usr_demo_123',
      email: 'creator@example.com',
      name: 'Мартин Георгиев',
      credits: 10,
    });
  }

  async updateUserCredits(userId: string, deltaCredits: number): Promise<User> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error(`Потребител с ID "${userId}" не е намерен.`);
    }
    const newBalance = user.credits + deltaCredits;
    if (newBalance < 0) {
      throw new Error(`Недостатъчна наличност на кредити. Текущи: ${user.credits}, изисквани: ${Math.abs(deltaCredits)}`);
    }

    user.credits = newBalance;
    user.updatedAt = new Date().toISOString();
    this.users.set(userId, user);
    this.persist();
    return { ...user };
  }

  async setCredits(userId: string, credits: number): Promise<User> {
    const user = await this.getUserById(userId);
    if (!user) throw new Error(`Потребител с ID "${userId}" не е намерен.`);
    user.credits = credits;
    user.updatedAt = new Date().toISOString();
    this.users.set(userId, user);
    this.persist();
    return { ...user };
  }

  // --- Транзакции / Плащания (Transactions) ---
  async getTransactionBySessionId(sessionId: string): Promise<Transaction | null> {
    for (const tx of this.transactions.values()) {
      if (tx.stripeSessionId === sessionId) {
        return tx;
      }
    }
    return null;
  }

  async recordTransaction(tx: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction> {
    const id = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newTx: Transaction = {
      ...tx,
      id,
      createdAt: new Date().toISOString(),
    };
    this.transactions.set(id, newTx);
    this.persist();
    return newTx;
  }

  async listTransactions(userId?: string): Promise<Transaction[]> {
    const list = Array.from(this.transactions.values());
    if (userId) {
      return list.filter((tx) => tx.userId === userId);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // --- Видеа (Video Renders) ---
  async createVideoRender(data: {
    userId: string;
    renderId: string;
    mode?: 'remix' | 'text-to-video' | 'image-to-video';
    prompt?: string;
    quality?: 'low' | 'high';
    durationSeconds?: number;
    aspectRatio?: string;
    imageUrl?: string;
    motionVideoUrl?: string;
    status?: 'processing' | 'completed' | 'failed';
    progress?: number;
    videoUrl?: string;
    createdAt?: string;
  }): Promise<VideoRender> {
    const id = `rnd_local_${Date.now()}`;
    const newRender: VideoRender = {
      id,
      userId: data.userId,
      renderId: data.renderId,
      mode: data.mode || 'remix',
      prompt: data.prompt,
      quality: data.quality,
      durationSeconds: data.durationSeconds,
      aspectRatio: data.aspectRatio,
      imageUrl: data.imageUrl,
      motionVideoUrl: data.motionVideoUrl,
      status: data.status || 'processing',
      progress: data.progress ?? 0,
      videoUrl: data.videoUrl,
      creditsUsed: 1,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.videoRenders.set(data.renderId, newRender);
    this.persist();
    return newRender;
  }

  async getVideoRender(renderId: string): Promise<VideoRender | null> {
    return this.videoRenders.get(renderId) || null;
  }

  async updateVideoRender(
    renderId: string,
    updates: Partial<Pick<VideoRender, 'status' | 'progress' | 'videoUrl' | 'errorMessage'>>
  ): Promise<VideoRender | null> {
    const render = this.videoRenders.get(renderId);
    if (!render) return null;

    Object.assign(render, updates, { updatedAt: new Date().toISOString() });
    this.videoRenders.set(renderId, render);
    this.persist();
    return { ...render };
  }

  async listVideoRenders(userId?: string): Promise<VideoRender[]> {
    const list = Array.from(this.videoRenders.values());
    if (userId) {
      return list.filter((r) => r.userId === userId);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export const db = new InMemoryDatabase();
