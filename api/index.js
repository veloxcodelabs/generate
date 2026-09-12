// src/server/app.ts
import express from "express";
import path3 from "path";
import fs3 from "fs";

// src/server/services/stripeService.ts
import Stripe from "stripe";

// src/server/config.ts
var config = {
  port: 3e3,
  appUrl: process.env.APP_URL || "http://localhost:3000",
  // Stripe ключове
  stripe: {
    secretKey: (process.env.STRIPE_SECRET_KEY || "").trim(),
    webhookSecret: (process.env.STRIPE_WEBHOOK_SECRET || "").trim(),
    priceIdSmall: (process.env.STRIPE_PRICE_ID_SMALL || "").trim(),
    priceIdLarge: (process.env.STRIPE_PRICE_ID_LARGE || "").trim()
  },
  // Viggle AI V1 API
  viggle: {
    apiKey: (process.env.VIGGLE_API_KEY || "").trim(),
    apiBaseUrl: (process.env.VIGGLE_API_BASE_URL || "https://apis.viggle.ai/v1").trim().replace(/\/$/, "")
  },
  // Проверка дали ключовете са конфигурирани
  isStripeConfigured() {
    return Boolean(this.stripe.secretKey && !this.stripe.secretKey.includes("sk_test_..."));
  },
  isViggleConfigured() {
    return Boolean(this.viggle.apiKey && this.viggle.apiKey !== "your_viggle_api_key_here");
  }
};

