import React from 'react';
import { CreditCard, Video, Sparkles, RefreshCw, LogIn, LogOut, UserPlus, Globe, Shield, Terminal } from 'lucide-react';
import { AuthUser } from './AuthModal.tsx';
import { useLanguage } from '../i18n/LanguageContext.tsx';

interface HeaderProps {
  credits: number;
  userName: string;
  userId: string;
  currentUser: AuthUser | null;
  isStripeConfigured: boolean;
  isViggleConfigured: boolean;
  viggleAccountBalance?: number | null;
  onRefresh: () => void;
  onResetCredits: () => void;
  onOpenAuth: (initialTab: 'login' | 'register') => void;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  credits,
  userName,
  userId,
  currentUser,
  isStripeConfigured,
  isViggleConfigured,
  viggleAccountBalance,
  onRefresh,
  onResetCredits,
  onOpenAuth,
  onLogout,
  activeTab,
  setActiveTab,
}) => {
  const { language, toggleLanguage, t } = useLanguage();
  const isLoggedIn = currentUser && currentUser.authProvider !== 'demo';

  return (
    <header className="bg-[#080a10]/80 backdrop-blur-xl border-b border-white/[0.08] text-white sticky top-0 z-40 shadow-2xl transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3.5 gap-3.5">
          {/* Brand & Digital Architecture Identification */}
          <div className="flex items-center space-x-3.5">
            <div className="relative group cursor-pointer" onClick={() => setActiveTab('viggle')}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-600 to-indigo-800 flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-white/20 transition-transform duration-300 group-hover:scale-105">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl blur-xs opacity-0 group-hover:opacity-40 transition-opacity"></div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-bold tracking-tight text-white font-sans flex items-center gap-1.5">
                  <span className="font-serif-luxury italic font-normal text-indigo-300">Generate</span>
                  <span className="tracking-wider">MARTITONY</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 tracking-wide font-sans">
                {t.header.subtitle}
              </p>
            </div>
          </div>

          {/* User Controls, Metrics & Authentication */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Language Switcher */}
            <button
              id="btn-toggle-language"
              onClick={toggleLanguage}
              title={t.header.switchLanguage}
              className="flex items-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white px-2.5 py-1.5 rounded-xl border border-white/[0.08] text-xs font-tech-mono font-medium transition-all duration-200 cursor-pointer shadow-xs"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              <span>{language === 'bg' ? '🇧🇬 BG' : '🇬🇧 EN'}</span>
            </button>

            {/* Hardware & Gateway Telemetry */}
            <div className="hidden lg:flex items-center gap-3 text-[11px] font-tech-mono text-slate-400 bg-white/[0.03] px-3 py-1.5 rounded-xl border border-white/[0.06]">
              <span className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isStripeConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                <span>STRIPE:</span>
                <span className={isStripeConfigured ? 'text-emerald-400' : 'text-amber-400'}>
                  {isStripeConfigured ? t.header.live : t.header.sandbox}
                </span>
              </span>
              <span className="text-white/10">|</span>
              <span className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isViggleConfigured ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                <span>AI API:</span>
                <span className={isViggleConfigured ? 'text-emerald-400' : 'text-slate-300'}>
                  {isViggleConfigured ? (
                    viggleAccountBalance !== null && viggleAccountBalance !== undefined ? `${viggleAccountBalance} CR` : 'ACTIVE'
                  ) : t.header.simulated}
                </span>
              </span>
            </div>

            {/* Credit Balance Badge */}
            <div className="flex items-center gap-2.5 bg-gradient-to-r from-white/[0.05] to-white/[0.02] hover:from-white/[0.08] hover:to-white/[0.04] px-3 py-1.5 rounded-xl border border-white/[0.1] shadow-xs transition-all">
              <div className="text-right">
                <div className="text-[9px] uppercase font-tech-mono tracking-widest text-slate-400 leading-tight">
                  {t.header.balanceTitle}
                </div>
                <div className="text-sm font-tech-mono font-bold text-amber-400 flex items-center justify-end gap-1 leading-tight">
                  <span>{credits}</span>
                  <span className="text-[10px] text-slate-400 font-normal uppercase">{t.common.creditsShort}</span>
                </div>
              </div>
              <button
                id="btn-refresh-balance"
                onClick={onRefresh}
                title={t.header.refreshTooltip}
                className="p-1 text-slate-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Authentication Badge or Action Buttons */}
            {isLoggedIn ? (
              <div
                id="user-profile-badge"
                className="flex items-center gap-2 bg-white/[0.04] hover:bg-white/[0.07] px-2.5 py-1.5 rounded-xl border border-white/[0.08] transition-colors"
              >
                <div className="relative">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.name}
                      className="w-7 h-7 rounded-full object-cover border border-indigo-400/60 shadow-xs"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      {currentUser.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {currentUser.authProvider === 'google' && (
                    <span
                      title={t.header.signedInWithGoogle}
                      className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-white rounded-full flex items-center justify-center shadow-xs"
                    >
                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                    </span>
                  )}
                </div>

                <div className="hidden sm:block text-left text-xs max-w-[120px] truncate">
                  <div className="font-semibold text-slate-200 truncate">{currentUser.name}</div>
                  <div className="text-[10px] text-slate-400 font-tech-mono truncate">{currentUser.email}</div>
                </div>

                <button
                  id="btn-logout"
                  onClick={onLogout}
                  title={t.header.signOut}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer ml-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  id="btn-header-login"
                  onClick={() => onOpenAuth('login')}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-xl border border-white/[0.08] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5 text-slate-400" />
                  <span>{t.header.login}</span>
                </button>

                <button
                  id="btn-header-register"
                  onClick={() => onOpenAuth('register')}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 rounded-xl shadow-lg shadow-indigo-500/25 border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{t.header.register}</span>
                  {t.header.bonusCreditsBadge ? (
                    <span className="hidden sm:inline-block px-1.5 py-0.5 bg-emerald-400 text-slate-950 rounded-md text-[10px] font-black font-tech-mono">
                      {t.header.bonusCreditsBadge}
                    </span>
                  ) : null}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Cinematic Tab Navigation Strip */}
        <nav className="flex space-x-2 border-t border-white/[0.06] pt-2 pb-2 overflow-x-auto">
          <button
            id="nav-viggle"
            onClick={() => setActiveTab('viggle')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'viggle'
                ? 'bg-white/[0.1] text-white border border-white/[0.15] shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            <Video className={`w-3.5 h-3.5 ${activeTab === 'viggle' ? 'text-indigo-400' : 'text-slate-500'}`} />
            <span className="font-tech-mono tracking-wide">{t.header.tabViggle}</span>
          </button>

          <button
            id="nav-stripe"
            onClick={() => setActiveTab('stripe')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'stripe'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            <CreditCard className={`w-3.5 h-3.5 ${activeTab === 'stripe' ? 'text-amber-400' : 'text-slate-500'}`} />
            <span className="font-tech-mono tracking-wide">{t.header.tabStripe}</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
