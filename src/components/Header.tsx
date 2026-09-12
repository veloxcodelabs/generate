import React from 'react';
import { CreditCard, Video, Sparkles, RefreshCw, LogIn, LogOut, UserPlus, Globe, User as UserIcon } from 'lucide-react';
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
                <h1 className="text-lg font-bold tracking-tight text-white">{t.header.title}</h1>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Node.js Express v1.0
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {t.header.subtitle}
              </p>
            </div>
          </div>

          {/* User & Balance Badge & Auth Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Language Switcher Button */}
            <button
              id="btn-toggle-language"
              onClick={toggleLanguage}
              title={t.header.switchLanguage}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-2.5 py-1.5 rounded-xl border border-slate-700 text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              <span>{language === 'bg' ? '🇧🇬 BG' : '🇬🇧 EN'}</span>
            </button>

            {/* Status indicators */}
            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isStripeConfigured ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                {t.header.stripeStatus}: {isStripeConfigured ? t.header.live : t.header.sandbox}
              </span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isViggleConfigured ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                {t.header.aiVideoStatus}: {isViggleConfigured ? (
                  <span className="text-emerald-300 font-medium">
                    {t.header.live} ({viggleAccountBalance !== null && viggleAccountBalance !== undefined ? `${viggleAccountBalance} ${t.header.viggleCr}` : 'Active'})
                  </span>
                ) : t.header.simulated}
              </span>
            </div>

            {/* Credit balance display */}
            <div className="flex items-center gap-2.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 shadow-xs">
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold leading-tight">{t.header.balanceTitle}</div>
                <div className="text-sm font-bold text-amber-400 flex items-center justify-end gap-1 leading-tight">
                  <span>{credits}</span>
                  <span className="text-[11px] text-slate-300 font-normal">{t.common.creditsShort}</span>
                </div>
              </div>
              <button
                id="btn-refresh-balance"
                onClick={onRefresh}
                title={t.header.refreshTooltip}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* AUTHENTICATION CONTROLS: Вход и Регистрация / Профил */}
            {isLoggedIn ? (
              <div
                id="user-profile-badge"
                className="flex items-center gap-2 bg-slate-800/90 hover:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-700 transition-colors"
              >
                <div className="relative">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.name}
                      className="w-7 h-7 rounded-full object-cover border border-indigo-400"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
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
                  <div className="text-[10px] text-slate-400 truncate">{currentUser.email}</div>
                </div>

                <button
                  id="btn-logout"
                  onClick={onLogout}
                  title={t.header.signOut}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer ml-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                {/* Бутон Вход */}
                <button
                  id="btn-header-login"
                  onClick={() => onOpenAuth('login')}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5 text-slate-400" />
                  <span>{t.header.login}</span>
                </button>

                {/* Бутон Регистрация */}
                <button
                  id="btn-header-register"
                  onClick={() => onOpenAuth('register')}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{t.header.register}</span>
                  <span className="hidden sm:inline-block px-1.5 py-0.2 bg-emerald-500 text-slate-900 rounded-md text-[10px] font-black">
                    {t.header.bonusCreditsBadge}
                  </span>
                </button>
              </div>
            )}
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
            {t.header.tabViggle}
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
            {t.header.tabStripe}
          </button>
        </nav>
      </div>
    </header>
  );
};
