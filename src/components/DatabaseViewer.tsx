import React, { useState } from 'react';
import { Database, Copy, Check, Table, ShieldCheck, Layers, Terminal } from 'lucide-react';

const PRISMA_SCHEMA_CODE = `// prisma/schema.prisma
datasource db {
  provider = "postgresql" // или "mysql", "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ==========================================
// 1. МОДЕЛ ЗА ПОТРЕБИТЕЛ (User)
// ==========================================
model User {
  id               String        @id @default(uuid())
  email            String        @unique
  name             String?
  credits          Int           @default(5) // Баланс на кредити за генерация
  stripeCustomerId String?       @unique    // Свързване с клиент в Stripe
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  // Релации
  transactions     Transaction[]
  videoRenders     VideoRender[]

  @@map("users")
}

// ==========================================
// 2. МОДЕЛ ЗА ПАКЕТИ С КРЕДИТИ (CreditPackage)
// ==========================================
model CreditPackage {
  id            String        @id @default(uuid())
  key           String        @unique     // "small" или "large"
  name          String                    // напр. "Малък пакет (50 кредита)"
  description   String?
  credits       Int                       // 50 или 200 кредита
  priceInCents  Int                       // Цена в центове (499 = $4.99, 1499 = $14.99)
  currency      String        @default("usd")
  stripePriceId String?                   // Опционален Price ID от Stripe
  active        Boolean       @default(true)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  transactions  Transaction[]

  @@map("credit_packages")
}

// ==========================================
// 3. МОДЕЛ ЗА ТРАНЗАКЦИИ (Transaction)
// Осигурява одит и ИДЕМПОТЕНТНОСТ при Stripe уебхуци
// ==========================================
model Transaction {
  id              String        @id @default(uuid())
  userId          String
  packageId       String?
  stripeSessionId String        @unique   // cs_test_... Уникален ключ за идемпотентност!
  stripePaymentId String?                 // pi_... PaymentIntent ID
  amountPaid      Int                     // Платена сума в центове
  currency        String        @default("usd")
  creditsAdded    Int                     // Брой добавени кредити (напр. 50 или 200)
  status          PaymentStatus @default(PENDING) // PENDING, COMPLETED, FAILED
  metadata        Json?                   // Пълни метаданни от Stripe
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  package         CreditPackage? @relation(fields: [packageId], references: [id])

  @@index([userId])
  @@map("transactions")
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
}

// ==========================================
// 4. МОДЕЛ ЗА ВИДЕО РЕНДЕРИ (VideoRender)
// Проследява задачите към Viggle AI API (V1)
// ==========================================
model VideoRender {
  id              String       @id @default(uuid())
  userId          String
  renderId        String       @unique   // ID, получено от POST /v1/renders
  imageUrl        String                 // URL на изображението на героя
  motionVideoUrl  String                 // URL на видеото с хореографията
  status          RenderStatus @default(PROCESSING) // PROCESSING, COMPLETED, FAILED
  progress        Int          @default(0) // Прогрес в проценти (0-100%)
  videoUrl        String?                // Линк към готовото MP4 видео
  creditsUsed     Int          @default(1) // Консумирани кредити (1 кредит)
  errorMessage    String?                // Съобщение при грешка
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  user            User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([renderId])
  @@map("video_renders")
}

enum RenderStatus {
  PROCESSING
  COMPLETED
  FAILED
}`;

export const DatabaseViewer: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(PRISMA_SCHEMA_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/40 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Database Architecture
              </span>
              <span className="text-xs text-slate-400">Prisma Schema & Relational Design</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Схема на базата данни (Prisma ORM)
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl mt-1">
              Моделиране за безопасна работа с плащания (идемпотентност през <code>stripeSessionId @unique</code>), съхранение на кредити и проследяване на Viggle AI задачите.
            </p>
          </div>
          <button
            id="btn-copy-prisma"
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md transition-all self-start md:self-auto"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Копирано в клипборда!' : 'Копирай Prisma Schema'}
          </button>
        </div>
      </div>

      {/* Model Cards Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm mb-2">
            <Layers className="w-4 h-4" />
            User
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Потребители на системата, техният баланс на <code>credits</code> и опционален <code>stripeCustomerId</code>.
          </p>
          <div className="text-[11px] font-mono text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
            credits: Int @default(5)<br/>
            transactions: Transaction[]<br/>
            videoRenders: VideoRender[]
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm mb-2">
            <Layers className="w-4 h-4" />
            CreditPackage
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Пакетите за продажба: Малка опция (50 кредита) и Голяма опция (200 кредита).
          </p>
          <div className="text-[11px] font-mono text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
            key: "small" | "large"<br/>
            credits: Int (50 / 200)<br/>
            priceInCents: Int (499 / 1499)
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm mb-2">
            <ShieldCheck className="w-4 h-4" />
            Transaction
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Одит на всяко Stripe плащане с уникален <code>stripeSessionId</code> за защита от двойно начисляване.
          </p>
          <div className="text-[11px] font-mono text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
            stripeSessionId: @unique<br/>
            creditsAdded: Int<br/>
            status: COMPLETED
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm mb-2">
            <Table className="w-4 h-4" />
            VideoRender
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Заявките към Viggle AI с техния <code>renderId</code>, статус и краен видео URL.
          </p>
          <div className="text-[11px] font-mono text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
            renderId: @unique<br/>
            status: PROCESSING | DONE<br/>
            videoUrl: String?
          </div>
        </div>
      </div>

      {/* Code Block with Prisma Schema */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 border-b border-slate-800 text-xs text-slate-300">
          <div className="flex items-center gap-2 font-mono">
            <Terminal className="w-4 h-4 text-indigo-400" />
            prisma/schema.prisma
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Копирано' : 'Копирай кода'}
          </button>
        </div>
        <pre className="p-6 text-xs font-mono text-indigo-100 overflow-x-auto leading-relaxed max-h-[500px]">
          <code>{PRISMA_SCHEMA_CODE}</code>
        </pre>
      </div>
    </div>
  );
};
