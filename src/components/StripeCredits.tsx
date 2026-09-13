/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CreditCard, Check, Sparkles, ShieldCheck, RefreshCw, AlertCircle, FileText, ArrowRight, Zap } from 'lucide-react';
import { safeFetchJson } from '../utils/apiHelper.ts';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { GsapReveal } from './motion/GsapReveal.tsx';

interface StripeCreditsProps {
  userId: string;
  onCreditChange: () => void;
}

export const StripeCredits: React.FC<StripeCreditsProps> = ({ userId, onCreditChange }) => {
  const { t, language } = useLanguage();
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
        throw new Error(response.error || (language === 'bg' ? 'Грешка при създаване на платежна сесия.' : 'Error creating checkout session.'));
      }

      const data = response.data;
      setLastSession(data);

      if (!data.isSimulated && data.checkoutUrl) {
        // Реално Stripe пренасочване
        window.open(data.checkoutUrl, '_blank');
      } else {
        setWebhookMessage(
          language === 'bg'
            ? `Генерирана е Stripe Checkout сесия: ${data.sessionId}. Кредитите ще бъдат начислени автоматично след плащане.`
            : `Stripe Checkout session generated: ${data.sessionId}. Credits will be applied automatically upon completion.`
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || (language === 'bg' ? 'Възникна грешка при обработка на плащането.' : 'An error occurred processing the payment.'));
    } finally {
      setLoadingPkg(null);
    }
  };

  return (
    <div className="space-y-10 max-w-6xl mx-auto">
      {/* Header Editorial Banner */}
      <GsapReveal delay={0.1} y={20}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-white/[0.06] via-white/[0.03] to-white/[0.01] border border-white/[0.1] p-6 sm:p-8 backdrop-blur-xl">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-tech-mono uppercase tracking-wider font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                  {t.stripe.badge}
                </span>
                <span className="text-xs font-tech-mono text-slate-400">{t.stripe.headerDesc}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-light text-white tracking-tight">
                <span className="font-serif-luxury italic text-slate-200">Instant Neural</span>{' '}
                <span className="font-sans font-extrabold uppercase">{t.stripe.title}</span>
              </h2>
              <p className="text-sm text-slate-400 max-w-2xl mt-2 font-sans leading-relaxed">
                {t.stripe.subtitle}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="font-tech-mono text-xs text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                <span>USER: {userId.slice(0, 14)}...</span>
              </span>
            </div>
          </div>
        </div>
      </GsapReveal>

      {/* Package Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* STARTER PACKAGE */}
        <GsapReveal delay={0.2} y={30}>
          <div className="h-full rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.1] hover:border-white/[0.2] p-7 backdrop-blur-xl transition-all duration-300 flex flex-col justify-between relative group">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 text-xs font-tech-mono font-semibold rounded-full bg-white/[0.06] text-slate-300 border border-white/[0.08]">
                  {t.stripe.starterTitle}
                </span>
                <span className="text-xs font-tech-mono text-slate-400">50 {t.common.credits}</span>
              </div>
              
              <h3 className="text-xl font-bold text-white mb-2 font-sans">{t.stripe.starterCredits}</h3>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                {t.stripe.starterDesc}
              </p>

              <div className="flex items-baseline gap-1.5 mb-8">
                <span className="text-4xl font-extrabold font-tech-mono text-white tracking-tight">$9.99</span>
                <span className="text-xs text-slate-400 font-tech-mono">/ {language === 'bg' ? 'еднократно' : 'one-time'}</span>
              </div>

              <ul className="space-y-3 text-xs text-slate-300 mb-8">
                <li className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>{t.stripe.starterFeature1}</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>{t.stripe.starterFeature2}</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>{t.stripe.starterFeature3}</span>
                </li>
              </ul>
            </div>

            <div>
              <button
                id="btn-buy-small"
                onClick={() => handleBuyPackage('small')}
                disabled={loadingPkg === 'small'}
                className="w-full py-3.5 px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white font-tech-mono font-semibold text-xs transition-all flex items-center justify-center gap-2 border border-white/[0.1] hover:border-white/[0.25] cursor-pointer"
              >
                {loadingPkg === 'small' ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-300" />
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 text-slate-300" />
                    <span>{t.stripe.buyStarter}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </GsapReveal>

        {/* PRO PACKAGE (LUMINOUS HIGHLIGHT) */}
        <GsapReveal delay={0.3} y={30}>
          <div className="h-full rounded-2xl bg-gradient-to-b from-amber-500/[0.08] via-white/[0.03] to-white/[0.02] border-2 border-amber-500/40 hover:border-amber-400/60 p-7 backdrop-blur-xl shadow-2xl shadow-amber-500/10 transition-all duration-300 flex flex-col justify-between relative group">
            <div className="absolute -top-3.5 right-6">
              <span className="px-3.5 py-1 text-xs font-tech-mono font-bold rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/30 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
                {t.stripe.popular} (-25%)
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 text-xs font-tech-mono font-bold rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {t.stripe.proTitle}
                </span>
                <span className="text-xs font-tech-mono text-amber-400 font-bold">200 {t.common.credits}</span>
              </div>

              <h3 className="text-xl font-bold text-white mb-2 font-sans">{t.stripe.proCredits}</h3>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                {t.stripe.proDesc}
              </p>

              <div className="flex items-baseline gap-2 mb-8">
                <span className="text-4xl font-extrabold font-tech-mono text-amber-400 tracking-tight">$29.99</span>
                <span className="text-xs text-slate-500 line-through font-tech-mono">$39.99</span>
                <span className="text-xs text-slate-400 font-tech-mono">/ {language === 'bg' ? 'еднократно' : 'one-time'}</span>
              </div>

              <ul className="space-y-3 text-xs text-slate-200 mb-8">
                <li className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-400">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>{t.stripe.proFeature1}</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-400">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>{t.stripe.proFeature2}</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-400">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>{t.stripe.proFeature3}</span>
                </li>
              </ul>
            </div>

            <div>
              <button
                id="btn-buy-large"
                onClick={() => handleBuyPackage('large')}
                disabled={loadingPkg === 'large'}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-tech-mono font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-xl shadow-amber-500/25 cursor-pointer"
              >
                {loadingPkg === 'large' ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 text-slate-950" />
                    <span>{t.stripe.buyPro}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </GsapReveal>
      </div>

      {/* Webhook Feedback Message */}
      {errorMessage && (
        <div className="max-w-4xl mx-auto p-4 rounded-xl bg-rose-500/10 text-rose-300 text-xs border border-rose-500/25 shadow-lg flex items-center justify-between font-tech-mono">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-200 text-xs px-2 py-1 rounded cursor-pointer"
          >
            {t.common.close}
          </button>
        </div>
      )}

      {webhookMessage && (
        <div className="max-w-4xl mx-auto p-4 rounded-xl bg-slate-950 text-emerald-400 text-xs font-tech-mono border border-emerald-500/30 shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>{webhookMessage}</span>
          </div>
          <button
            onClick={() => setWebhookMessage(null)}
            className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded cursor-pointer"
          >
            {t.common.close}
          </button>
        </div>
      )}

      {/* Webhook Architecture Explanation Box */}
      <GsapReveal delay={0.4} y={20}>
        <div className="max-w-4xl mx-auto bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 backdrop-blur-md">
          <h4 className="text-xs font-tech-mono uppercase tracking-widest text-slate-300 flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span>{language === 'bg' ? 'Архитектура на Stripe Webhook & Криптографска сигурност' : 'Stripe Webhook Architecture & Cryptographic Security'}</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.06]">
              <div className="font-tech-mono font-semibold text-slate-200 mb-1.5 text-xs">1. Raw Body Stream</div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                {language === 'bg'
                  ? 'Маршрутът /api/stripe/webhook запазва автентичния бинарен поток за прецизно изчисляване на криптографския хеш.'
                  : 'Preserves raw byte stream before JSON normalization for exact HMAC signature authentication.'}
              </p>
            </div>
            <div className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.06]">
              <div className="font-tech-mono font-semibold text-slate-200 mb-1.5 text-xs">2. Signature Verification</div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                {language === 'bg'
                  ? 'stripe.webhooks.constructEvent проверява stripe-signature заглавието с твоя WEBHOOK_SECRET.'
                  : 'Validates cryptographic Stripe header payload against the configured webhook secret.'}
              </p>
            </div>
            <div className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.06]">
              <div className="font-tech-mono font-semibold text-slate-200 mb-1.5 text-xs">3. Idempotency Guard</div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                {language === 'bg'
                  ? 'Всяка транзакция се индексира по уникален stripeSessionId, предотвратявайки двойно кредитиране.'
                  : 'Guaranteed single crediting per session id using transactional state verification.'}
              </p>
            </div>
          </div>
        </div>
      </GsapReveal>

      {/* Transaction History Ledger */}
      <GsapReveal delay={0.5} y={20}>
        <div className="max-w-4xl mx-auto bg-white/[0.02] rounded-2xl border border-white/[0.08] p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.06]">
            <h4 className="text-xs font-tech-mono uppercase tracking-widest text-slate-300 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>{t.stripe.historyTitle}</span>
            </h4>
            <button
              onClick={fetchTransactions}
              className="text-xs font-tech-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{t.common.refresh}</span>
            </button>
          </div>

          {transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left font-tech-mono">
                <thead className="text-slate-500 uppercase text-[10px] tracking-wider border-b border-white/[0.06]">
                  <tr>
                    <th className="py-2.5 px-3">Session ID</th>
                    <th className="py-2.5 px-3">{t.stripe.colPackage}</th>
                    <th className="py-2.5 px-3">{t.stripe.colAmount}</th>
                    <th className="py-2.5 px-3">{t.stripe.colCredits}</th>
                    <th className="py-2.5 px-3">{t.stripe.colStatus}</th>
                    <th className="py-2.5 px-3">{t.stripe.colDate}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-3 text-slate-400 truncate max-w-[140px]">{tx.stripeSessionId}</td>
                      <td className="py-3 px-3 font-medium text-slate-200 uppercase">{tx.packageKey || 'Custom'}</td>
                      <td className="py-3 px-3 font-semibold text-slate-300">
                        ${(tx.amountPaid / 100).toFixed(2)} {tx.currency?.toUpperCase()}
                      </td>
                      <td className="py-3 px-3 text-emerald-400 font-bold">+{tx.creditsAdded}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500">{new Date(tx.createdAt).toLocaleDateString(language === 'bg' ? 'bg-BG' : 'en-US')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs font-tech-mono text-slate-500 py-6 text-center">{t.stripe.emptyHistory}</p>
          )}
        </div>
      </GsapReveal>
    </div>
  );
};