// src/server/db/db.ts
var CREDIT_PACKAGES = {
  small: {
    id: "pkg_small",
    key: "small",
    name: "\u041C\u0430\u043B\u044A\u043A \u043F\u0430\u043A\u0435\u0442 (Starter)",
    description: "\u0418\u0434\u0435\u0430\u043B\u0435\u043D \u0437\u0430 \u0431\u044A\u0440\u0437\u0438 \u0442\u0435\u0441\u0442\u043E\u0432\u0435 \u0438 \u043A\u0440\u0430\u0442\u043A\u0438 \u043A\u043B\u0438\u043F\u043E\u0432\u0435",
    credits: 50,
    priceInCents: 999,
    // 9.99 EUR / USD
    currency: "usd",
    badge: "\u041F\u043E\u043F\u0443\u043B\u044F\u0440\u0435\u043D"
  },
  large: {
    id: "pkg_large",
    key: "large",
    name: "\u0413\u043E\u043B\u044F\u043C \u043F\u0430\u043A\u0435\u0442 (Pro Creator)",
    description: "\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u043D\u0430 \u0441\u0442\u043E\u0439\u043D\u043E\u0441\u0442 \u0437\u0430 \u0441\u0435\u0440\u0438\u043E\u0437\u043D\u0438 \u043F\u0440\u043E\u0435\u043A\u0442\u0438 \u0438 \u0432\u0438\u0434\u0435\u043E \u043F\u0440\u043E\u0434\u0443\u043A\u0446\u0438\u0438",
    credits: 200,
    priceInCents: 2999,
    // 29.99 EUR / USD
    currency: "usd",
    badge: "\u041D\u0430\u0439-\u0438\u0437\u0433\u043E\u0434\u0435\u043D (-25%)"
  }
};
var InMemoryDatabase = class {
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.transactions = /* @__PURE__ */ new Map();
    this.videoRenders = /* @__PURE__ */ new Map();
    const defaultUser = {
      id: "usr_demo_123",
      email: "creator@example.com",
      name: "\u041C\u0430\u0440\u0442\u0438\u043D \u0413\u0435\u043E\u0440\u0433\u0438\u0435\u0432",
      credits: 10,
      // Започва с 10 кредита за тестване на генерация
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.users.set(defaultUser.id, defaultUser);
  }
  // --- Потребители (Users) ---
  async getUserById(id) {
    return this.users.get(id) || null;
  }
  async getUserByEmail(email) {
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) {
        return user;
      }
    }
    return null;
  }
  async createUser(data) {
    const id = data.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newUser = {
      id,
      email: data.email,
      name: data.name || "\u041F\u043E\u0442\u0440\u0435\u0431\u0438\u0442\u0435\u043B",
      credits: data.credits ?? 5,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.users.set(id, newUser);
    return newUser;
  }
  async getOrCreateDefaultUser() {
    const user = await this.getUserById("usr_demo_123");
    if (user) return user;
    return this.createUser({
      id: "usr_demo_123",
      email: "creator@example.com",
      name: "\u041C\u0430\u0440\u0442\u0438\u043D \u0413\u0435\u043E\u0440\u0433\u0438\u0435\u0432",
      credits: 10
    });
  }
  async updateUserCredits(userId, deltaCredits) {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error(`\u041F\u043E\u0442\u0440\u0435\u0431\u0438\u0442\u0435\u043B \u0441 ID "${userId}" \u043D\u0435 \u0435 \u043D\u0430\u043C\u0435\u0440\u0435\u043D.`);
    }
    const newBalance = user.credits + deltaCredits;
    if (newBalance < 0) {
      throw new Error(`\u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u044A\u0447\u043D\u0430 \u043D\u0430\u043B\u0438\u0447\u043D\u043E\u0441\u0442 \u043D\u0430 \u043A\u0440\u0435\u0434\u0438\u0442\u0438. \u0422\u0435\u043A\u0443\u0449\u0438: ${user.credits}, \u0438\u0437\u0438\u0441\u043A\u0432\u0430\u043D\u0438: ${Math.abs(deltaCredits)}`);
    }
    user.credits = newBalance;
    user.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.users.set(userId, user);
    return { ...user };
  }
  async setCredits(userId, credits) {
    const user = await this.getUserById(userId);
    if (!user) throw new Error(`\u041F\u043E\u0442\u0440\u0435\u0431\u0438\u0442\u0435\u043B \u0441 ID "${userId}" \u043D\u0435 \u0435 \u043D\u0430\u043C\u0435\u0440\u0435\u043D.`);
    user.credits = credits;
    user.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.users.set(userId, user);
    return { ...user };
  }
  // --- Транзакции / Плащания (Transactions) ---
  async getTransactionBySessionId(sessionId) {
    for (const tx of this.transactions.values()) {
      if (tx.stripeSessionId === sessionId) {
        return tx;
      }
    }
    return null;
  }
  async recordTransaction(tx) {
    const id = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newTx = {
      ...tx,
      id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.transactions.set(id, newTx);
    return newTx;
  }
  async listTransactions(userId) {
    const list = Array.from(this.transactions.values());
    if (userId) {
      return list.filter((tx) => tx.userId === userId);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  // --- Видеа (Video Renders) ---
  async createVideoRender(data) {
    const id = `rnd_local_${Date.now()}`;
    const newRender = {
      id,
      userId: data.userId,
      renderId: data.renderId,
      mode: data.mode || "remix",
      prompt: data.prompt,
      quality: data.quality,
      durationSeconds: data.durationSeconds,
      aspectRatio: data.aspectRatio,
      imageUrl: data.imageUrl,
      motionVideoUrl: data.motionVideoUrl,
      status: data.status || "processing",
      progress: 0,
      creditsUsed: 1,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.videoRenders.set(data.renderId, newRender);
    return newRender;
  }
  async getVideoRender(renderId) {
    return this.videoRenders.get(renderId) || null;
  }
  async updateVideoRender(renderId, updates) {
    const render = this.videoRenders.get(renderId);
    if (!render) return null;
    Object.assign(render, updates, { updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
    this.videoRenders.set(renderId, render);
    return { ...render };
  }
  async listVideoRenders(userId) {
    const list = Array.from(this.videoRenders.values());
    if (userId) {
      return list.filter((r) => r.userId === userId);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
};
var db = new InMemoryDatabase();

// src/server/services/creditService.ts
var CreditService = class {
  /**
   * Проверява дали даден потребител има поне минималния изискван брой кредити
   */
  static async hasSufficientCredits(userId, requiredCredits = 1) {
    const user = await db.getUserById(userId);
    if (!user) return false;
    return user.credits >= requiredCredits;
  }
  /**
   * Удържа кредити от баланса на потребителя (напр. 1 кредит за генериране на видео)
   */
  static async deductCredits(userId, creditsToDeduct = 1) {
    if (creditsToDeduct <= 0) {
      throw new Error("\u0411\u0440\u043E\u044F\u0442 \u043A\u0440\u0435\u0434\u0438\u0442\u0438 \u0437\u0430 \u0443\u0434\u044A\u0440\u0436\u0430\u043D\u0435 \u0442\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u0431\u044A\u0434\u0435 \u043F\u043E\u043B\u043E\u0436\u0438\u0442\u0435\u043B\u0435\u043D.");
    }
    const user = await db.getUserById(userId);
    if (!user) {
      throw new Error(`\u041F\u043E\u0442\u0440\u0435\u0431\u0438\u0442\u0435\u043B \u0441 ID "${userId}" \u043D\u0435 \u0441\u044A\u0449\u0435\u0441\u0442\u0432\u0443\u0432\u0430.`);
    }
    if (user.credits < creditsToDeduct) {
      throw new Error(
        `\u041D\u044F\u043C\u0430\u0442\u0435 \u0434\u043E\u0441\u0442\u0430\u0442\u044A\u0447\u043D\u043E \u043A\u0440\u0435\u0434\u0438\u0442\u0438! \u041D\u0430\u043B\u0438\u0447\u043D\u0438: ${user.credits}, \u041D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u0438: ${creditsToDeduct}. \u041C\u043E\u043B\u044F, \u0437\u0430\u043A\u0443\u043F\u0435\u0442\u0435 \u043E\u0449\u0435 \u043A\u0440\u0435\u0434\u0438\u0442\u0438.`
      );
    }
    const updatedUser = await db.updateUserCredits(userId, -creditsToDeduct);
    return updatedUser;
  }
  /**
   * Добавя кредити към потребител при успешно плащане през Stripe Webhook.
   * Включва идемпотентност (idempotency check) срещу двойно отчитане при повтарящи се webhook извиквания.
   */
  static async addCreditsFromPayment(params) {
    const { userId, stripeSessionId, stripePaymentId, creditsToAdd, amountPaid, currency, packageKey } = params;
    const existingTx = await db.getTransactionBySessionId(stripeSessionId);
    if (existingTx && existingTx.status === "COMPLETED") {
      console.log(`[CreditService] Stripe \u0441\u0435\u0441\u0438\u044F ${stripeSessionId} \u0432\u0435\u0447\u0435 \u0435 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0435\u043D\u0430. \u041F\u0440\u043E\u043F\u0443\u0441\u043A\u0430 \u0441\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E \u043A\u0440\u0435\u0434\u0438\u0442\u0438\u0440\u0430\u043D\u0435.`);
      const user2 = await db.getUserById(userId);
      return { user: user2, transaction: existingTx, alreadyProcessed: true };
    }
    let user = await db.getUserById(userId);
    if (!user) {
      user = await db.createUser({ id: userId, email: `user_${userId}@example.com`, credits: 0 });
    }
    const updatedUser = await db.updateUserCredits(userId, creditsToAdd);
    const transaction = await db.recordTransaction({
      userId,
      packageKey,
      stripeSessionId,
      stripePaymentId,
      amountPaid,
      currency,
      creditsAdded: creditsToAdd,
      status: "COMPLETED"
    });
    console.log(
      `[CreditService] \u0423\u0441\u043F\u0435\u0448\u043D\u043E \u0434\u043E\u0431\u0430\u0432\u0435\u043D\u0438 ${creditsToAdd} \u043A\u0440\u0435\u0434\u0438\u0442\u0430 \u043D\u0430 \u043F\u043E\u0442\u0440\u0435\u0431\u0438\u0442\u0435\u043B ${userId}. \u041D\u043E\u0432 \u0431\u0430\u043B\u0430\u043D\u0441: ${updatedUser.credits}`
    );
    return { user: updatedUser, transaction, alreadyProcessed: false };
  }
};

// src/server/services/stripeService.ts
var stripeClient = null;
function getStripeClient() {
  if (!stripeClient) {
    if (!config.stripe.secretKey) {
      throw new Error(
        "STRIPE_SECRET_KEY \u043B\u0438\u043F\u0441\u0432\u0430 \u0432 \u043A\u043E\u043D\u0444\u0438\u0433\u0443\u0440\u0430\u0446\u0438\u044F\u0442\u0430 \u043D\u0430 \u0441\u0440\u0435\u0434\u0430\u0442\u0430. \u041C\u043E\u043B\u044F, \u0437\u0430\u0434\u0430\u0439\u0442\u0435 \u0433\u043E \u0432 .env \u0444\u0430\u0439\u043B\u0430."
      );
    }
    stripeClient = new Stripe(config.stripe.secretKey);
  }
  return stripeClient;
}
var StripeService = class {
  /**
   * Създава Stripe Checkout Session за продажба на пакет кредити (Малка или Голяма опция)
   */
  static async createCheckoutSession(params) {
    const { userId, packageKey, successUrl, cancelUrl } = params;
    const pkg = CREDIT_PACKAGES[packageKey];
    if (!pkg) {
      throw new Error(`\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u043F\u0430\u043A\u0435\u0442: "${packageKey}". \u0414\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0438 \u0441\u0442\u043E\u0439\u043D\u043E\u0441\u0442\u0438: 'small', 'large'.`);
    }
    const appBaseUrl = config.appUrl.replace(/\/$/, "");
    const finalSuccessUrl = successUrl || `${appBaseUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`;
    const finalCancelUrl = cancelUrl || `${appBaseUrl}/?payment=cancelled`;
    if (!config.isStripeConfigured()) {
      const mockSessionId = `cs_test_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      return {
        sessionId: mockSessionId,
        checkoutUrl: `${appBaseUrl}/?simulated_checkout=true&session_id=${mockSessionId}&package=${packageKey}`,
        isSimulated: true,
        packageDetails: pkg
      };
    }
    const stripe = getStripeClient();
    const lineItem = pkg.stripePriceId ? {
      price: pkg.stripePriceId,
      quantity: 1
    } : {
      price_data: {
        currency: pkg.currency,
        product_data: {
          name: pkg.name,
          description: `${pkg.description} \u2013 \u0417\u0430\u0440\u0435\u0436\u0434\u0430\u043D\u0435 \u043D\u0430 ${pkg.credits} \u043A\u0440\u0435\u0434\u0438\u0442\u0430 \u0437\u0430 AI Video Studio`,
          metadata: {
            credits: String(pkg.credits),
            packageKey: pkg.key
          }
        },
        unit_amount: pkg.priceInCents
      },
      quantity: 1
    };
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      client_reference_id: userId,
      customer_email: void 0,
      // Може да се подаде потребителски имейл при наличност
      line_items: [lineItem],
      metadata: {
        userId,
        packageKey: pkg.key,
        credits: String(pkg.credits)
      },
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl
    });
    if (!session.url) {
      throw new Error("\u0413\u0440\u0435\u0448\u043A\u0430 \u043F\u0440\u0438 \u0433\u0435\u043D\u0435\u0440\u0438\u0440\u0430\u043D\u0435 \u043D\u0430 Stripe Checkout URL.");
    }
    return {
      sessionId: session.id,
      checkoutUrl: session.url,
      isSimulated: false,
      packageDetails: pkg
    };
  }
  /**
   * Проверява и конструира Stripe Webhook събитие от суровото тяло (raw body)
   */
  static constructWebhookEvent(rawPayload, signature) {
    if (!config.stripe.webhookSecret) {
      throw new Error(
        "STRIPE_WEBHOOK_SECRET \u043B\u0438\u043F\u0441\u0432\u0430 \u0432 \u043A\u043E\u043D\u0444\u0438\u0433\u0443\u0440\u0430\u0446\u0438\u044F\u0442\u0430 \u043D\u0430 \u0441\u0440\u0435\u0434\u0430\u0442\u0430. \u041C\u043E\u043B\u044F, \u043A\u043E\u043D\u0444\u0438\u0433\u0443\u0440\u0438\u0440\u0430\u0439\u0442\u0435 \u0433\u043E \u0437\u0430 \u0432\u0430\u043B\u0438\u0434\u0438\u0440\u0430\u043D\u0435 \u043D\u0430 \u043F\u043E\u0434\u043F\u0438\u0441\u0430."
      );
    }
    const stripe = getStripeClient();
    return stripe.webhooks.constructEvent(rawPayload, signature, config.stripe.webhookSecret);
  }
  /**
   * Обработва потвърдено плащане (checkout.session.completed)
   * Автоматично начислява съответните кредити в базата данни.
   */
  static async handleCheckoutSessionCompleted(session) {
    const userId = session.client_reference_id || session.metadata?.userId;
    const packageKey = session.metadata?.packageKey || "small";
    const metadataCredits = session.metadata?.credits ? parseInt(session.metadata.credits, 10) : null;
    const creditsToAdd = metadataCredits || (CREDIT_PACKAGES[packageKey]?.credits ?? 50);
    if (!userId) {
      console.error("[Stripe Webhook] \u0413\u0440\u0435\u0448\u043A\u0430: \u041B\u0438\u043F\u0441\u0432\u0430 userId \u0432 \u043C\u0435\u0442\u0430\u0434\u0430\u043D\u043D\u0438\u0442\u0435 \u043D\u0430 \u0441\u0435\u0441\u0438\u044F\u0442\u0430:", session.id);
      throw new Error("\u041B\u0438\u043F\u0441\u0432\u0430 userId (client_reference_id \u0438\u043B\u0438 metadata.userId) \u0432 Stripe \u0441\u0435\u0441\u0438\u044F\u0442\u0430.");
    }
    const amountPaid = session.amount_total || (CREDIT_PACKAGES[packageKey]?.priceInCents ?? 0);
    const currency = session.currency || "usd";
    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : void 0;
    const result = await CreditService.addCreditsFromPayment({
      userId,
      stripeSessionId: session.id,
      stripePaymentId: paymentIntentId,
      creditsToAdd,
      amountPaid,
      currency,
      packageKey
    });
    return result;
  }
  /**
   * Симулира webhook събитие checkout.session.completed (за локални тестове и демонстрация)
   */
  static async simulateCheckoutCompleted(params) {
    const { userId, packageKey } = params;
    const pkg = CREDIT_PACKAGES[packageKey] || CREDIT_PACKAGES.small;
    const sessionId = params.sessionId || `cs_simulated_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    return await CreditService.addCreditsFromPayment({
      userId,
      stripeSessionId: sessionId,
      stripePaymentId: `pi_sim_${Date.now()}`,
      creditsToAdd: pkg.credits,
      amountPaid: pkg.priceInCents,
      currency: pkg.currency,
      packageKey: pkg.key
    });
  }
};

// src/server/controllers/stripeController.ts
var StripeController = class {
  /**
   * Връща наличните пакети с кредити (Малка и Голяма опция)
   * GET /api/stripe/packages
   */
  static async getPackages(req, res) {
    return res.json({
      packages: Object.values(CREDIT_PACKAGES)
    });
  }
  /**
   * Създава Stripe Checkout Session за покупка на кредити
   * POST /api/stripe/create-checkout-session
   * Body: { userId: string, packageKey: 'small' | 'large' }
   */
  static async createCheckoutSession(req, res) {
    try {
      const { userId = "usr_demo_123", packageKey } = req.body;
      if (!packageKey || !["small", "large"].includes(packageKey)) {
        return res.status(400).json({
          error: '\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u043F\u0430\u043A\u0435\u0442. \u041C\u043E\u043B\u044F \u0438\u0437\u0431\u0435\u0440\u0435\u0442\u0435 "small" (50 \u043A\u0440\u0435\u0434\u0438\u0442\u0430) \u0438\u043B\u0438 "large" (200 \u043A\u0440\u0435\u0434\u0438\u0442\u0430).'
        });
      }
      const result = await StripeService.createCheckoutSession({
        userId,
        packageKey
      });
      return res.json(result);
    } catch (error) {
      console.error("[StripeController] \u0413\u0440\u0435\u0448\u043A\u0430 \u043F\u0440\u0438 \u0441\u044A\u0437\u0434\u0430\u0432\u0430\u043D\u0435 \u043D\u0430 \u0441\u0435\u0441\u0438\u044F:", error);
      return res.status(500).json({
        error: error.message || "\u0412\u044A\u0437\u043D\u0438\u043A\u043D\u0430 \u0433\u0440\u0435\u0448\u043A\u0430 \u043F\u0440\u0438 \u0441\u044A\u0437\u0434\u0430\u0432\u0430\u043D\u0435 \u043D\u0430 \u043F\u043B\u0430\u0442\u0435\u0436\u043D\u0430\u0442\u0430 \u0441\u0435\u0441\u0438\u044F \u0432 Stripe."
      });
    }
  }
  /**
   * Stripe Webhook Endpoint
   * POST /api/stripe/webhook
   * ВАЖНО: Този ендпойнт изисква express.raw({ type: 'application/json' }), за да се верифицира подписът!
   */
  static async handleWebhook(req, res) {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      console.error("[Stripe Webhook] \u041B\u0438\u043F\u0441\u0432\u0430 stripe-signature \u0437\u0430\u0433\u043B\u0430\u0432\u0438\u0435.");
      return res.status(400).send("\u041B\u0438\u043F\u0441\u0432\u0430 stripe-signature \u0437\u0430\u0433\u043B\u0430\u0432\u0438\u0435.");
    }
    try {
      const event = StripeService.constructWebhookEvent(req.body, signature);
      console.log(`[Stripe Webhook] \u041F\u043E\u043B\u0443\u0447\u0435\u043D\u043E \u0432\u0430\u043B\u0438\u0434\u043D\u043E \u0441\u044A\u0431\u0438\u0442\u0438\u0435: ${event.type} [${event.id}]`);
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const result = await StripeService.handleCheckoutSessionCompleted(session);
        console.log(`[Stripe Webhook] \u0423\u0441\u043F\u0435\u0448\u043D\u043E \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0435\u043D\u043E \u043F\u043B\u0430\u0449\u0430\u043D\u0435 \u0437\u0430 \u043F\u043E\u0442\u0440\u0435\u0431\u0438\u0442\u0435\u043B: ${result.user.id}`);
      } else {
        console.log(`[Stripe Webhook] \u041F\u0440\u0435\u043D\u0435\u0431\u0440\u0435\u0433\u043D\u0430\u0442\u043E \u0441\u044A\u0431\u0438\u0442\u0438\u0435 \u043E\u0442 \u0442\u0438\u043F: ${event.type}`);
      }
      return res.status(200).json({ received: true });
    } catch (err) {
      console.error(`[Stripe Webhook] \u0413\u0440\u0435\u0448\u043A\u0430 \u043F\u0440\u0438 \u0432\u0430\u043B\u0438\u0434\u0438\u0440\u0430\u043D\u0435/\u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0430:`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
  /**
   * Тестов ендпойнт за директна симулация на checkout.session.completed от UI прегледа
   * POST /api/stripe/simulate-webhook
   */
  static async simulateWebhook(req, res) {
    try {
      const { userId = "usr_demo_123", packageKey = "small", sessionId } = req.body;
      const result = await StripeService.simulateCheckoutCompleted({
        userId,
        packageKey,
        sessionId
      });
      return res.json({
        success: true,
        message: `\u0423\u0441\u043F\u0435\u0448\u043D\u043E \u0441\u0438\u043C\u0443\u043B\u0438\u0440\u0430\u043D\u043E \u043F\u043B\u0430\u0449\u0430\u043D\u0435! \u0414\u043E\u0431\u0430\u0432\u0435\u043D\u0438 \u0441\u0430 ${result.transaction.creditsAdded} \u043A\u0440\u0435\u0434\u0438\u0442\u0430.`,
        user: result.user,
        transaction: result.transaction
      });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }
};

// src/server/routes/stripeRoutes.ts
import { Router } from "express";
var stripeRouter = Router();
stripeRouter.get("/packages", StripeController.getPackages);
stripeRouter.post("/create-checkout-session", StripeController.createCheckoutSession);
stripeRouter.post("/simulate-webhook", StripeController.simulateWebhook);

// src/server/routes/viggleRoutes.ts
import { Router as Router2 } from "express";

// src/server/services/viggleService.ts
import axios from "axios";
import path from "path";
import fs from "fs";
var DEMO_SAMPLE_VIDEOS = [
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4"
];
var ViggleApiError = class extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = "ViggleApiError";
    this.statusCode = statusCode;
    this.details = details;
  }
};
function parseViggleErrorMessage(errorData, fallbackMessage) {
  if (!errorData) return fallbackMessage;
  if (typeof errorData === "string") return errorData;
  if (typeof errorData.message === "string") return errorData.message;
  if (typeof errorData.error === "string") return errorData.error;
  if (typeof errorData.msg === "string") return errorData.msg;
  if (typeof errorData.detail === "string") return errorData.detail;
  if (errorData.error && typeof errorData.error.message === "string") return errorData.error.message;
  try {
    return JSON.stringify(errorData);
  } catch {
    return fallbackMessage;
  }
}
function resolveLocalUpload(urlOrPath) {
  if (!urlOrPath) return null;
  const match = urlOrPath.match(/\/uploads\/([^/?#]+)/);
  if (match) {
    const filename = match[1];
    const defaultPath = path.join(process.cwd(), "uploads", filename);
    if (fs.existsSync(defaultPath)) {
      return defaultPath;
    }
    const tmpPath = path.join("/tmp", "uploads", filename);
    if (fs.existsSync(tmpPath)) {
      return tmpPath;
    }
  }
  return null;
}
var ViggleService = class {
  /**
   * Изпраща заявка за генериране на анимирано видео към Viggle AI API (V1)
   * Поддържа както публични URL адреси, така и директен мултипарт ъплоуд на локални файлове
   * POST https://apis.viggle.ai/v1/renders
   */
  static async submitRender(params) {
    const { userId, imageUrl, motionVideoUrl, bgMode = 0 } = params;
    if (!imageUrl || !motionVideoUrl) {
      throw new ViggleApiError("\u041C\u043E\u043B\u044F, \u043F\u0440\u0435\u0434\u043E\u0441\u0442\u0430\u0432\u0435\u0442\u0435 \u043A\u0430\u043A\u0442\u043E image_url, \u0442\u0430\u043A\u0430 \u0438 motion_video_url.", 400);
    }
    const cleanImageUrl = imageUrl.trim();
    const cleanMotionVideoUrl = motionVideoUrl.trim();
    const localImageFile = resolveLocalUpload(cleanImageUrl);
    const localMotionFile = resolveLocalUpload(cleanMotionVideoUrl);
    if (!localImageFile && !/^https?:\/\//i.test(cleanImageUrl)) {
      throw new ViggleApiError(
        "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D image_url: \u0410\u0434\u0440\u0435\u0441\u044A\u0442 \u0442\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u0431\u044A\u0434\u0435 \u043F\u044A\u043B\u0435\u043D \u043F\u0443\u0431\u043B\u0438\u0447\u0435\u043D HTTP/HTTPS URL \u0438\u043B\u0438 \u043A\u0430\u0447\u0435\u043D \u0444\u0430\u0439\u043B.",
        400,
        { field: "image_url", provided: cleanImageUrl }
      );
    }
    if (!localMotionFile && !/^https?:\/\//i.test(cleanMotionVideoUrl)) {
      throw new ViggleApiError(
        "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D motion_video_url: \u0410\u0434\u0440\u0435\u0441\u044A\u0442 \u0442\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u0431\u044A\u0434\u0435 \u043F\u044A\u043B\u0435\u043D \u043F\u0443\u0431\u043B\u0438\u0447\u0435\u043D HTTP/HTTPS URL \u043D\u0430 \u0432\u0438\u0434\u0435\u043E \u0438\u043B\u0438 \u043A\u0430\u0447\u0435\u043D \u0444\u0430\u0439\u043B.",
        400,
        { field: "motion_video_url", provided: cleanMotionVideoUrl }
      );
    }
    if (!config.isViggleConfigured()) {
      console.warn("[ViggleService] VIGGLE_API_KEY \u043D\u0435 \u0435 \u0437\u0430\u0434\u0430\u0434\u0435\u043D. \u0418\u0437\u043F\u043E\u043B\u0437\u0432\u0430 \u0441\u0435 \u0441\u0438\u043C\u0443\u043B\u0438\u0440\u0430\u043D V1 \u0440\u0435\u043D\u0434\u0435\u0440.");
      const simulatedRenderId = `viggle_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await db.createVideoRender({
        userId,
        renderId: simulatedRenderId,
        imageUrl: cleanImageUrl,
        motionVideoUrl: cleanMotionVideoUrl,
        status: "processing"
      });
      return { renderId: simulatedRenderId, isSimulated: true };
    }
    try {
      const idempotencyKey = `viggle_idemp_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      let data;
      if (localImageFile || localMotionFile) {
        console.log(`[ViggleService] \u0418\u0437\u043F\u0440\u0430\u0449\u0430\u043D\u0435 \u043D\u0430 \u0434\u0438\u0440\u0435\u043A\u0442\u0435\u043D multipart/form-data \u0440\u0435\u043D\u0434\u0435\u0440 \u043A\u044A\u043C Viggle AI (Image=${localImageFile ? "Local" : "URL"}, Motion=${localMotionFile ? "Local" : "URL"})`);
        const formData = new FormData();
        if (localImageFile) {
          const fileBuffer = await fs.promises.readFile(localImageFile);
          const ext = path.extname(localImageFile).toLowerCase();
          const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
          const blob = new Blob([fileBuffer], { type: mime });
          formData.append("image", blob, path.basename(localImageFile));
        } else {
          formData.append("image_url", cleanImageUrl);
        }
        if (localMotionFile) {
          const fileBuffer = await fs.promises.readFile(localMotionFile);
          const ext = path.extname(localMotionFile).toLowerCase();
          const mime = ext === ".webm" ? "video/webm" : ext === ".mov" ? "video/quicktime" : "video/mp4";
          const blob = new Blob([fileBuffer], { type: mime });
          formData.append("motion_video", blob, path.basename(localMotionFile));
        } else {
          formData.append("motion_video_url", cleanMotionVideoUrl);
        }
        formData.append("bg_mode", bgMode.toString());
        const res = await fetch(`${config.viggle.apiBaseUrl}/renders`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.viggle.apiKey}`,
            Accept: "application/json",
            "Idempotency-Key": idempotencyKey
          },
          body: formData
        });
        const text = await res.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }
        if (!res.ok) {
          throw new ViggleApiError(
            `\u0413\u0440\u0435\u0448\u043A\u0430 \u043E\u0442 API: ${parseViggleErrorMessage(data, "\u0413\u0440\u0435\u0448\u043A\u0430 \u043F\u0440\u0438 \u0438\u0437\u043F\u0440\u0430\u0449\u0430\u043D\u0435 \u043D\u0430 \u0437\u0430\u0434\u0430\u0447\u0430\u0442\u0430 \u043A\u044A\u043C \u0432\u0438\u0434\u0435\u043E \u0441\u044A\u0440\u0432\u044A\u0440\u0430.")}`,
            res.status,
            data
          );
        }
      } else {
        const payload = {
          image_url: cleanImageUrl,
          motion_video_url: cleanMotionVideoUrl,
          bg_mode: bgMode
        };
        console.log(`[ViggleService] \u0418\u0437\u043F\u0440\u0430\u0449\u0430\u043D\u0435 \u043D\u0430 \u0437\u0430\u044F\u0432\u043A\u0430 \u043A\u044A\u043C ${config.viggle.apiBaseUrl}/renders \u0441 Bearer \u0442\u043E\u043A\u0435\u043D`);
        const response = await axios.post(`${config.viggle.apiBaseUrl}/renders`, payload, {
          headers: {
            Authorization: `Bearer ${config.viggle.apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "Idempotency-Key": idempotencyKey
          },
          timeout: 3e4
        });
        data = response.data;
      }
      const renderId = data.render_id || data.id || data.renderId || data.task_id;
      if (!renderId) {
        throw new ViggleApiError("API \u043D\u0435 \u0432\u044A\u0440\u043D\u0430 \u0432\u0430\u043B\u0438\u0434\u0435\u043D renderId \u0432 \u043E\u0442\u0433\u043E\u0432\u043E\u0440\u0430 \u0441\u0438.", 502, data);
      }
      await db.createVideoRender({
        userId,
        renderId,
        mode: "remix",
        imageUrl: cleanImageUrl,
        motionVideoUrl: cleanMotionVideoUrl,
        status: "processing"
      });
      return { renderId, isSimulated: false };
    } catch (err) {
      const axiosErr = err;
      const viggleData = axiosErr.response?.data;
      const statusCode = axiosErr.response?.status || err.statusCode || 500;
      console.error("\u041F\u044A\u043B\u043D\u0430 \u0433\u0440\u0435\u0448\u043A\u0430 \u043E\u0442 Viggle AI API (POST /renders):", JSON.stringify(viggleData || err.message, null, 2));
      const humanMessage = parseViggleErrorMessage(
        viggleData,
        err.message || "\u0412\u044A\u0437\u043D\u0438\u043A\u043D\u0430 \u0433\u0440\u0435\u0448\u043A\u0430 \u043F\u0440\u0438 \u0438\u0437\u043F\u0440\u0430\u0449\u0430\u043D\u0435 \u043D\u0430 \u0437\u0430\u0434\u0430\u0447\u0430\u0442\u0430 \u043A\u044A\u043C \u0432\u0438\u0434\u0435\u043E \u0441\u044A\u0440\u0432\u044A\u0440\u0430."
      );
      throw new ViggleApiError(`\u0413\u0440\u0435\u0448\u043A\u0430 \u043E\u0442 \u0432\u0438\u0434\u0435\u043E API: ${humanMessage}`, statusCode, viggleData || err.message);
    }
  }
  /**
   * Опция 1: Генериране на видео от текстов промпт (H3 Video Generation - Text to Video)
   * POST https://apis.viggle.ai/v1/videos
   * Поддържа качество low/high, продължителност 3-15 сек, пропорция 16:9, 9:16, 1:1
   * Всяко генерирано видео включва нативно аудио!
   */
  static async generateTextToVideo(params) {
    const {
      userId,
      prompt,
      quality = "low",
      durationSeconds = 5,
      aspectRatio = "16:9",
      resolution = "768p"
    } = params;
    const cleanPrompt = (prompt || "").trim();
    if (!cleanPrompt) {
      throw new ViggleApiError("\u041C\u043E\u043B\u044F, \u0432\u044A\u0432\u0435\u0434\u0435\u0442\u0435 \u0442\u0435\u043A\u0441\u0442 (prompt) \u0437\u0430 \u0433\u0435\u043D\u0435\u0440\u0438\u0440\u0430\u043D\u0435 \u043D\u0430 \u0432\u0438\u0434\u0435\u043E\u0442\u043E.", 400);
    }
    const duration = Math.min(15, Math.max(3, Number(durationSeconds) || 5));
    if (!config.isViggleConfigured()) {
      console.warn("[ViggleService] VIGGLE_API_KEY \u043D\u0435 \u0435 \u0437\u0430\u0434\u0430\u0434\u0435\u043D. \u0421\u0438\u043C\u0443\u043B\u0438\u0440\u0430\u043D\u0435 \u043D\u0430 Text-to-Video.");
      const simulatedRenderId = `viggle_sim_t2v_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await db.createVideoRender({
        userId,
        renderId: simulatedRenderId,
        mode: "text-to-video",
        prompt: cleanPrompt,
        quality,
        durationSeconds: duration,
        aspectRatio,
        status: "processing"
      });
      return { renderId: simulatedRenderId, isSimulated: true };
    }
    try {
      const form = new FormData();
      form.append("prompt", cleanPrompt);
      form.append("quality", quality);
      form.append("duration_s", String(duration));
      if (aspectRatio) {
        form.append("aspect_ratio", aspectRatio);
      }
      if (resolution) {
        form.append("resolution", resolution);
      }
      console.log(`[ViggleService] \u0418\u0437\u043F\u0440\u0430\u0449\u0430\u043D\u0435 \u043D\u0430 Text-to-Video \u043A\u044A\u043C ${config.viggle.apiBaseUrl}/videos (prompt: "${cleanPrompt.substring(0, 45)}...")`);
      const response = await fetch(`${config.viggle.apiBaseUrl}/videos`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.viggle.apiKey}`
        },
        body: form
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = parseViggleErrorMessage(data, `HTTP ${response.status} \u0433\u0440\u0435\u0448\u043A\u0430 \u043E\u0442 \u0432\u0438\u0434\u0435\u043E API`);
        throw new ViggleApiError(`\u0413\u0440\u0435\u0448\u043A\u0430 \u043F\u0440\u0438 \u0433\u0435\u043D\u0435\u0440\u0438\u0440\u0430\u043D\u0435 \u043D\u0430 \u0432\u0438\u0434\u0435\u043E \u043E\u0442 \u0442\u0435\u043A\u0441\u0442: ${msg}`, response.status, data);
      }
      const videoId = data.id || data.video_id || data.renderId;
      if (!videoId) {
        throw new ViggleApiError("API \u043D\u0435 \u0432\u044A\u0440\u043D\u0430 \u0432\u0430\u043B\u0438\u0434\u0435\u043D ID \u0437\u0430 \u0432\u0438\u0434\u0435\u043E \u0437\u0430\u0434\u0430\u0447\u0430\u0442\u0430.", 502, data);
      }
      await db.createVideoRender({
        userId,
        renderId: videoId,
        mode: "text-to-video",
        prompt: cleanPrompt,
        quality,
        durationSeconds: duration,
        aspectRatio,
        status: "processing"
      });
      return { renderId: videoId, isSimulated: false };
    } catch (err) {
      if (err instanceof ViggleApiError) throw err;
      throw new ViggleApiError(`\u0412\u044A\u0437\u043D\u0438\u043A\u043D\u0430 \u0433\u0440\u0435\u0448\u043A\u0430 \u043F\u0440\u0438 \u0441\u0442\u0430\u0440\u0442\u0438\u0440\u0430\u043D\u0435 \u043D\u0430 Text-to-Video: ${err.message}`, 500, err);
    }
  }
  /**
   * Опция 2: Генериране на видео от изображение (Image to Video / First Frame to Video)
   * POST https://apis.viggle.ai/v1/videos
   * Използва first_frame_image (за качен файл) или first_frame_image_url (за публичен URL)
   */
  static async generateImageToVideo(params) {
    const {
      userId,
      imageUrl,
      prompt = "",
      quality = "low",
      durationSeconds = 5
    } = params;
    const cleanImageUrl = (imageUrl || "").trim();
    if (!cleanImageUrl) {
      throw new ViggleApiError("\u041C\u043E\u043B\u044F, \u0438\u0437\u0431\u0435\u0440\u0435\u0442\u0435 \u043D\u0430\u0447\u0430\u043B\u043D\u043E \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0437\u0430 \u0430\u043D\u0438\u043C\u0438\u0440\u0430\u043D\u0435 (Image to Video).", 400);
    }
    const cleanPrompt = (prompt || "cinematic motion high quality").trim();
    const duration = Math.min(15, Math.max(3, Number(durationSeconds) || 5));
    const localImageFile = resolveLocalUpload(cleanImageUrl);
    if (!localImageFile && !/^https?:\/\//i.test(cleanImageUrl)) {
      throw new ViggleApiError(
        "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u0430\u0434\u0440\u0435\u0441 \u043D\u0430 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435\u0442\u043E: \u041C\u043E\u043B\u044F, \u0432\u044A\u0432\u0435\u0434\u0435\u0442\u0435 \u043F\u0443\u0431\u043B\u0438\u0447\u0435\u043D URL \u0430\u0434\u0440\u0435\u0441 \u0438\u043B\u0438 \u043A\u0430\u0447\u0435\u0442\u0435 \u043B\u043E\u043A\u0430\u043B\u0435\u043D \u0444\u0430\u0439\u043B.",
        400,
        { imageUrl: cleanImageUrl }
      );
    }
    if (!config.isViggleConfigured()) {
      console.warn("[ViggleService] VIGGLE_API_KEY \u043D\u0435 \u0435 \u0437\u0430\u0434\u0430\u0434\u0435\u043D. \u0421\u0438\u043C\u0443\u043B\u0438\u0440\u0430\u043D\u0435 \u043D\u0430 Image-to-Video.");
      const simulatedRenderId = `viggle_sim_i2v_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await db.createVideoRender({
        userId,
        renderId: simulatedRenderId,
        mode: "image-to-video",
        imageUrl: cleanImageUrl,
        prompt: cleanPrompt,
        quality,
        durationSeconds: duration,
        status: "processing"
      });
      return { renderId: simulatedRenderId, isSimulated: true };
    }
    try {
      const form = new FormData();
      if (localImageFile) {
        const fileBlob = await fs.promises.readFile(localImageFile);
        const mimeType = localImageFile.endsWith(".png") ? "image/png" : localImageFile.endsWith(".webp") ? "image/webp" : "image/jpeg";
        const blob = new Blob([fileBlob], { type: mimeType });
        form.append("first_frame_image", blob, path.basename(localImageFile));
      } else {
        form.append("first_frame_image_url", cleanImageUrl);
      }
      form.append("prompt", cleanPrompt);
      form.append("quality", quality);
      form.append("duration_s", String(duration));
      console.log(`[ViggleService] \u0418\u0437\u043F\u0440\u0430\u0449\u0430\u043D\u0435 \u043D\u0430 Image-to-Video \u043A\u044A\u043C ${config.viggle.apiBaseUrl}/videos (file: ${localImageFile ? "local" : cleanImageUrl})`);
      const response = await fetch(`${config.viggle.apiBaseUrl}/videos`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.viggle.apiKey}`
        },
        body: form
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = parseViggleErrorMessage(data, `HTTP ${response.status} \u0433\u0440\u0435\u0448\u043A\u0430 \u043E\u0442 \u0432\u0438\u0434\u0435\u043E API`);
        throw new ViggleApiError(`\u0413\u0440\u0435\u0448\u043A\u0430 \u043F\u0440\u0438 \u0433\u0435\u043D\u0435\u0440\u0438\u0440\u0430\u043D\u0435 \u043D\u0430 \u0432\u0438\u0434\u0435\u043E \u043E\u0442 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435: ${msg}`, response.status, data);
      }
      const videoId = data.id || data.video_id || data.renderId;
      if (!videoId) {
        throw new ViggleApiError("API \u043D\u0435 \u0432\u044A\u0440\u043D\u0430 \u0432\u0430\u043B\u0438\u0434\u0435\u043D ID \u0437\u0430 \u0432\u0438\u0434\u0435\u043E \u0437\u0430\u0434\u0430\u0447\u0430\u0442\u0430.", 502, data);
      }
      await db.createVideoRender({
        userId,
        renderId: videoId,
        mode: "image-to-video",
        imageUrl: cleanImageUrl,
        prompt: cleanPrompt,
        quality,
        durationSeconds: duration,
        status: "processing"
      });
      return { renderId: videoId, isSimulated: false };
    } catch (err) {
      if (err instanceof ViggleApiError) throw err;
      throw new ViggleApiError(`\u0412\u044A\u0437\u043D\u0438\u043A\u043D\u0430 \u0433\u0440\u0435\u0448\u043A\u0430 \u043F\u0440\u0438 \u0441\u0442\u0430\u0440\u0442\u0438\u0440\u0430\u043D\u0435 \u043D\u0430 Image-to-Video: ${err.message}`, 500, err);
    }
  }
  /**
   * Проверява статуса на задачата към Viggle AI API (V1)
   * GET https://apis.viggle.ai/v1/videos/{render_id}
   */
  static async checkStatus(renderId) {
    if (!renderId) {
      throw new Error("\u041B\u0438\u043F\u0441\u0432\u0430 renderId \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u044A\u0440.");
    }
    const localRecord = await db.getVideoRender(renderId);
    if (!config.isViggleConfigured() || renderId.startsWith("viggle_sim_")) {
      return this.simulateStatusProgress(renderId, localRecord);
    }
    try {
      const url = `${config.viggle.apiBaseUrl}/videos/${encodeURIComponent(renderId)}`;
      console.log(`[ViggleService] \u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043D\u0430 \u0441\u0442\u0430\u0442\u0443\u0441 \u043E\u0442 ${url}`);
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${config.viggle.apiKey}`,
          Accept: "application/json"
        },
        timeout: 2e4
      });
      const data = response.data;
      const rawStatus = (data.status || data.state || "processing").toLowerCase();
      const videoUrl = data.video_url || data.result_url || data.url || data.output_url || void 0;
      let normalizedStatus = "processing";
      if (rawStatus === "ready" || rawStatus === "done" || rawStatus === "completed" || rawStatus === "success" || rawStatus === "finished" || Boolean(videoUrl)) {
        normalizedStatus = "completed";
      } else if (rawStatus === "failed" || rawStatus === "error" || rawStatus === "canceled" || rawStatus === "cancelled" || rawStatus === "rejected") {
        normalizedStatus = "failed";
      }
      const progress = typeof data.progress === "number" ? data.progress : normalizedStatus === "completed" ? 100 : 50;
      if (localRecord) {
        await db.updateVideoRender(renderId, {
          status: normalizedStatus,
          progress,
          videoUrl,
          errorMessage: data.error ? typeof data.error === "string" ? data.error : JSON.stringify(data.error) : data.message || void 0
        });
      } else {
        await db.createVideoRender({
          userId: "usr_demo_123",
          renderId,
          mode: renderId.startsWith("vid_") ? "text-to-video" : "remix",
          status: normalizedStatus
        });
        if (normalizedStatus === "completed" && videoUrl) {
          await db.updateVideoRender(renderId, {
            status: normalizedStatus,
            progress: 100,
            videoUrl
          });
        }
      }
      return {
        renderId,
        status: normalizedStatus,
        videoUrl,
        progress,
        message: data.message || (normalizedStatus === "completed" ? "\u0412\u0438\u0434\u0435\u043E\u0442\u043E \u0435 \u0433\u043E\u0442\u043E\u0432\u043E!" : "\u0412\u0438\u0434\u0435\u043E\u0442\u043E \u0441\u0435 \u0440\u0435\u043D\u0434\u0435\u0440\u0438\u0440\u0430..."),
        isSimulated: false
      };
    } catch (err) {
      const axiosErr = err;
      const viggleData = axiosErr.response?.data;
      const statusCode = axiosErr.response?.status || err.statusCode || 500;
      console.error(
        `\u041F\u044A\u043B\u043D\u0430 \u0433\u0440\u0435\u0448\u043A\u0430 \u043E\u0442 Viggle AI API (GET /videos/${renderId}):`,
        JSON.stringify(viggleData || err.message, null, 2)
      );
      const humanMessage = parseViggleErrorMessage(
        viggleData,
        err.message || "\u041D\u0435\u0443\u0441\u043F\u0435\u0448\u043D\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043D\u0430 \u0441\u0442\u0430\u0442\u0443\u0441 \u043E\u0442 \u0432\u0438\u0434\u0435\u043E API."
      );
      if (localRecord) {
        return {
          renderId,
          status: localRecord.status,
          videoUrl: localRecord.videoUrl,
          progress: localRecord.progress,
          message: `\u0413\u0440\u0435\u0448\u043A\u0430 \u043F\u0440\u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0432 \u0440\u0435\u0430\u043B\u043D\u043E \u0432\u0440\u0435\u043C\u0435: ${humanMessage}`,
          isSimulated: false
        };
      }
      throw new ViggleApiError(`\u041D\u0435\u0443\u0441\u043F\u0435\u0448\u043D\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043D\u0430 \u0441\u0442\u0430\u0442\u0443\u0441 \u043E\u0442 \u0432\u0438\u0434\u0435\u043E API: ${humanMessage}`, statusCode, viggleData || err.message);
    }
  }
  /**
   * Помощна функция за реалистично симулиране на напредъка при липса на ключ
   */
  static async simulateStatusProgress(renderId, record) {
    if (!record) {
      return {
        renderId,
        status: "completed",
        progress: 100,
        videoUrl: DEMO_SAMPLE_VIDEOS[0],
        isSimulated: true
      };
    }
    if (record.status === "completed") {
      return {
        renderId,
        status: "completed",
        progress: 100,
        videoUrl: record.videoUrl,
        isSimulated: true
      };
    }
    const elapsedSeconds = (Date.now() - new Date(record.createdAt).getTime()) / 1e3;
    if (elapsedSeconds >= 8) {
      const chosenVideo = DEMO_SAMPLE_VIDEOS[Math.floor(Math.random() * DEMO_SAMPLE_VIDEOS.length)];
      await db.updateVideoRender(renderId, {
        status: "completed",
        progress: 100,
        videoUrl: chosenVideo
      });
      return {
        renderId,
        status: "completed",
        progress: 100,
        videoUrl: chosenVideo,
        isSimulated: true
      };
    }
    const calculatedProgress = Math.min(95, Math.max(10, Math.round(elapsedSeconds / 8 * 100)));
    await db.updateVideoRender(renderId, {
      status: "processing",
      progress: calculatedProgress
    });
    return {
      renderId,
      status: "processing",
      progress: calculatedProgress,
      isSimulated: true
    };
  }
};

// src/server/controllers/viggleController.ts
var ViggleController = class _ViggleController {
  /**
   * ЕНДПОЙНТ 1: POST /api/generate-video
   * Поддържа 3 режима:
   * 1. 'remix' (Character + Motion Video)
   * 2. 'text-to-video' (H3 Video Generation от Prompt)
   * 3. 'image-to-video' (First Frame Image + Prompt)
   */
  static async generateVideo(req, res) {
    try {
      const {
        userId = "usr_demo_123",
        mode,
        prompt,
        quality = "low",
        duration_s,
        durationSeconds,
        aspect_ratio,
        aspectRatio,
        resolution,
        image_url,
        imageUrl,
        motion_video_url,
        motionVideoUrl,
        bg_mode,
        bgMode
      } = req.body;
      const rawPrompt = (prompt || "").trim();
      const rawImageUrl = (image_url || imageUrl || "").trim();
      const rawMotionVideoUrl = (motion_video_url || motionVideoUrl || "").trim();
      const finalQuality = quality === "high" ? "high" : "low";
      const finalDuration = Number(duration_s || durationSeconds) || 5;
      const finalAspectRatio = aspect_ratio || aspectRatio || "16:9";
      const finalResolution = resolution || "768p";
      const finalBgMode = bg_mode !== void 0 ? bg_mode : bgMode;
      let selectedMode = "remix";
      if (mode === "text-to-video" || !rawImageUrl && !rawMotionVideoUrl && rawPrompt) {
        selectedMode = "text-to-video";
      } else if (mode === "image-to-video" || rawImageUrl && !rawMotionVideoUrl) {
        selectedMode = "image-to-video";
      } else {
        selectedMode = "remix";
      }
      if (selectedMode === "text-to-video") {
        if (!rawPrompt) {
          return res.status(400).json({
            error: '\u041B\u0438\u043F\u0441\u0432\u0430 \u0442\u0435\u043A\u0441\u0442 (prompt) \u0437\u0430 \u0440\u0435\u0436\u0438\u043C "Text to Video". \u041C\u043E\u043B\u044F \u0432\u044A\u0432\u0435\u0434\u0435\u0442\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043D\u0430 \u0441\u0446\u0435\u043D\u0430\u0442\u0430.'
          });
        }
      } else if (selectedMode === "image-to-video") {
        if (!rawImageUrl) {
          return res.status(400).json({
            error: '\u041B\u0438\u043F\u0441\u0432\u0430 \u043D\u0430\u0447\u0430\u043B\u043D\u043E \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0437\u0430 \u0440\u0435\u0436\u0438\u043C "Image to Video". \u041C\u043E\u043B\u044F \u043A\u0430\u0447\u0435\u0442\u0435 \u0444\u0430\u0439\u043B \u0438\u043B\u0438 \u0432\u044A\u0432\u0435\u0434\u0435\u0442\u0435 image_url.'
          });
        }
      } else {
        if (!rawImageUrl || !rawMotionVideoUrl) {
          return res.status(400).json({
            error: '\u041B\u0438\u043F\u0441\u0432\u0430\u0442 \u0437\u0430\u0434\u044A\u043B\u0436\u0438\u0442\u0435\u043B\u043D\u0438 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u0438 \u0437\u0430 Video Remix. \u041C\u043E\u043B\u044F \u0438\u0437\u043F\u0440\u0430\u0442\u0435\u0442\u0435 "image_url" \u0438 "motion_video_url".'
          });
        }
      }
      const proto = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
      const host = req.headers["x-forwarded-host"] || req.get("host");
      const baseUrl = `${proto}://${host}`;
      const finalImageUrl = rawImageUrl.startsWith("/") ? `${baseUrl}${rawImageUrl}` : rawImageUrl;
      const finalMotionVideoUrl = rawMotionVideoUrl.startsWith("/") ? `${baseUrl}${rawMotionVideoUrl}` : rawMotionVideoUrl;
      const hasCredits = await CreditService.hasSufficientCredits(userId, 1);
      if (!hasCredits) {
        const user = await db.getUserById(userId);
        const currentCredits = user ? user.credits : 0;
        return res.status(402).json({
          error: `\u041D\u044F\u043C\u0430\u0442\u0435 \u0434\u043E\u0441\u0442\u0430\u0442\u044A\u0447\u043D\u043E \u043A\u0440\u0435\u0434\u0438\u0442\u0438 \u0437\u0430 \u0433\u0435\u043D\u0435\u0440\u0438\u0440\u0430\u043D\u0435 \u043D\u0430 \u0432\u0438\u0434\u0435\u043E! \u0422\u0435\u043A\u0443\u0449 \u0431\u0430\u043B\u0430\u043D\u0441: ${currentCredits}. \u041D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C: 1 \u043A\u0440\u0435\u0434\u0438\u0442.`,
          requiredCredits: 1,
          currentCredits
        });
      }
      let renderResult;
      if (selectedMode === "text-to-video") {
        renderResult = await ViggleService.generateTextToVideo({
          userId,
          prompt: rawPrompt,
          quality: finalQuality,
          durationSeconds: finalDuration,
          aspectRatio: finalAspectRatio,
          resolution: finalResolution
        });
      } else if (selectedMode === "image-to-video") {
        renderResult = await ViggleService.generateImageToVideo({
          userId,
          imageUrl: finalImageUrl,
          prompt: rawPrompt,
          quality: finalQuality,
          durationSeconds: finalDuration
        });
      } else {
        renderResult = await ViggleService.submitRender({
          userId,
          imageUrl: finalImageUrl,
          motionVideoUrl: finalMotionVideoUrl,
          bgMode: finalBgMode
        });
      }
      const updatedUser = await CreditService.deductCredits(userId, 1);
      console.log(
        `[ViggleController] [${selectedMode}] \u0423\u0441\u043F\u0435\u0448\u043D\u043E \u0441\u0442\u0430\u0440\u0442\u0438\u0440\u0430\u043D \u0440\u0435\u043D\u0434\u0435\u0440 ${renderResult.renderId}. \u041D\u043E\u0432 \u0431\u0430\u043B\u0430\u043D\u0441: ${updatedUser.credits} \u043A\u0440\u0435\u0434\u0438\u0442\u0430.`
      );
      return res.status(200).json({
        success: true,
        renderId: renderResult.renderId,
        mode: selectedMode,
        remainingCredits: updatedUser.credits,
        status: "processing",
        isSimulated: renderResult.isSimulated,
        message: selectedMode === "text-to-video" ? "\u0417\u0430\u0434\u0430\u0447\u0430\u0442\u0430 \u0437\u0430 \u0433\u0435\u043D\u0435\u0440\u0438\u0440\u0430\u043D\u0435 \u043D\u0430 \u0432\u0438\u0434\u0435\u043E \u043E\u0442 \u0442\u0435\u043A\u0441\u0442 \u0435 \u0438\u0437\u043F\u0440\u0430\u0442\u0435\u043D\u0430 \u0443\u0441\u043F\u0435\u0448\u043D\u043E (\u0432\u043A\u043B\u044E\u0447\u0432\u0430 \u043D\u0430\u0442\u0438\u0432\u043D\u043E \u0430\u0443\u0434\u0438\u043E)." : selectedMode === "image-to-video" ? "\u0417\u0430\u0434\u0430\u0447\u0430\u0442\u0430 \u0437\u0430 \u0430\u043D\u0438\u043C\u0438\u0440\u0430\u043D\u0435 \u043D\u0430 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u043A\u044A\u043C \u0432\u0438\u0434\u0435\u043E \u0435 \u0438\u0437\u043F\u0440\u0430\u0442\u0435\u043D\u0430 \u0443\u0441\u043F\u0435\u0448\u043D\u043E." : "\u0417\u0430\u0434\u0430\u0447\u0430\u0442\u0430 \u0437\u0430 \u0432\u0438\u0434\u0435\u043E \u0430\u043D\u0438\u043C\u0430\u0446\u0438\u044F (Remix) \u0435 \u0438\u0437\u043F\u0440\u0430\u0442\u0435\u043D\u0430 \u0443\u0441\u043F\u0435\u0448\u043D\u043E."
      });
    } catch (error) {
      const viggleError = error.response?.data || error.details || error.message;
      const statusCode = error.statusCode || error.response?.status || 500;
      console.error("\u041F\u044A\u043B\u043D\u0430 \u0433\u0440\u0435\u0448\u043A\u0430 \u043E\u0442 Viggle AI API (POST /api/generate-video):", JSON.stringify(viggleError, null, 2));
      return res.status(statusCode).json({
        error: typeof error.message === "string" ? error.message : "\u0412\u044A\u0437\u043D\u0438\u043A\u043D\u0430 \u0433\u0440\u0435\u0448\u043A\u0430 \u043F\u0440\u0438 \u0433\u0435\u043D\u0435\u0440\u0438\u0440\u0430\u043D\u0435\u0442\u043E \u043D\u0430 \u0432\u0438\u0434\u0435\u043E\u0442\u043E.",
        details: viggleError
      });
    }
  }
  /**
   * ЕНДПОЙНТ: POST /api/text-to-video
   * Директен псевдоним за режим Text to Video
   */
  static async textToVideo(req, res) {
    req.body.mode = "text-to-video";
    return _ViggleController.generateVideo(req, res);
  }
  /**
   * ЕНДПОЙНТ: POST /api/image-to-video
   * Директен псевдоним за режим Image to Video
   */
  static async imageToVideo(req, res) {
    req.body.mode = "image-to-video";
    return _ViggleController.generateVideo(req, res);
  }
  /**
   * ЕНДПОЙНТ 2: GET /api/video-status/:renderId
   * Проверява статуса на задачата към https://apis.viggle.ai/v1/videos/{render_id}
   * Връща статуса и линка към готовото видео, когато е готово.
   */
  static async getVideoStatus(req, res) {
    try {
      const { renderId } = req.params;
      if (!renderId) {
        return res.status(400).json({
          error: "\u041B\u0438\u043F\u0441\u0432\u0430 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u044A\u0440\u044A\u0442 renderId \u0432 \u0430\u0434\u0440\u0435\u0441\u0430 \u043D\u0430 \u0437\u0430\u044F\u0432\u043A\u0430\u0442\u0430."
        });
      }
      const statusData = await ViggleService.checkStatus(renderId);
      return res.status(200).json({
        renderId: statusData.renderId,
        status: statusData.status,
        // "processing" | "completed" | "failed"
        videoUrl: statusData.videoUrl || null,
        progress: statusData.progress ?? 0,
        message: statusData.message,
        isSimulated: statusData.isSimulated
      });
    } catch (error) {
      const viggleError = error.response?.data || error.details || error.message;
      const statusCode = error.statusCode || error.response?.status || 500;
      console.error(
        `\u041F\u044A\u043B\u043D\u0430 \u0433\u0440\u0435\u0448\u043A\u0430 \u043E\u0442 Viggle AI API (GET /api/video-status/${req.params.renderId}):`,
        JSON.stringify(viggleError, null, 2)
      );
      return res.status(statusCode).json({
        error: typeof error.message === "string" ? error.message : "\u0412\u044A\u0437\u043D\u0438\u043A\u043D\u0430 \u0433\u0440\u0435\u0448\u043A\u0430 \u043F\u0440\u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043D\u0430 \u0441\u0442\u0430\u0442\u0443\u0441\u0430 \u043D\u0430 \u0432\u0438\u0434\u0435\u043E\u0442\u043E.",
        details: viggleError
      });
    }
  }
  /**
   * Спомагателен ендпойнт за списък на всички генерирани видеа на потребителя
   * GET /api/videos
   */
  static async listUserVideos(req, res) {
    try {
      const userId = req.query.userId || "usr_demo_123";
      const renders = await db.listVideoRenders(userId);
      return res.json({ videos: renders });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
};

// src/server/routes/viggleRoutes.ts
var viggleRouter = Router2();
viggleRouter.post("/generate-video", ViggleController.generateVideo);
viggleRouter.post("/text-to-video", ViggleController.textToVideo);
viggleRouter.post("/image-to-video", ViggleController.imageToVideo);
viggleRouter.get("/video-status/:renderId", ViggleController.getVideoStatus);
viggleRouter.get("/videos", ViggleController.listUserVideos);

// src/server/routes/userRoutes.ts
import { Router as Router3 } from "express";

// src/server/controllers/userController.ts
var UserController = class {
  /**
   * GET /api/user/me
   * Връща потребителски данни и баланс на кредити
   */
  static async getProfile(req, res) {
    try {
      const userId = req.query.userId || "usr_demo_123";
      let user = await db.getUserById(userId);
      if (!user) {
        user = await db.getOrCreateDefaultUser();
      }
      const transactions = await db.listTransactions(userId);
      const videos = await db.listVideoRenders(userId);
      return res.json({
        user,
        transactionsCount: transactions.length,
        videosCount: videos.length
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
  /**
   * POST /api/user/reset-credits
   * Спомагателен инструмент за тестване на баланса
   */
  static async resetCredits(req, res) {
    try {
      const { userId = "usr_demo_123", credits = 10 } = req.body;
      const updatedUser = await db.setCredits(userId, Number(credits));
      return res.json({
        success: true,
        message: `\u0411\u0430\u043B\u0430\u043D\u0441\u044A\u0442 \u0431\u0435 \u043E\u0431\u043D\u043E\u0432\u0435\u043D \u043D\u0430 ${updatedUser.credits} \u043A\u0440\u0435\u0434\u0438\u0442\u0430.`,
        user: updatedUser
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
  /**
   * GET /api/user/transactions
   */
  static async getTransactions(req, res) {
    try {
      const userId = req.query.userId || "usr_demo_123";
      const transactions = await db.listTransactions(userId);
      return res.json({ transactions });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
};

// src/server/routes/userRoutes.ts
var userRouter = Router3();
userRouter.get("/me", UserController.getProfile);
userRouter.post("/reset-credits", UserController.resetCredits);
userRouter.get("/transactions", UserController.getTransactions);

// src/server/routes/uploadRoutes.ts
import { Router as Router4 } from "express";
import multer from "multer";
import path2 from "path";
import fs2 from "fs";
var uploadRouter = Router4();
var uploadsDir = process.env.VERCEL ? path2.join("/tmp", "uploads") : path2.join(process.cwd(), "uploads");
try {
  if (!fs2.existsSync(uploadsDir)) {
    fs2.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (err) {
  console.warn("[UploadRouter] \u041F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0435 \u043F\u0440\u0438 \u0441\u044A\u0437\u0434\u0430\u0432\u0430\u043D\u0435 \u043D\u0430 uploads \u0434\u0438\u0440\u0435\u043A\u0442\u043E\u0440\u0438\u044F:", err);
}
var storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const ext = path2.extname(file.originalname).toLowerCase() || "";
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});
var fileFilter = (_req, file, cb) => {
  const allowedMimes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/jpg",
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "video/x-msvideo"
  ];
  const allowedExts = [".jpg", ".jpeg", ".png", ".webp", ".mp4", ".mov", ".webm", ".avi"];
  const ext = path2.extname(file.originalname).toLowerCase();
  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`\u041D\u0435\u043F\u043E\u0434\u0434\u044A\u0440\u0436\u0430\u043D \u0444\u0430\u0439\u043B\u043E\u0432 \u0444\u043E\u0440\u043C\u0430\u0442 (${file.mimetype || ext}). \u041F\u043E\u0437\u0432\u043E\u043B\u0435\u043D\u0438 \u0441\u0430 JPG, PNG, WEBP, MP4, MOV, WEBM.`));
  }
};
var upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024
    // 100 MB лимит
  }
});
uploadRouter.post("/upload", (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      console.error("[UploadRouter] \u0413\u0440\u0435\u0448\u043A\u0430 \u043F\u0440\u0438 \u043A\u0430\u0447\u0432\u0430\u043D\u0435 \u043D\u0430 \u0444\u0430\u0439\u043B:", err);
      return res.status(400).json({
        error: err.message || "\u0412\u044A\u0437\u043D\u0438\u043A\u043D\u0430 \u0433\u0440\u0435\u0448\u043A\u0430 \u043F\u0440\u0438 \u043A\u0430\u0447\u0432\u0430\u043D\u0435\u0442\u043E \u043D\u0430 \u0444\u0430\u0439\u043B\u0430."
      });
    }
    if (!req.file) {
      return res.status(400).json({
        error: "\u041C\u043E\u043B\u044F \u0438\u0437\u0431\u0435\u0440\u0435\u0442\u0435 \u0444\u0430\u0439\u043B \u0437\u0430 \u043A\u0430\u0447\u0432\u0430\u043D\u0435."
      });
    }
    const proto = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const fullUrl = `${proto}://${host}/uploads/${req.file.filename}`;
    const isVideo = req.file.mimetype.startsWith("video/") || [".mp4", ".mov", ".webm", ".avi"].includes(path2.extname(req.file.filename).toLowerCase());
    console.log(`[UploadRouter] \u0423\u0441\u043F\u0435\u0448\u043D\u043E \u043A\u0430\u0447\u0435\u043D \u0444\u0430\u0439\u043B: ${req.file.filename} -> ${fullUrl}`);
    return res.status(200).json({
      success: true,
      url: fullUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      type: isVideo ? "video" : "image"
    });
  });
});

// src/server/app.ts
function createExpressApp() {
  const app2 = express();
  const uploadsDir2 = process.env.VERCEL ? path3.join("/tmp", "uploads") : path3.join(process.cwd(), "uploads");
  try {
    if (!fs3.existsSync(uploadsDir2)) {
      fs3.mkdirSync(uploadsDir2, { recursive: true });
    }
  } catch (err) {
    console.warn("[App] \u041F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0435 \u043F\u0440\u0438 \u0441\u044A\u0437\u0434\u0430\u0432\u0430\u043D\u0435 \u043D\u0430 uploads \u0434\u0438\u0440\u0435\u043A\u0442\u043E\u0440\u0438\u044F:", err);
  }
  app2.use("/uploads", express.static(uploadsDir2, {
    maxAge: "1d",
    setHeaders: (res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
  }));
  app2.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, stripe-signature");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
  app2.post(
    ["/api/stripe/webhook", "/stripe/webhook"],
    express.raw({ type: "application/json" }),
    StripeController.handleWebhook
  );
  app2.use(express.json());
  app2.use(express.urlencoded({ extended: true }));
  const healthHandler = (_req, res) => {
    res.json({
      status: "ok",
      service: "AI Video & Stripe Credit Backend",
      platform: process.env.VERCEL ? "vercel-serverless" : "node-server",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      stripeConfigured: config.isStripeConfigured(),
      viggleConfigured: config.isViggleConfigured()
    });
  };
  app2.get("/api/health", healthHandler);
  app2.get("/health", healthHandler);
  const serveUploadFile = (req, res) => {
    const filename = path3.basename(req.params.filename || "");
    if (!filename) {
      return res.status(400).json({ error: "\u041B\u0438\u043F\u0441\u0432\u0430 \u0438\u043C\u0435 \u043D\u0430 \u0444\u0430\u0439\u043B." });
    }
    const possiblePaths = [
      path3.join("/tmp", "uploads", filename),
      path3.join(process.cwd(), "uploads", filename)
    ];
    for (const p of possiblePaths) {
      try {
        if (fs3.existsSync(p)) {
          return res.sendFile(p);
        }
      } catch {
      }
    }
    return res.status(404).json({ error: `\u0424\u0430\u0439\u043B\u044A\u0442 "${filename}" \u043D\u0435 \u0431\u0435\u0448\u0435 \u043D\u0430\u043C\u0435\u0440\u0435\u043D.` });
  };
  app2.get("/uploads/:filename", serveUploadFile);
  app2.get("/api/uploads/:filename", serveUploadFile);
  app2.use("/api", viggleRouter);
  app2.use("/api", uploadRouter);
  app2.use("/api/stripe", stripeRouter);
  app2.use("/api/user", userRouter);
  app2.use(viggleRouter);
  app2.use(uploadRouter);
  app2.use("/stripe", stripeRouter);
  app2.use("/user", userRouter);
  app2.use("/api", (req, res) => {
    res.status(404).json({
      error: `API \u043C\u0430\u0440\u0448\u0440\u0443\u0442\u044A\u0442 \u043D\u0435 \u0435 \u043D\u0430\u043C\u0435\u0440\u0435\u043D: ${req.method} ${req.originalUrl || req.url}`
    });
  });
  app2.use((err, _req, res, _next) => {
    console.error("[Express Global Error]:", err);
    if (!res.headersSent) {
      const statusCode = typeof err.statusCode === "number" && err.statusCode >= 400 ? err.statusCode : 500;
      res.status(statusCode).json({
        error: err.message || "\u0412\u044A\u0437\u043D\u0438\u043A\u043D\u0430 \u0441\u044A\u0440\u0432\u044A\u0440\u043D\u0430 \u0433\u0440\u0435\u0448\u043A\u0430 \u043F\u0440\u0438 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0430 \u043D\u0430 \u0437\u0430\u044F\u0432\u043A\u0430\u0442\u0430.",
        details: err.details || (process.env.NODE_ENV === "production" ? void 0 : err.stack)
      });
    }
  });
  return app2;
}
var app = createExpressApp();
function handler(req, res) {
  return app(req, res);
}
export {
  app,
  createExpressApp,
  handler as default
};
