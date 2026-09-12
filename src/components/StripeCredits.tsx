import React, { useState, useEffect } from 'react';
import { CreditCard, Check, Sparkles, ArrowRight, ShieldCheck, RefreshCw, AlertCircle, FileText } from 'lucide-react';
import { safeFetchJson } from '../utils/apiHelper.ts';

interface StripeCreditsProps {
  userId: string;
  onCreditChange: () => void;
}

export const StripeCredits: React.FC<StripeCreditsProps> = ({ userId, onCreditChange }) => {
  const [loadingPkg, setLoadingPkg] = useState<string | null>(null);
  const [webhookMessage, setWebhookMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [lastSession, setLastSession] = useState<any | null>(null);

  const fetchTransactions = async () => {
    try {
      const response = await safeFetchJson<{ transactions: any[] }>(`/api/user/transactions?userId=${encodeURIComponent(userId)}`);
      if (response.ok && response.data) {
        setTransactions(response.data.transactions || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [userId]);

  // Създаване на Stripe Checkout Session
  const handleBuyPackage = async (packageKey: 'small' | 'large') => {
    setLoadingPkg(packageKey);
    setWebhookMessage(null);
    setErrorMessage(null);

    try {
      const response = await safeFetchJson<any>('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, packageKey }),
      });

      if (!response.ok || !response.data) {
        throw new Error(response.error || 'Грешка при създаване на платежна сесия.');
      }

      const data = response.data;
      setLastSession(data);

      if (!data.isSimulated && data.checkoutUrl) {
        // Реално Stripe пренасочване
        window.open(data.checkoutUrl, '_blank');
      } else {
        setWebhookMessage(
          `Генерирана е Stripe Checkout сесия: ${data.sessionId}. Кредитите ще бъдат начислени автоматично след успешно плащане.`
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Възникна грешка при обработка на плащането.');
    } finally {
      setLoadingPkg(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/40 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Stripe Checkout & Webhooks
              </span>
              <span className="text-xs text-slate-400">Автоматично начисляване на кредити</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Закупуване на пакети с кредити (Малка и Голяма опция)
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl mt-1">
              При завършване на покупката, Stripe изпраща криптографски подписано събитие{' '}
              <code className="text-amber-300">checkout.session.completed</code> към{' '}
              <code className="text-indigo-300">POST /api/stripe/webhook</code>, което автоматично добавя кредитите в профила на потребителя.
            </p>
          </div>
        </div>
      </div>

      {/* Package Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* SMALL OPTION */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm hover:border-indigo-400 transition-all flex flex-col justify-between relative">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="px-3 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-700">
                Малък пакет (Starter)
              </span>
              <span className="text-xs font-medium text-slate-500">50 видеа</span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-1">50 Кредита</h3>
            <p className="text-xs text-slate-500 mb-4">
              Идеален пакет за бързи тестове и генериране на единични видео анимации.
            </p>

            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-extrabold text-slate-900">$9.99</span>
              <span className="text-xs text-slate-500 font-medium">/ еднократно</span>
            </div>

            <ul className="space-y-2.5 text-xs text-slate-600 mb-6">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>50 пълни AI видео рендера</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Незабавно начисляване през Stripe Webhook</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Кредитите не изтичат във времето</span>
              </li>
            </ul>
          </div>

          <div>
            <button
              id="btn-buy-small"
              onClick={() => handleBuyPackage('small')}
              disabled={loadingPkg === 'small'}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {loadingPkg === 'small' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Купи Малък Пакет ($9.99)
                </>
              )}
            </button>
          </div>
        </div>

        {/* LARGE OPTION */}
        <div className="bg-white rounded-2xl border-2 border-indigo-600 p-6 shadow-md hover:shadow-lg transition-all flex flex-col justify-between relative">
          <div className="absolute -top-3 right-6">
            <span className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-600 text-white shadow-sm flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Най-изгоден (-25%)
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-50 text-indigo-700">
                Голям пакет (Pro Creator)
              </span>
              <span className="text-xs font-medium text-slate-500">200 видеа</span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-1">200 Кредита</h3>
            <p className="text-xs text-slate-500 mb-4">
              Максимална стойност за сериозни проекти, създатели на съдържание и студия.
            </p>

            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-extrabold text-indigo-600">$29.99</span>
              <span className="text-xs text-slate-500 line-through ml-1">$39.99</span>
              <span className="text-xs text-slate-500 font-medium">/ еднократно</span>
            </div>

            <ul className="space-y-2.5 text-xs text-slate-600 mb-6">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>200 пълни AI видео рендера</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Приоритетна обработка на рендерите</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Спестявате 25% спрямо малкия пакет</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Пълна фактура и Stripe транзакция</span>
              </li>
            </ul>
          </div>

          <div>
            <button
              id="btn-buy-large"
              onClick={() => handleBuyPackage('large')}
              disabled={loadingPkg === 'large'}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              {loadingPkg === 'large' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Купи Голям Пакет ($29.99)
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Webhook Feedback Message */}
      {errorMessage && (
        <div className="max-w-4xl mx-auto p-4 rounded-xl bg-rose-50 text-rose-700 text-sm border border-rose-200 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-600 hover:text-rose-800 text-xs px-2 py-1 rounded"
          >
            Затвори
          </button>
        </div>
      )}

      {webhookMessage && (
        <div className="max-w-4xl mx-auto p-4 rounded-xl bg-slate-900 text-emerald-400 text-xs font-mono border border-slate-700 shadow-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>{webhookMessage}</span>
          </div>
          <button
            onClick={() => setWebhookMessage(null)}
            className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded"
          >
            Затвори
          </button>
        </div>
      )}

      {/* Webhook Architecture Explanation Box */}
      <div className="max-w-4xl mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-6">
        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-indigo-600" />
          Архитектура на Stripe Webhook & Криптографска сигурност
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
          <div className="p-3 bg-white rounded-xl border border-slate-200">
            <div className="font-semibold text-slate-900 mb-1">1. Raw Body Middleware</div>
            <p className="text-slate-500 leading-relaxed">
              Маршрутът <code>/api/stripe/webhook</code> използва <code>express.raw()</code> преди <code>express.json()</code>, за да се запази байтовият масив за валидиране на подписа.
            </p>
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-200">
            <div className="font-semibold text-slate-900 mb-1">2. Signature Verification</div>
            <p className="text-slate-500 leading-relaxed">
              Използва се <code>stripe.webhooks.constructEvent(body, sig, secret)</code>. Ако подписът е невалиден, заявката се отхвърля веднага с код 400.
            </p>
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-200">
            <div className="font-semibold text-slate-900 mb-1">3. Идемпотентност (Idempotency)</div>
            <p className="text-slate-500 leading-relaxed">
              Всяка сесия се записва в таблица <code>Transaction</code> по <code>stripeSessionId</code>. При повторен уебхук кредити не се начисляват повторно.
            </p>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            История на плащанията (Транзакции в базата данни)
          </h4>
          <button
            onClick={fetchTransactions}
            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Опресни
          </button>
        </div>

        {transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Session ID</th>
                  <th className="py-2.5 px-3">Пакет</th>
                  <th className="py-2.5 px-3">Сума</th>
                  <th className="py-2.5 px-3">Кредити</th>
                  <th className="py-2.5 px-3">Статус</th>
                  <th className="py-2.5 px-3">Дата</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono text-slate-700 truncate max-w-[140px]">{tx.stripeSessionId}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-900 uppercase">{tx.packageKey || 'Custom'}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      ${(tx.amountPaid / 100).toFixed(2)} {tx.currency?.toUpperCase()}
                    </td>
                    <td className="py-2.5 px-3 text-emerald-600 font-bold">+{tx.creditsAdded}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{new Date(tx.createdAt).toLocaleDateString('bg-BG')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-4 text-center">Няма записани транзакции за този потребител.</p>
        )}
      </div>
    </div>
  );
};
