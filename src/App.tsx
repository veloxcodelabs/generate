/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { ViggleStudio } from './components/ViggleStudio.tsx';
import { StripeCredits } from './components/StripeCredits.tsx';
import { safeFetchJson } from './utils/apiHelper.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<'viggle' | 'stripe'>('viggle');
  const [credits, setCredits] = useState<number>(10);
  const [userName, setUserName] = useState<string>('Мартин Георгиев');
  const [userId, setUserId] = useState<string>('usr_demo_123');
  const [isStripeConfigured, setIsStripeConfigured] = useState<boolean>(false);
  const [isViggleConfigured, setIsViggleConfigured] = useState<boolean>(false);
  const [viggleAccountBalance, setViggleAccountBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Зареждане на профила и статуса на бекенда
  const fetchUserData = async () => {
    try {
      // 1. Проверка на health статуса
      const healthResponse = await safeFetchJson<{ stripeConfigured?: boolean; viggleConfigured?: boolean }>('/api/health');
      if (healthResponse.ok && healthResponse.data) {
        setIsStripeConfigured(Boolean(healthResponse.data.stripeConfigured));
        setIsViggleConfigured(Boolean(healthResponse.data.viggleConfigured));
      }

      // 2. Проверка на реалния Viggle AI баланс
      const viggleCreditsRes = await safeFetchJson<{ configured?: boolean; balance?: number | null }>('/api/viggle/credits');
      if (viggleCreditsRes.ok && viggleCreditsRes.data && typeof viggleCreditsRes.data.balance === 'number') {
        setViggleAccountBalance(viggleCreditsRes.data.balance);
      }

      // 3. Вземане на текущ потребител
      const userResponse = await safeFetchJson<{ user?: { credits: number; name?: string } }>(
        `/api/user/me?userId=${encodeURIComponent(userId)}`
      );
      if (userResponse.ok && userResponse.data?.user) {
        setCredits(userResponse.data.user.credits);
        setUserName(userResponse.data.user.name || 'Мартин');
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
      {/* Header */}
      <Header
        credits={credits}
        userName={userName}
        userId={userId}
        isStripeConfigured={isStripeConfigured}
        isViggleConfigured={isViggleConfigured}
        viggleAccountBalance={viggleAccountBalance}
        onRefresh={fetchUserData}
        onResetCredits={handleResetCredits}
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

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            Node.js (Express) Backend • AI Video Generation (Text-to-Video, Image-to-Video, Motion Remix) • Stripe Checkout & Webhooks
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Express REST API</span>
            <span>•</span>
            <span>Stripe Payments</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
