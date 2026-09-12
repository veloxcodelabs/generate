import React from 'react';
import { CreditCard, Video, Sparkles, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

interface HeaderProps {
  credits: number;
  userName: string;
  userId: string;
  isStripeConfigured: boolean;
  isViggleConfigured: boolean;
  viggleAccountBalance?: number | null;
  onRefresh: () => void;
  onResetCredits: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  credits,
  userName,
  userId,
  isStripeConfigured,
  isViggleConfigured,
  viggleAccountBalance,
  onRefresh,
  onResetCredits,
  activeTab,
  setActiveTab,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-4 gap-4">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">AI Video & Stripe Backend</h1>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Node.js Express v1.0
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Express API с Stripe Checkout, Webhooks & AI Video Generation
              </p>
            </div>
          </div>

          {/* User & Balance Badge */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Status indicators */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isStripeConfigured ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                Stripe: {isStripeConfigured ? 'Live' : 'Sandbox'}
              </span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isViggleConfigured ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                AI Video API: {isViggleConfigured ? (
                  <span className="text-emerald-300 font-medium">
                    Live ({viggleAccountBalance !== null && viggleAccountBalance !== undefined ? `${viggleAccountBalance} Viggle cr.` : 'Active'})
                  </span>
                ) : 'Simulated'}
              </span>
            </div>

            {/* Credit balance display */}
            <div className="flex items-center gap-3 bg-slate-800 px-3.5 py-1.5 rounded-xl border border-slate-700">
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Баланс</div>
                <div className="text-sm font-bold text-amber-400 flex items-center justify-end gap-1">
                  <span>{credits}</span>
                  <span className="text-xs text-slate-300 font-normal">кредита</span>
                </div>
              </div>
              <button
                id="btn-refresh-user"
                onClick={onRefresh}
                title="Опресни данни"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                id="btn-reset-credits"
                onClick={onResetCredits}
                title="Възстанови на 10 кредита (за тестове)"
                className="px-2 py-1 text-[11px] font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-md transition-colors"
              >
                +10 (Тест)
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex space-x-1 border-t border-slate-800 pt-2 pb-1 overflow-x-auto">
          <button
            id="nav-viggle"
            onClick={() => setActiveTab('viggle')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'viggle'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Video className="w-4 h-4" />
            AI Видео Студио (/api/generate-video)
          </button>
          <button
            id="nav-stripe"
            onClick={() => setActiveTab('stripe')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'stripe'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Stripe Кредити & Webhook
          </button>
        </nav>
      </div>
    </header>
  );
};
