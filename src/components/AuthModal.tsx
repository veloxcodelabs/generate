/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff, Sparkles, X, CheckCircle2, AlertCircle, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { safeFetchJson } from '../utils/apiHelper.ts';
import { useLanguage } from '../i18n/LanguageContext.tsx';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  credits: number;
  avatarUrl?: string;
  authProvider?: 'google' | 'email' | 'demo';
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
  initialTab?: 'login' | 'register';
  defaultGmail?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialTab = 'login',
  defaultGmail = 'martivideoproductions2@gmail.com',
}) => {
  const { t } = useLanguage();
  const [tab, setTab] = useState<'login' | 'register'>(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showGmailPicker, setShowGmailPicker] = useState(false);
  const [customGmail, setCustomGmail] = useState('');

  if (!isOpen) return null;

  // 1. Бърз вход / регистрация с Google / Gmail
  const handleGoogleAuth = async (gmailAddress: string) => {
    setError(null);
    setSuccessMsg(null);
    setGoogleLoading(true);

    try {
      const suggestedName = gmailAddress.split('@')[0].replace(/[._]/g, ' ');
      const formattedName = suggestedName.charAt(0).toUpperCase() + suggestedName.slice(1);

      const response = await safeFetchJson<{
        success: boolean;
        user: AuthUser;
        isNew: boolean;
        message: string;
      }>('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: gmailAddress,
          name: formattedName,
          avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(formattedName)}&backgroundColor=4f46e5`,
        }),
      });

      if (!response.ok || !response.data?.success) {
        throw new Error(response.error || 'Google authentication failed.');
      }

      setSuccessMsg(response.data.message || t.auth.loginSuccess);
      setTimeout(() => {
        onSuccess(response.data!.user);
        onClose();
      }, 600);
    } catch (err: any) {
      setError(err.message || 'Error occurred during Google authentication.');
    } finally {
      setGoogleLoading(false);
    }
  };

  // 2. Вход или регистрация с имейл и парола
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email.trim() || !password.trim()) {
      setError(t.auth.allFieldsRequired);
      return;
    }

    if (password.length < 6) {
      setError(t.auth.passwordMinLength);
      return;
    }

    setLoading(true);

    try {
      const endpoint = tab === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload: any = {
        email: email.trim(),
        password,
      };
      if (tab === 'register' && name.trim()) {
        payload.name = name.trim();
      }

      const response = await safeFetchJson<{
        success: boolean;
        user: AuthUser;
        message?: string;
      }>(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok || !response.data?.success) {
        throw new Error(response.error || (tab === 'register' ? 'Registration failed.' : 'Invalid email or password.'));
      }

      setSuccessMsg(response.data.message || (tab === 'register' ? t.auth.registerSuccess : t.auth.loginSuccess));
      setTimeout(() => {
        onSuccess(response.data!.user);
        onClose();
      }, 600);
    } catch (err: any) {
      setError(err.message || 'An error occurred during submission.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="auth-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-opacity duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="auth-modal-card"
        className="relative w-full max-w-md bg-[#0b0e17] rounded-2xl shadow-2xl border border-white/[0.12] overflow-hidden"
      >
        {/* Header Ribbon */}
        <div className="bg-white/[0.03] px-6 py-5 flex items-center justify-between border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-white/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white font-sans">
                {tab === 'login' ? t.auth.loginTitle : t.auth.registerTitle}
              </h2>
              <p className="text-[11px] text-slate-400 font-sans">
                {t.auth.subtitle}
              </p>
            </div>
          </div>
          <button
            id="btn-close-auth-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switchers: Вход / Регистрация */}
        <div className="flex border-b border-white/[0.08] bg-black/40 p-1">
          <button
            id="tab-btn-login"
            type="button"
            onClick={() => {
              setTab('login');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-tech-mono font-semibold rounded-xl transition-all cursor-pointer text-center ${
              tab === 'login'
                ? 'bg-white/[0.1] text-white shadow-xs border border-white/[0.15]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.auth.tabLogin}
          </button>
          <button
            id="tab-btn-register"
            type="button"
            onClick={() => {
              setTab('register');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-tech-mono font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              tab === 'register'
                ? 'bg-white/[0.1] text-white shadow-xs border border-white/[0.15]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>{t.auth.tabRegister}</span>
            {t.auth.bonusNotice ? (
              <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-bold">
                {t.auth.bonusNotice}
              </span>
            ) : null}
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Notification Alerts */}
          {error && (
            <div
              id="auth-error-alert"
              className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2 font-tech-mono"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div
              id="auth-success-alert"
              className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2 font-tech-mono"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">{successMsg}</span>
            </div>
          )}

          {/* 1. ПРИОРИТЕТЕН GMAIL / GOOGLE ВХОД (1-CLICK) */}
          <div className="space-y-2">
            <label className="block text-[10px] font-tech-mono uppercase tracking-widest text-slate-400">
              {t.auth.quickAccessLabel}
            </label>

            {/* Google button */}
            <button
              id="btn-google-auth-primary"
              type="button"
              disabled={googleLoading || loading}
              onClick={() => handleGoogleAuth(defaultGmail)}
              className="w-full py-2.5 px-4 bg-white/[0.05] hover:bg-white/[0.1] text-white font-medium text-xs rounded-xl border border-white/[0.12] shadow-xs flex items-center justify-center gap-3 transition-all hover:border-white/[0.25] cursor-pointer disabled:opacity-50"
            >
              {googleLoading ? (
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span className="font-tech-mono">
                {tab === 'login' ? t.auth.googleLogin : t.auth.googleRegister}
              </span>
            </button>

            {/* Sub text and switch */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1 font-tech-mono">
              <span>{t.auth.connectWith} <strong className="text-slate-200">{defaultGmail}</strong></span>
              <button
                type="button"
                onClick={() => setShowGmailPicker(!showGmailPicker)}
                className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer underline"
              >
                {showGmailPicker ? t.auth.hide : t.auth.differentGmail}
              </button>
            </div>

            {/* Picker for other Gmail */}
            {showGmailPicker && (
              <div className="p-3 bg-white/[0.03] border border-white/[0.08] rounded-xl space-y-2 text-xs">
                <label className="block text-[10px] font-tech-mono text-slate-400 uppercase tracking-wider">
                  {t.auth.enterCustomGmail}
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder={t.auth.gmailPlaceholder}
                    value={customGmail}
                    onChange={(e) => setCustomGmail(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white/[0.05] border border-white/[0.1] rounded-lg text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-tech-mono placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    disabled={!customGmail.includes('@')}
                    onClick={() => handleGoogleAuth(customGmail.trim())}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs cursor-pointer disabled:opacity-50 font-tech-mono"
                  >
                    {t.auth.quickLoginBtn}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Architectural Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-white/[0.08] w-full"></div>
            <span className="bg-[#0b0e17] px-3 text-[10px] text-slate-500 uppercase font-tech-mono tracking-widest">
              {t.auth.orWithEmailPassword}
            </span>
            <div className="border-t border-white/[0.08] w-full"></div>
          </div>

          {/* 2. ТРАДИЦИОННА ФОРМА ЗА ИМЕЙЛ И ПАРОЛА */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {tab === 'register' && (
              <div>
                <label className="block text-[10px] font-tech-mono text-slate-400 mb-1 uppercase tracking-wider">
                  {t.auth.yourName}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    id="auth-input-name"
                    type="text"
                    placeholder={t.auth.namePlaceholder}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white/[0.04] border border-white/[0.1] rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-sans placeholder:text-slate-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-tech-mono text-slate-400 mb-1 uppercase tracking-wider">
                {t.auth.emailAddress}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  id="auth-input-email"
                  type="email"
                  required
                  placeholder={t.auth.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white/[0.04] border border-white/[0.1] rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-tech-mono placeholder:text-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-tech-mono text-slate-400 mb-1 uppercase tracking-wider">
                {t.auth.password}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  id="auth-input-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder={t.auth.passwordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2 bg-white/[0.04] border border-white/[0.1] rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-tech-mono placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {tab === 'register' && t.auth.freeCreditsCallout ? (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-[11px] text-emerald-300 flex items-center gap-2 font-tech-mono">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{t.auth.freeCreditsCallout}</span>
              </div>
            ) : null}

            <button
              id="btn-auth-submit"
              type="submit"
              disabled={loading || googleLoading}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/20 border border-white/10 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-tech-mono"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <>
                  <span>{tab === 'login' ? t.auth.submitLogin : t.auth.submitRegister}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Bottom Switcher */}
          <div className="text-center pt-2 text-xs text-slate-400 font-sans">
            {tab === 'login' ? (
              <span>
                {t.auth.noAccount}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setTab('register');
                    setError(null);
                  }}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer underline font-tech-mono"
                >
                  {t.auth.registerFree}
                </button>
              </span>
            ) : (
              <span>
                {t.auth.haveAccount}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setError(null);
                  }}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer underline font-tech-mono"
                >
                  {t.auth.loginHere}
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
