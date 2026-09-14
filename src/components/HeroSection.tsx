import React from 'react';
import { Sparkles, Video, ArrowUpRight, Zap, Play, Cpu, ShieldCheck } from 'lucide-react';
import { GsapReveal } from './motion/GsapReveal.tsx';
import { useLanguage } from '../i18n/LanguageContext.tsx';

interface HeroSectionProps {
  credits: number;
  activeTab: 'viggle' | 'stripe';
  setActiveTab: (tab: 'viggle' | 'stripe') => void;
  isViggleConfigured: boolean;
  isStripeConfigured: boolean;
  viggleAccountBalance?: number | null;
  onOpenAuth: (tab: 'login' | 'register') => void;
  isLoggedIn: boolean;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  credits,
  activeTab,
  setActiveTab,
  isViggleConfigured,
  isStripeConfigured,
  viggleAccountBalance,
  onOpenAuth,
  isLoggedIn,
}) => {
  const { language } = useLanguage();

  return (
    <section className="relative pt-12 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      {/* Subtle Architectural Crosshairs & Monospace Top Bar */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-10 text-[11px] font-tech-mono tracking-widest text-slate-400 uppercase">
        <div className="flex items-center gap-3">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>GENERATE.MARTITONY.COM // CORE_ENGINE_V1.0</span>
        </div>
        <div className="hidden md:flex items-center gap-6">
          <span>LATENCY: 24MS</span>
          <span>MODEL: H3_NEURAL_MOTION</span>
          <span>STATUS: {isViggleConfigured ? 'LIVE_API' : 'SANDBOX_SIM'}</span>
        </div>
      </div>

      {/* Main Massive Editorial Typography Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
        <div className="lg:col-span-8">
          <GsapReveal delay={0.1} y={24} duration={0.8}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.1] text-xs text-slate-300 mb-6 backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-tech-mono text-[11px] tracking-wider uppercase">
                {language === 'bg' ? 'Елитен AI Видео Синтез' : 'Next-Generation Neural Video Studio'}
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-500"></span>
              <span className="text-emerald-400 font-semibold text-[11px]">
                {credits} {language === 'bg' ? 'кредита налични' : 'credits ready'}
              </span>
            </div>
          </GsapReveal>

          <GsapReveal delay={0.2} y={35} duration={1.0}>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-light tracking-tight text-white leading-[1.08] mb-6">
              <span className="font-serif-luxury italic font-normal text-slate-100 block">
                Kinetic Choreography
              </span>
              <span className="font-sans font-extrabold tracking-tight uppercase bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Neural Video Engine
              </span>
            </h1>
          </GsapReveal>

          <GsapReveal delay={0.3} y={25} duration={0.9}>
            <p className="text-base sm:text-lg text-slate-400 max-w-2xl font-light leading-relaxed mb-8">
              {language === 'bg'
                ? 'Превърнете текст в кинематографично видео с нативно аудио, анимирайте статични портрети или прехвърлете хореография от видео клип върху персонаж с фотореалистична точност.'
                : 'Direct high-fidelity video motion synthesis from pure text prompts, animate first-frame still portraits, or transfer complex athletic choreography onto custom avatars with zero artifacting.'}
            </p>
          </GsapReveal>

          {/* Action CTAs */}
          <GsapReveal delay={0.4} y={20} duration={0.8}>
            <div className="flex flex-wrap items-center gap-3.5">
              <button
                onClick={() => setActiveTab('viggle')}
                className={`group px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center gap-2 cursor-pointer shadow-lg ${
                  activeTab === 'viggle'
                    ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-indigo-500/25 ring-1 ring-white/20'
                    : 'bg-white/[0.06] text-white hover:bg-white/[0.12] border border-white/[0.1]'
                }`}
              >
                <Play className="w-4 h-4 fill-current transition-transform group-hover:scale-110" />
                <span>{language === 'bg' ? 'Отвори AI Студиото' : 'Launch Video Studio'}</span>
              </button>

              <button
                onClick={() => setActiveTab('stripe')}
                className={`group px-5 py-3 rounded-xl font-medium text-sm transition-all duration-300 flex items-center gap-2 cursor-pointer ${
                  activeTab === 'stripe'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-white/[0.04] text-slate-300 hover:text-white hover:bg-white/[0.08] border border-white/[0.08]'
                }`}
              >
                <Zap className="w-4 h-4 text-amber-400" />
                <span>{language === 'bg' ? 'Зареди Кредити (Stripe)' : 'Get AI Credits'}</span>
                <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>

              {!isLoggedIn && (
                <button
                  onClick={() => onOpenAuth('register')}
                  className="px-4 py-3 rounded-xl text-xs font-tech-mono text-emerald-300 hover:text-emerald-200 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/30 transition-all cursor-pointer flex items-center gap-2"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{language === 'bg' ? '+1 Безплатен Кредит при Регистрация' : '+1 Free Credit on Sign-up'}</span>
                </button>
              )}
            </div>
          </GsapReveal>
        </div>

        {/* Right Metric Card / Architecture Blueprint */}
        <div className="lg:col-span-4">
          <GsapReveal delay={0.4} y={30} duration={1.0}>
            <div className="p-6 rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.01] border border-white/[0.1] backdrop-blur-xl relative overflow-hidden group">
              {/* Radial ambient glow */}
              <div className="absolute -top-12 -right-12 w-44 h-44 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/25 transition-all duration-700"></div>

              <div className="flex items-center justify-between mb-4 border-b border-white/[0.06] pb-3">
                <span className="text-[11px] font-tech-mono text-slate-400 uppercase tracking-wider">
                  TELEMETRY MATRIX
                </span>
                <span className="text-[10px] font-tech-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  SYSTEM READY
                </span>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-white/[0.04]">
                  <span className="text-slate-400">{language === 'bg' ? 'Текущ баланс' : 'Active Balance'}</span>
                  <span className="font-tech-mono font-bold text-amber-400 text-sm">{credits} CR</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-white/[0.04]">
                  <span className="text-slate-400">{language === 'bg' ? 'Аудио синхронизация' : 'Audio Synthesis'}</span>
                  <span className="text-emerald-300 font-medium">Native H3 Spatial</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-white/[0.04]">
                  <span className="text-slate-400">{language === 'bg' ? 'Моушън трансфер' : 'Motion Transfer'}</span>
                  <span className="text-slate-200">Full 3D Silhouette</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-400">{language === 'bg' ? 'Шлюз за плащане' : 'Stripe Gateway'}</span>
                  <span className="font-tech-mono text-indigo-300">{isStripeConfigured ? 'Checkout Live' : 'Sandbox Ready'}</span>
                </div>
              </div>

              {/* Architectural footer badge */}
              <div className="mt-5 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-tech-mono text-slate-500">
                <span>NODE.JS REST API</span>
                <span>SECURED & PERSISTENT</span>
              </div>
            </div>
          </GsapReveal>
        </div>
      </div>
    </section>
  );
};
