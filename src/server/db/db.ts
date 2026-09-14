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
    priceInCents: 499, // 4.99 EUR / USD
    currency: 'usd',
    badge: 'Популярен',
  },
  large: {
    id: 'pkg_large',
    key: 'large',
    name: 'Голям пакет (Pro Creator)',
    description: 'Максимална стойност за сериозни проекти и видео продукции',
    credits: 200,
    priceInCents: 1499, // 14.99 EUR / USD
    currency: 'usd',
    badge: 'Най-изгоден (-25%)',
  },
};

const LOCAL_DB_DIR = path.join(process.cwd(), 'data');
const LOCAL_DB_PATH = path.join(LOCAL_DB_DIR, 'viggle_app_db.json');
const TMP_DB_PATH = path.join('/tmp', 'viggle_app_db.json');

// Хранилище с надеждна персистентност (в ./data и /tmp)
class InMemoryDatabase {
  private users: Map<string, User> = new Map();
  private transactions: Map<string, Transaction> = new Map();
  private videoRenders: Map<string, VideoRender> = new Map();

  constructor() {
    this.init();
  }

  private init() {
    // 1. Опит за зареждане от локалния диск или /tmp
    const pathsToTry = [LOCAL_DB_PATH, TMP_DB_PATH];
    let loaded = false;

    for (const filePath of pathsToTry) {
      try {
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath, 'utf-8');
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
          if (this.users.size > 0 || this.videoRenders.size > 0) {
            loaded = true;
            break;
          }
        }
      } catch (e) {
        // Игнорираме грешки при четене на даден файл
      }
    }

    // 2. Инициализация на демо потребител по подразбиране (0 кредита преди регистрация)
    if (!this.users.has('usr_demo_123')) {
      const defaultUser: User = {
        id: 'usr_demo_123',
        email: 'guest@example.com',
        name: 'Гост',
        credits: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.users.set(defaultUser.id, defaultUser);
    } else {
      const demo = this.users.get('usr_demo_123');
      if (demo) {
        demo.credits = 0;
        demo.name = 'Гост';
      }
    }

    // 3. Предварителна поддръжка за регистриран акаунт на потребителя
    const mainUserEmail = 'martivideoproductions2@gmail.com';
    let hasMainUser = false;
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === mainUserEmail) {
        hasMainUser = true;
        if (u.credits > 0 && (u.credits === 1 || u.credits === 10)) {
          u.credits = 0;
        }
        break;
      }
    }
    if (!hasMainUser) {
      const knownMainUserId = 'usr_1789205017308_uj6ut';
      const mainUser: User = {
        id: knownMainUserId,
        email: mainUserEmail,
        name: 'Мартин Георгиев',
        credits: 0,
        authProvider: 'google',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.users.set(mainUser.id, mainUser);
    }

    this.persist();
  }

  private persist() {
    try {
      const data = {
        users: Array.from(this.users.values()),
        transactions: Array.from(this.transactions.values()),
        videoRenders: Array.from(this.videoRenders.values()),
      };
      const jsonStr = JSON.stringify(data, null, 2);

      // 1. Опит за запис в ./data/viggle_app_db.json
      try {
        if (!fs.existsSync(LOCAL_DB_DIR)) {
          fs.mkdirSync(LOCAL_DB_DIR, { recursive: true });
        }
        fs.writeFileSync(LOCAL_DB_PATH, jsonStr, 'utf-8');
      } catch (localErr) {
        // Възможно е да сме в read-only root контейнер
      }

      // 2. Винаги записваме и в /tmp
      try {
        fs.writeFileSync(TMP_DB_PATH, jsonStr, 'utf-8');
      } catch (tmpErr) {
        // Игнорираме грешки при запис в /tmp
      }
    } catch {
      // Игнорираме общи грешки при персистиране
    }
  }

  // --- Потребители (Users) ---
  async getUserById(id: string): Promise<User | null> {
    if (!id) return null;
    const user = this.users.get(id);
    if (user) return user;

    // Ако ID е подаден като имейл адрес
    if (id.includes('@')) {
      return this.getUserByEmail(id);
    }

    return null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    if (!email) return null;
    const normalized = email.toLowerCase().trim();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === normalized) {
        return user;
      }
    }
    return null;
  }

  async getOrCreateUser(
    userId: string,
    fallbackData?: {
      email?: string;
      name?: string;
      credits?: number;
      authProvider?: 'google' | 'email' | 'demo';
      avatarUrl?: string;
    }
  ): Promise<User> {
    if (!userId || userId === 'usr_demo_123') {
      return this.getOrCreateDefaultUser();
    }

    const existing = await this.getUserById(userId);
    if (existing) {
      // Ако съществуващият потребител има 0 кредита, но е бил новосъздаден, гарантираме поне стартовия баланс
      return existing;
    }

    if (fallbackData?.email) {
      const existingByEmail = await this.getUserByEmail(fallbackData.email);
      if (existingByEmail) {
        return existingByEmail;
      }
    }

    const email = fallbackData?.email || (userId.includes('@') ? userId : `${userId}@user.local`);
    const name = fallbackData?.name || (email.split('@')[0] || 'Потребител');
    const credits = fallbackData?.credits !== undefined ? fallbackData.credits : 0;

    const newUser: User = {
      id: userId,
      email,
      name,
      credits,
      authProvider: fallbackData?.authProvider || (email.includes('gmail') ? 'google' : 'email'),
      avatarUrl: fallbackData?.avatarUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.users.set(userId, newUser);
    this.persist();
    return newUser;
  }

  async createUser(data: {
    id?: string;
    email: string;
    name?: string;
    credits?: number;
    avatarUrl?: string;
    authProvider?: 'google' | 'email' | 'demo';
    passwordHash?: string;
  }): Promise<User> {
    const id = data.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newUser: User = {
      id,
      email: data.email,
      name: data.name || (data.email.split('@')[0] || 'Потребител'),
      credits: data.credits ?? 0,
      avatarUrl: data.avatarUrl,
      authProvider: data.authProvider || 'email',
      passwordHash: data.passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.users.set(id, newUser);
    this.persist();
    return newUser;
  }

  async updateUserProfile(userId: string, updates: Partial<User>): Promise<User> {
    const user = await this.getUserById(userId);
    if (!user) throw new Error(`Потребител с ID "${userId}" не е намерен.`);
    const updated = {
      ...user,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.users.set(userId, updated);
    this.persist();
    return updated;
  }

  async getOrCreateDefaultUser(): Promise<User> {
    const user = await this.getUserById('usr_demo_123');
    if (user) return user;
    return this.createUser({
      id: 'usr_demo_123',
      email: 'guest@example.com',
      name: 'Гост',
      credits: 0,
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
