/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { ViggleStudio } from './components/ViggleStudio.tsx';
import { StripeCredits } from './components/StripeCredits.tsx';
import { AuthModal, AuthUser } from './components/AuthModal.tsx';
import { safeFetchJson } from './utils/apiHelper.ts';

const AUTH_STORAGE_KEY = 'viggle_auth_user';

export default function App() {
  const [activeTab, setActiveTab] = useState<'viggle' | 'stripe'>('viggle');
  const [credits, setCredits] = useState<number>(10);
  const [userName, setUserName] = useState<string>('Мартин Георгиев');
  const [userId, setUserId] = useState<string>('usr_demo_123');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');
  const [isStripeConfigured, setIsStripeConfigured] = useState<boolean>(false);
  const [isViggleConfigured, setIsViggleConfigured] = useState<boolean>(false);
  const [viggleAccountBalance, setViggleAccountBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // 1. Инициализация на запазен автентикиран потребител от localStorage
  useEffect(() => {
    try {
      const savedUserStr = localStorage.getItem(AUTH_STORAGE_KEY);
      if (savedUserStr) {
        const savedUser: AuthUser = JSON.parse(savedUserStr);
        if (savedUser && savedUser.id) {
          setCurrentUser(savedUser);
          setUserId(savedUser.id);
          setUserName(savedUser.name || 'Потребител');
          if (typeof savedUser.credits === 'number') {
            setCredits(savedUser.credits);
          }
        }
      }
    } catch (e) {
      console.warn('Неуспешно четене на запазена потребителска сесия:', e);
    }
  }, []);

  // 2. Зареждане на профила и статуса на бекенда
  const fetchUserData = async () => {
    try {
      // Проверка на health статуса
      const healthResponse = await safeFetchJson<{ stripeConfigured?: boolean; viggleConfigured?: boolean }>('/api/health');
      if (healthResponse.ok && healthResponse.data) {
        setIsStripeConfigured(Boolean(healthResponse.data.stripeConfigured));
        setIsViggleConfigured(Boolean(healthResponse.data.viggleConfigured));
      }

      // Проверка на реалния Viggle AI баланс
      const viggleCreditsRes = await safeFetchJson<{ configured?: boolean; balance?: number | null }>('/api/viggle/credits');
      if (viggleCreditsRes.ok && viggleCreditsRes.data && typeof viggleCreditsRes.data.balance === 'number') {
        setViggleAccountBalance(viggleCreditsRes.data.balance);
      }

      // Вземане на данни за текущия потребител
      const activeId = userId || 'usr_demo_123';
      const userResponse = await safeFetchJson<{ user?: { credits: number; name?: string; email?: string } }>(
        `/api/user/me?userId=${encodeURIComponent(activeId)}`
      );
      if (userResponse.ok && userResponse.data?.user) {
        setCredits(userResponse.data.user.credits);
        if (userResponse.data.user.name) {
          setUserName(userResponse.data.user.name);
        }
      }
    } catch (err) {
      console.error('Грешка при зареждане на потребителски данни:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [userId]);

  // Успешен вход или регистрация (Google / Имейл)
  const handleAuthSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setUserId(user.id);
    setUserName(user.name);
    setCredits(user.credits);
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } catch (e) {
      console.warn('Грешка при запазване в localStorage:', e);
    }
    setIsAuthModalOpen(false);
  };

  // Изход от профила
  const handleLogout = () => {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (e) {
      console.warn('Грешка при изчистване на сесията:', e);
    }
    setCurrentUser(null);
    setUserId('usr_demo_123');
    setUserName('Мартин Георгиев');
    fetchUserData();
  };

  const handleOpenAuth = (tab: 'login' | 'register') => {
    setAuthModalTab(tab);
    setIsAuthModalOpen(true);
  };

  // Спомагателно възстановяване на кредити за лесно тестване в предварителен преглед
  const handleResetCredits = async () => {
    try {
      const response = await safeFetchJson<{ user: { credits: number } }>('/api/user/reset-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, credits: 10 }),
      });
      if (response.ok && response.data?.user) {
        setCredits(response.data.user.credits);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header with Login / Register & User Profile */}
      <Header
        credits={credits}
        userName={userName}
        userId={userId}
        currentUser={currentUser}
        isStripeConfigured={isStripeConfigured}
        isViggleConfigured={isViggleConfigured}
        viggleAccountBalance={viggleAccountBalance}
        onRefresh={fetchUserData}
        onResetCredits={handleResetCredits}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
        activeTab={activeTab}
        setActiveTab={(tab: any) => setActiveTab(tab)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'viggle' && (
          <ViggleStudio
            credits={credits}
            userId={userId}
            onCreditChange={fetchUserData}
          />
        )}

        {activeTab === 'stripe' && (
          <StripeCredits
            userId={userId}
            onCreditChange={fetchUserData}
          />
        )}
      </main>

      {/* Modal Dialog за Вход и Регистрация (Google / Gmail & Имейл) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        initialTab={authModalTab}
        defaultGmail="martivideoproductions2@gmail.com"
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            Node.js (Express) Backend • AI Video Generation (Text-to-Video, Image-to-Video, Motion Remix) • Stripe Checkout & Webhooks
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Express REST API</span>
            <span>•</span>
            <span>Google / Gmail Auth</span>
            <span>•</span>
            <span>Stripe Payments</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
