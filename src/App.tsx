/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { HeroSection } from './components/HeroSection.tsx';
import { ViggleStudio } from './components/ViggleStudio.tsx';
import { StripeCredits } from './components/StripeCredits.tsx';
import { AuthModal, AuthUser } from './components/AuthModal.tsx';
import { InteractiveField } from './components/canvas/InteractiveField.tsx';
import { safeFetchJson } from './utils/apiHelper.ts';

const AUTH_STORAGE_KEY = 'viggle_auth_user';

export default function App() {
  const [activeTab, setActiveTab] = useState<'viggle' | 'stripe'>('viggle');
  const [credits, setCredits] = useState<number>(0);
  const [userName, setUserName] = useState<string>('Гост');
  const [userId, setUserId] = useState<string>('usr_demo_123');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');
  const [isStripeConfigured, setIsStripeConfigured] = useState<boolean>(false);
  const [isViggleConfigured, setIsViggleConfigured] = useState<boolean>(false);
  const [viggleAccountBalance, setViggleAccountBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // 1. Initial user session retrieval from localStorage
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
      console.warn('Error reading saved session:', e);
    }
  }, []);

  // 2. Fetch server health and profile
  const fetchUserData = async () => {
    try {
      // Check health
      const healthResponse = await safeFetchJson<{ stripeConfigured?: boolean; viggleConfigured?: boolean }>('/api/health');
      if (healthResponse.ok && healthResponse.data) {
        setIsStripeConfigured(Boolean(healthResponse.data.stripeConfigured));
        setIsViggleConfigured(Boolean(healthResponse.data.viggleConfigured));
      }

      // Check real Viggle AI API balance if configured
      const viggleCreditsRes = await safeFetchJson<{ configured?: boolean; balance?: number | null }>('/api/viggle/credits');
      if (viggleCreditsRes.ok && viggleCreditsRes.data && typeof viggleCreditsRes.data.balance === 'number') {
        setViggleAccountBalance(viggleCreditsRes.data.balance);
      }

      // Sync active user
      const activeId = userId || 'usr_demo_123';
      const queryParams = new URLSearchParams({ userId: activeId });
      if (currentUser?.email) queryParams.set('email', currentUser.email);
      if (currentUser?.name) queryParams.set('name', currentUser.name);

      const userResponse = await safeFetchJson<{ user?: { id: string; credits: number; name?: string; email?: string } }>(
        `/api/user/me?${queryParams.toString()}`
      );
      if (userResponse.ok && userResponse.data?.user) {
        const u = userResponse.data.user;
        setCredits(u.credits);
        if (u.name) {
          setUserName(u.name);
        }
        if (u.id && u.id !== userId) {
          setUserId(u.id);
        }
      }
    } catch (err) {
      console.error('Error syncing user data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [userId]);

  // Auth success callback
  const handleAuthSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setUserId(user.id);
    setUserName(user.name);
    setCredits(user.credits);
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } catch (e) {
      console.warn('Storage sync error:', e);
    }
    setIsAuthModalOpen(false);
  };

  // Logout handler
  const handleLogout = () => {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (e) {
      console.warn('Storage cleanup error:', e);
    }
    setCurrentUser(null);
    setUserId('usr_demo_123');
    setUserName('Гост');
    setCredits(0);
    fetchUserData();
  };

  const handleOpenAuth = (tab: 'login' | 'register') => {
    setAuthModalTab(tab);
    setIsAuthModalOpen(true);
  };

  // Reset test credits (0 credits)
  const handleResetCredits = async () => {
    try {
      const targetCredits = 0;
      const response = await safeFetchJson<{ user: { credits: number } }>('/api/user/reset-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, credits: targetCredits }),
      });
      if (response.ok && response.data?.user) {
        setCredits(response.data.user.credits);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans relative selection:bg-indigo-500 selection:text-white bg-grid-pattern">
      {/* Interactive WebGL / Canvas Background Mesh */}
      <InteractiveField />

      {/* Subtle Grain & Ambient Lighting Overlay */}
      <div className="bg-film-grain fixed inset-0 pointer-events-none opacity-30 z-10" aria-hidden="true"></div>
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none z-0" aria-hidden="true"></div>
      <div className="fixed bottom-10 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-[140px] pointer-events-none z-0" aria-hidden="true"></div>

      {/* Flagship Cinematic Header */}
      <div className="relative z-40">
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
      </div>

      {/* Editorial Breathing Hero Section */}
      <div className="relative z-20">
        <HeroSection
          credits={credits}
          activeTab={activeTab}
          setActiveTab={(tab) => setActiveTab(tab)}
          isViggleConfigured={isViggleConfigured}
          isStripeConfigured={isStripeConfigured}
          viggleAccountBalance={viggleAccountBalance}
          onOpenAuth={handleOpenAuth}
          isLoggedIn={Boolean(currentUser && currentUser.authProvider !== 'demo')}
        />
      </div>

      {/* Main Studio Console & Production Ledger Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-20">
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

      {/* Auth Modal (Google & Password) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        initialTab={authModalTab}
        defaultGmail="martivideoproductions2@gmail.com"
      />

      {/* Flagship Architectural Footer */}
      <footer className="relative z-20 bg-[#06080d]/90 border-t border-white/[0.08] py-8 text-xs text-slate-400 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="font-tech-mono tracking-wider text-slate-300">
              GENERATE.MARTITONY.COM // FLAGSHIP ENGINE
            </span>
          </div>

          <div className="text-center font-sans text-slate-400">
            Node.js (Express) Hybrid Backend • H3 Video Synthesis • Native Spatial Audio • Stripe Cryptographic Webhooks
          </div>

          <div className="flex items-center gap-4 font-tech-mono text-[11px] text-slate-400">
            <span>SHA-256 HMAC</span>
            <span>•</span>
            <span>REST API</span>
            <span>•</span>
            <span className="text-emerald-400">STATUS: 200 OK</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
