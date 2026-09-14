/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  Sparkles,
  Play,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  ExternalLink,
  X,
  Film,
  ImageIcon,
  FileText,
  Volume2,
  VolumeX,
  Tv,
  Smartphone,
  Square,
  Wand2,
  Download,
  Share2,
  Sliders,
  Cpu,
  Layers,
  Check,
} from 'lucide-react';
import { MediaUploader } from './MediaUploader.tsx';
import { safeFetchJson } from '../utils/apiHelper.ts';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { GsapReveal } from './motion/GsapReveal.tsx';

interface ViggleStudioProps {
  credits: number;
  userId: string;
  onCreditChange: () => void;
}

export type GenerationMode = 'text-to-video' | 'image-to-video' | 'remix';

interface VideoRenderItem {
  id: string;
  renderId: string;
  mode?: GenerationMode;
  prompt?: string;
  quality?: 'low' | 'high';
  durationSeconds?: number;
  aspectRatio?: string;
  imageUrl?: string;
  motionVideoUrl?: string;
  status: 'processing' | 'completed' | 'failed';
  progress?: number;
  videoUrl?: string;
  errorMessage?: string;
  createdAt: string;
}

// Preset library for Character + Motion Remix (Bilingual)
const REMIX_PRESETS = [
  {
    nameBg: 'Танцуващ герой',
    nameEn: 'Dancing Character',
    imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    motionVideoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    descriptionBg: 'Портрет на човек + динамично танцувално движение',
    descriptionEn: 'Portrait photo + dynamic dancing choreography',
  },
  {
    nameBg: 'Спортен атлет',
    nameEn: 'Sports Athlete',
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
    motionVideoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    descriptionBg: 'Цял ръст снимка + спортна моушън хореография',
    descriptionEn: 'Full body photo + athletic motion choreography',
  },
];

// Presets for Text to Video (H3 Video Generation)
const TEXT_TO_VIDEO_PRESETS = [
  {
    titleBg: 'Хартиен самолет в офис',
    titleEn: 'Paper Airplane in Office',
    prompt: 'A paper airplane gliding smoothly through a sunlit modern architectural office, slow motion, cinematic 4k',
    aspectRatio: '16:9' as const,
    badgeBg: 'Офис / Кинематографично',
    badgeEn: 'Office / Cinematic',
  },
  {
    titleBg: 'Киберпънк кола в дъжд',
    titleEn: 'Cyberpunk Car in Rain',
    prompt: 'Cyberpunk sports car drifting through neon-lit futuristic city streets in heavy rain, cinematic lighting, reflections on wet pavement',
    aspectRatio: '16:9' as const,
    badgeBg: 'Sci-Fi / Неон',
    badgeEn: 'Sci-Fi / Neon',
  },
  {
    titleBg: 'Орел над алпийски върхове',
    titleEn: 'Eagle Above Alpine Peaks',
    prompt: 'Majestic golden eagle soaring gracefully above mist-covered alpine mountain peaks at sunrise, cinematic drone shot, high detail',
    aspectRatio: '16:9' as const,
    badgeBg: 'Природа / Дрон',
    badgeEn: 'Nature / Drone',
  },
  {
    titleBg: 'Тропически водопад в джунгла',
    titleEn: 'Tropical Waterfall in Jungle',
    prompt: 'Lush tropical waterfall in a dense jungle with exotic colorful birds fluttering near emerald water, soft rays of sunlight',
    aspectRatio: '9:16' as const,
    badgeBg: 'Вертикално / 9:16',
    badgeEn: 'Vertical / 9:16',
  },
];

// Presets for Image to Video (First Frame to Video)
const IMAGE_TO_VIDEO_PRESETS = [
  {
    nameBg: 'Портрет с вятър и усмивка',
    nameEn: 'Portrait with Breeze & Smile',
    imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    prompt: 'Gentle breeze blowing through hair, looking around with a warm friendly smile, cinematic soft natural daylight',
    descriptionBg: 'Портретна снимка оживява с естествено движение и поглед',
    descriptionEn: 'Portrait photo comes to life with subtle natural motion',
  },
  {
    nameBg: 'Градска сцена с движение',
    nameEn: 'City Scene Motion',
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
    prompt: 'Walking forward towards the camera with confidence, city street background with subtle bokeh movement',
    descriptionBg: 'Атлетичен персонаж прави уверени крачки напред',
    descriptionEn: 'Athletic character making confident strides forward',
  },
  {
    nameBg: 'Пейзаж с плаващи облаци',
    nameEn: 'Landscape with Floating Clouds',
    imageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80',
    prompt: 'Time-lapse of clouds drifting gracefully over majestic mountain peaks with gentle ripples on the lake water',
    descriptionBg: 'Планински пейзаж с живописни облаци и водна повърхност',
    descriptionEn: 'Mountain landscape with scenic drifting clouds timelapse',
  },
];

export const ViggleStudio: React.FC<ViggleStudioProps> = ({ credits, userId, onCreditChange }) => {
  const { t, language } = useLanguage();

  // Active Mode: 'text-to-video' | 'image-to-video' | 'remix'
  const [activeMode, setActiveMode] = useState<GenerationMode>('text-to-video');

  // Text to Video state
  const [textPrompt, setTextPrompt] = useState(TEXT_TO_VIDEO_PRESETS[0].prompt);
  const [t2vQuality, setT2vQuality] = useState<'low' | 'high'>('low');
  const [t2vDuration, setT2vDuration] = useState<number>(5);
  const [t2vAspectRatio, setT2vAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [t2vResolution, setT2vResolution] = useState<'480p' | '768p'>('480p');

  // Image to Video state
  const [i2vImageUrl, setI2vImageUrl] = useState(IMAGE_TO_VIDEO_PRESETS[0].imageUrl);
  const [i2vPrompt, setI2vPrompt] = useState(IMAGE_TO_VIDEO_PRESETS[0].prompt);
  const [i2vQuality, setI2vQuality] = useState<'low' | 'high'>('low');
  const [i2vDuration, setI2vDuration] = useState<number>(5);

  // Motion Remix state
  const [imageUrl, setImageUrl] = useState(REMIX_PRESETS[0].imageUrl);
  const [motionVideoUrl, setMotionVideoUrl] = useState(REMIX_PRESETS[0].motionVideoUrl);

  // Rendering & telemetry states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<any | null>(null);
  const [activeRenderId, setActiveRenderId] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<any | null>(null);
  const [history, setHistory] = useState<VideoRenderItem[]>([]);
  const [polling, setPolling] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Audio playback state (starts muted by default on launch so user can opt in to sound)
  const [isMuted, setIsMuted] = useState(true);
  const videoPlayerRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoPlayerRef.current) {
      videoPlayerRef.current.muted = isMuted;
    }
  }, [isMuted, activeStatus?.videoUrl]);

  const toggleAudio = () => {
    setIsMuted((prev) => {
      const next = !prev;
      if (videoPlayerRef.current) {
        videoPlayerRef.current.muted = next;
      }
      return next;
    });
  };

  // 1. Initial load from localStorage
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(`viggle_history_${userId}`);
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setHistory(parsed);
          setActiveStatus((prev: any) => prev || parsed[0]);
        }
      }

      const savedActive = localStorage.getItem(`viggle_active_render_${userId}`);
      if (savedActive) {
        const parsed = JSON.parse(savedActive);
        if (parsed && parsed.renderId && parsed.status === 'processing') {
          setActiveRenderId(parsed.renderId);
          setActiveStatus(parsed);
          setPolling(true);
        }
      }
    } catch {
      // Ignore cache parse errors
    }
  }, [userId]);

  // 2. Sync history to localStorage
  useEffect(() => {
    if (history.length > 0) {
      try {
        localStorage.setItem(`viggle_history_${userId}`, JSON.stringify(history));
      } catch {}
    }
  }, [history, userId]);

  // 3. Sync active task to localStorage
  useEffect(() => {
    if (activeStatus) {
      try {
        localStorage.setItem(`viggle_active_render_${userId}`, JSON.stringify(activeStatus));
      } catch {}
    }
  }, [activeStatus, userId]);

  // Load history from server
  const fetchHistory = async () => {
    try {
      const response = await safeFetchJson<{ videos: VideoRenderItem[] }>(`/api/videos?userId=${encodeURIComponent(userId)}`);
      if (response.ok && response.data) {
        const videos = response.data.videos || [];
        if (videos.length > 0) {
          setHistory(videos);
          setActiveStatus((prev: any) => {
            if (!prev) return videos[0];
            const found = videos.find((v) => v.renderId === prev.renderId);
            return found ? { ...prev, ...found } : prev;
          });
        }
      }
    } catch (e) {
      console.error('Error fetching videos:', e);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [userId]);

  // Polling to GET /api/video-status/:renderId
  useEffect(() => {
    if (!activeRenderId || !polling) return;

    let mounted = true;
    let pollCount = 0;

    const interval = setInterval(async () => {
      pollCount++;
      try {
        const response = await safeFetchJson<any>(`/api/video-status/${encodeURIComponent(activeRenderId)}`);
        if (!response.ok && response.status !== 304) {
          return;
        }

        const data = response.data;
        if (!data || !mounted) return;

        setActiveStatus((prev: any) => ({
          ...prev,
          ...data,
        }));

        if (data.status === 'completed' || data.status === 'failed' || Boolean(data.videoUrl)) {
          setPolling(false);
          fetchHistory();
          onCreditChange();
        }

        if (pollCount > 120) {
          setPolling(false);
        }
      } catch (err: any) {
        console.error('Status poll error:', err);
      }
    }, 2500);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [activeRenderId, polling]);

  // Handle generation submission
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorDetails(null);

    if (credits < 1) {
      setError(t.studio.notEnoughCredits);
      return;
    }

    let payload: any = { userId, mode: activeMode };

    if (activeMode === 'text-to-video') {
      if (!textPrompt.trim()) {
        setError(t.studio.textPromptRequired);
        return;
      }
      payload = {
        userId,
        mode: 'text-to-video',
        prompt: textPrompt.trim(),
        quality: t2vQuality,
        duration_s: t2vDuration,
        aspect_ratio: t2vAspectRatio,
        resolution: t2vResolution,
      };
    } else if (activeMode === 'image-to-video') {
      if (!i2vImageUrl.trim()) {
        setError(t.studio.imageRequired);
        return;
      }
      payload = {
        userId,
        mode: 'image-to-video',
        image_url: i2vImageUrl.trim(),
        prompt: i2vPrompt.trim(),
        quality: i2vQuality,
        duration_s: i2vDuration,
        resolution: '480p',
      };
    } else {
      // Remix
      if (!imageUrl.trim() || !motionVideoUrl.trim()) {
        setError(t.studio.remixRequired);
        return;
      }
      payload = {
        userId,
        mode: 'remix',
        image_url: imageUrl.trim(),
        motion_video_url: motionVideoUrl.trim(),
      };
    }

    setLoading(true);
    try {
      const response = await safeFetchJson<{ renderId: string; isSimulated?: boolean; error?: string; details?: any }>(
        '/api/generate-video',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok || !response.data?.renderId) {
        setError(response.error || (language === 'en' ? 'Error submitting video generation task.' : 'Грешка при изпращане на задачата за генериране.'));
        setErrorDetails(response.details || null);
        return;
      }

      const { renderId } = response.data;
      setActiveRenderId(renderId);
      setActiveStatus({
        renderId,
        mode: activeMode,
        prompt: activeMode === 'text-to-video' ? textPrompt : activeMode === 'image-to-video' ? i2vPrompt : 'Character Motion Remix',
        status: 'processing',
        progress: 5,
        createdAt: new Date().toISOString(),
      });
      setPolling(true);
      onCreditChange();
    } catch (err: any) {
      console.error(err);
      setError(err.message || (language === 'en' ? 'Unexpected communication failure with video engine.' : 'Неочаквана грешка при комуникация със сървъра.'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = (url: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  return (
    <div className="space-y-12">
      {/* Editorial Mode Selector (Kinetic Segmented Strip) */}
      <GsapReveal delay={0.1} y={20}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-2 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl">
          <div className="flex items-center gap-1.5 w-full sm:w-auto p-1 bg-black/40 rounded-xl border border-white/[0.06]">
            <button
              id="tab-text-to-video"
              type="button"
              onClick={() => setActiveMode('text-to-video')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-tech-mono transition-all duration-200 cursor-pointer ${
                activeMode === 'text-to-video'
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{t.studio.tabT2V}</span>
              <span className="hidden md:inline-block px-1.5 py-0.2 bg-white/20 rounded text-[9px] uppercase">Audio</span>
            </button>

            <button
              id="tab-image-to-video"
              type="button"
              onClick={() => setActiveMode('image-to-video')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-tech-mono transition-all duration-200 cursor-pointer ${
                activeMode === 'image-to-video'
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>{t.studio.tabI2V}</span>
            </button>

            <button
              id="tab-remix"
              type="button"
              onClick={() => setActiveMode('remix')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-tech-mono transition-all duration-200 cursor-pointer ${
                activeMode === 'remix'
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>{t.studio.tabRemix}</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-3 px-3 text-[11px] font-tech-mono text-slate-400">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span>H3_ENGINE_ONLINE</span>
            </span>
            <span>•</span>
            <span>COST: 1 CR / RENDER</span>
          </div>
        </div>
      </GsapReveal>

      {/* Main Asymmetrical Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Directorial Control Panel (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <form onSubmit={handleGenerate} className="space-y-6">
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-6 backdrop-blur-xl space-y-6">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-tech-mono uppercase tracking-widest text-slate-300">
                    {activeMode === 'text-to-video'
                      ? t.studio.modeT2VTitle
                      : activeMode === 'image-to-video'
                      ? t.studio.modeI2VTitle
                      : t.studio.modeRemixTitle}
                  </span>
                </div>
                <span className="text-[10px] font-tech-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  PARAM_V1
                </span>
              </div>

              {/* MODE 1: TEXT TO VIDEO */}
              {activeMode === 'text-to-video' && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{t.studio.t2vPromptLabel}</span>
                      </span>
                      <span className="text-[10px] font-tech-mono text-slate-500">
                        {textPrompt.length} {t.studio.chars}
                      </span>
                    </label>
                    <textarea
                      id="t2v-prompt-input"
                      rows={4}
                      value={textPrompt}
                      onChange={(e) => setTextPrompt(e.target.value)}
                      placeholder={t.studio.t2vPromptPlaceholder}
                      className="w-full px-3.5 py-2.5 text-xs bg-white/[0.04] border border-white/[0.1] rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-sans placeholder:text-slate-500 leading-relaxed resize-none"
                    />
                  </div>

                  {/* Preset prompt pills */}
                  <div>
                    <span className="block text-[10px] font-tech-mono uppercase tracking-wider text-slate-400 mb-2">
                      {language === 'bg' ? 'Кинематографични Шаблони:' : 'Curated Directorial Presets:'}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {TEXT_TO_VIDEO_PRESETS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setTextPrompt(preset.prompt);
                            setT2vAspectRatio(preset.aspectRatio);
                          }}
                          className="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.15] text-left transition-all cursor-pointer group"
                        >
                          <div className="text-[11px] font-medium text-slate-200 group-hover:text-indigo-300 truncate">
                            {language === 'bg' ? preset.titleBg : preset.titleEn}
                          </div>
                          <div className="text-[9px] font-tech-mono text-slate-500 mt-1">
                            {language === 'bg' ? preset.badgeBg : preset.badgeEn}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Aspect Ratio Selector */}
                  <div>
                    <label className="block text-[10px] font-tech-mono uppercase tracking-wider text-slate-400 mb-2">
                      {t.studio.aspectRatio}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { val: '16:9' as const, label: '16:9 Cinema', icon: Tv },
                        { val: '9:16' as const, label: '9:16 Reel', icon: Smartphone },
                        { val: '1:1' as const, label: '1:1 Square', icon: Square },
                      ].map((item) => {
                        const Icon = item.icon;
                        const isSelected = t2vAspectRatio === item.val;
                        return (
                          <button
                            key={item.val}
                            type="button"
                            onClick={() => setT2vAspectRatio(item.val)}
                            className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-tech-mono transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300 shadow-sm'
                                : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.04]'
                            }`}
                          >
                            <Icon className="w-4 h-4 mb-1" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Duration & Quality Strip */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[10px] font-tech-mono uppercase tracking-wider text-slate-400 mb-1.5">
                        {t.studio.duration}
                      </label>
                      <div className="flex gap-1 bg-black/40 p-1 rounded-xl border border-white/[0.06]">
                        {[5, 10].map((dur) => (
                          <button
                            key={dur}
                            type="button"
                            onClick={() => setT2vDuration(dur)}
                            className={`flex-1 py-1.5 text-xs font-tech-mono rounded-lg transition-all cursor-pointer text-center ${
                              t2vDuration === dur
                                ? 'bg-white/[0.12] text-white font-bold'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {dur}s
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-tech-mono uppercase tracking-wider text-slate-400 mb-1.5">
                        {t.studio.quality}
                      </label>
                      <div className="flex gap-1 bg-black/40 p-1 rounded-xl border border-white/[0.06]">
                        <button
                          type="button"
                          onClick={() => setT2vQuality('low')}
                          className={`flex-1 py-1.5 text-xs font-tech-mono rounded-lg transition-all cursor-pointer text-center ${
                            t2vQuality === 'low'
                              ? 'bg-white/[0.12] text-white font-bold'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          480p
                        </button>
                        <button
                          type="button"
                          onClick={() => setT2vQuality('high')}
                          className={`flex-1 py-1.5 text-xs font-tech-mono rounded-lg transition-all cursor-pointer text-center ${
                            t2vQuality === 'high'
                              ? 'bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          768p Pro
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* MODE 2: IMAGE TO VIDEO */}
              {activeMode === 'image-to-video' && (
                <div className="space-y-5">
                  <MediaUploader
                    id="i2v-image-uploader"
                    label={t.studio.i2vImageLabel}
                    accept="image"
                    value={i2vImageUrl}
                    onChange={setI2vImageUrl}
                    helperText={t.studio.i2vImageHelper}
                  />

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{t.studio.i2vPromptLabel}</span>
                      </span>
                    </label>
                    <textarea
                      id="i2v-prompt-input"
                      rows={3}
                      value={i2vPrompt}
                      onChange={(e) => setI2vPrompt(e.target.value)}
                      placeholder={t.studio.i2vPromptPlaceholder}
                      className="w-full px-3.5 py-2.5 text-xs bg-white/[0.04] border border-white/[0.1] rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-sans placeholder:text-slate-500 leading-relaxed resize-none"
                    />
                  </div>

                  {/* Preset library for I2V */}
                  <div>
                    <span className="block text-[10px] font-tech-mono uppercase tracking-wider text-slate-400 mb-2">
                      {language === 'bg' ? 'Примерни Кадри:' : 'Sample Animation Frames:'}
                    </span>
                    <div className="grid grid-cols-1 gap-2">
                      {IMAGE_TO_VIDEO_PRESETS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setI2vImageUrl(preset.imageUrl);
                            setI2vPrompt(preset.prompt);
                          }}
                          className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] text-left transition-all cursor-pointer group"
                        >
                          <img
                            src={preset.imageUrl}
                            alt="Preset"
                            className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0"
                          />
                          <div className="overflow-hidden">
                            <div className="text-[11px] font-semibold text-slate-200 group-hover:text-indigo-300 truncate">
                              {language === 'bg' ? preset.nameBg : preset.nameEn}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">
                              {language === 'bg' ? preset.descriptionBg : preset.descriptionEn}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* MODE 3: CHARACTER REMIX */}
              {activeMode === 'remix' && (
                <div className="space-y-5">
                  <MediaUploader
                    id="remix-character-uploader"
                    label={t.studio.remixCharLabel}
                    accept="image"
                    value={imageUrl}
                    onChange={setImageUrl}
                    helperText={t.studio.remixCharHelper}
                  />

                  <MediaUploader
                    id="remix-motion-uploader"
                    label={t.studio.remixMotionLabel}
                    accept="video"
                    value={motionVideoUrl}
                    onChange={setMotionVideoUrl}
                    helperText={t.studio.remixMotionHelper}
                  />

                  {/* Preset library for Remix */}
                  <div>
                    <span className="block text-[10px] font-tech-mono uppercase tracking-wider text-slate-400 mb-2">
                      {language === 'bg' ? 'Тестови хореографии:' : 'Choreography Presets:'}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {REMIX_PRESETS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setImageUrl(preset.imageUrl);
                            setMotionVideoUrl(preset.motionVideoUrl);
                          }}
                          className="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] text-left transition-all cursor-pointer group"
                        >
                          <div className="text-[11px] font-semibold text-slate-200 group-hover:text-indigo-300 truncate">
                            {language === 'bg' ? preset.nameBg : preset.nameEn}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate mt-0.5">
                            {language === 'bg' ? preset.descriptionBg : preset.descriptionEn}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Error Callout */}
              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-300 flex items-start gap-2 font-tech-mono">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span>{error}</span>
                    {errorDetails && (
                      <pre className="text-[10px] text-rose-400/80 mt-1 font-mono overflow-x-auto">
                        {JSON.stringify(errorDetails, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              {/* Primary Master Generate Trigger */}
              <button
                id="btn-submit-generate"
                type="submit"
                disabled={loading || credits < 1}
                className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-600 to-indigo-700 hover:from-indigo-600 hover:to-violet-800 text-white font-tech-mono font-bold text-sm shadow-xl shadow-indigo-500/25 border border-white/20 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>{t.studio.generatingNow}</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current transition-transform group-hover:scale-110" />
                    <span>
                      {activeMode === 'text-to-video'
                        ? t.studio.generateBtnT2V
                        : activeMode === 'image-to-video'
                        ? t.studio.generateBtnI2V
                        : t.studio.generateBtnRemix}
                    </span>
                    <span className="px-2 py-0.5 bg-black/30 rounded-md text-xs font-normal border border-white/15">
                      1 {t.common.creditsShort}
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Cinema Monitor & Live Neural Telemetry (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Cinema Monitor Frame */}
          <div className="rounded-2xl bg-[#07090e] border border-white/[0.12] overflow-hidden shadow-2xl relative">
            {/* Top architectural status strip */}
            <div className="bg-white/[0.03] px-5 py-3 border-b border-white/[0.08] flex items-center justify-between text-[11px] font-tech-mono text-slate-400">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${polling ? 'bg-amber-400 animate-pulse' : activeStatus?.status === 'completed' ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
                <span className="text-slate-200">
                  {activeStatus
                    ? `STAGE: ${activeStatus.status.toUpperCase()}`
                    : 'STAGE: IDLE'}
                </span>
                {activeStatus?.renderId && (
                  <span className="text-slate-500 hidden sm:inline">
                    // ID: {activeStatus.renderId.slice(0, 12)}...
                  </span>
                )}
              </div>

              {activeStatus?.videoUrl && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleAudio}
                    id="btn-toggle-monitor-audio"
                    className="flex items-center gap-1.5 text-xs font-tech-mono text-slate-300 hover:text-white transition-colors cursor-pointer px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08]"
                    title={isMuted ? (language === 'bg' ? 'Включи звук' : 'Enable audio') : (language === 'bg' ? 'Заглуши звук' : 'Mute audio')}
                  >
                    {isMuted ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-amber-300">{language === 'bg' ? 'Включи звук' : 'Unmute'}</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">{language === 'bg' ? 'Звук активен' : 'Audio on'}</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleCopyLink(activeStatus.videoUrl)}
                    className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs font-tech-mono px-2 py-1"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>{copiedUrl ? (language === 'bg' ? 'Копиран!' : 'Copied!') : (language === 'bg' ? 'Копирай линк' : 'Copy Link')}</span>
                  </button>
                  <a
                    href={activeStatus.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors text-xs font-tech-mono px-2 py-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t.common.download}</span>
                  </a>
                </div>
              )}
            </div>

            {/* Video Viewport Stage */}
            <div className="aspect-video w-full bg-black/80 flex items-center justify-center relative overflow-hidden group">
              {/* Active Video Rendering State */}
              {polling || (activeStatus && activeStatus.status === 'processing') ? (
                <div className="flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-md">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 animate-pulse">
                      <Film className="w-8 h-8 animate-spin" />
                    </div>
                    <div className="absolute -inset-2 bg-indigo-500/20 rounded-2xl blur-lg animate-pulse"></div>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white font-sans tracking-wide">
                      {t.studio.generatingNow}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 font-tech-mono">
                      {activeStatus?.prompt || (language === 'bg' ? 'Синтезиране на кадри с нативно аудио...' : 'Synthesizing neural frame sequences with native H3 audio...')}
                    </p>
                  </div>

                  {/* Luminous Progress Bar */}
                  <div className="w-full bg-white/[0.08] rounded-full h-2 overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 via-emerald-400 to-amber-400 rounded-full transition-all duration-500"
                      style={{ width: `${activeStatus?.progress || 35}%` }}
                    ></div>
                  </div>

                  <div className="flex items-center justify-between w-full text-[11px] font-tech-mono text-slate-400 pt-1">
                    <span>{language === 'bg' ? 'Очаквано време: ~30-60 сек' : 'ETA: ~30-60s'}</span>
                    <span className="text-emerald-400 font-bold">{activeStatus?.progress || 35}%</span>
                  </div>
                </div>
              ) : activeStatus?.videoUrl ? (
                /* Native Video Player with Muted Autoplay on Launch */
                <>
                  <video
                    ref={videoPlayerRef}
                    id="active-video-player"
                    src={activeStatus.videoUrl}
                    controls
                    autoPlay
                    muted={isMuted}
                    loop
                    playsInline
                    onVolumeChange={(e) => {
                      setIsMuted(e.currentTarget.muted);
                    }}
                    className="w-full h-full object-contain"
                  />

                  {/* Floating Click-to-Enable-Audio Overlay Badge */}
                  {isMuted && (
                    <button
                      onClick={toggleAudio}
                      id="btn-video-unmute-floating"
                      className="absolute top-4 left-4 z-20 px-3 py-2 rounded-xl bg-black/80 hover:bg-black/95 backdrop-blur-md border border-amber-500/40 text-white text-xs font-tech-mono flex items-center gap-2.5 shadow-2xl shadow-black/80 transition-all cursor-pointer group/audio hover:scale-105"
                      title={language === 'bg' ? 'Кликнете за включване на звука' : 'Click to enable audio'}
                    >
                      <div className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 group-hover/audio:bg-amber-500/30 transition-colors">
                        <VolumeX className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                      </div>
                      <div className="text-left">
                        <span className="font-semibold text-amber-300 block leading-tight text-[11px]">
                          {language === 'bg' ? 'Включи звука' : 'Click to enable audio'}
                        </span>
                        <span className="text-[10px] text-slate-400 block leading-tight font-sans">
                          {language === 'bg' ? 'Стартирано без звук' : 'Playing without sound'}
                        </span>
                      </div>
                    </button>
                  )}
                </>
              ) : (
                /* Idle Stage Visualizer */
                <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 text-slate-500">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-slate-400">
                    <Video className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-tech-mono uppercase tracking-wider text-slate-400">
                      {language === 'bg' ? 'Мониторът е в готовност' : 'Cinema Monitor Ready'}
                    </p>
                    <p className="text-[11px] text-slate-600 mt-1 max-w-xs font-sans">
                      {language === 'bg'
                        ? 'Изберете режим и стартирайте генериране или кликнете на видео от галерията по-долу.'
                        : 'Select a directorial mode on the left or click any generation in your production ledger below.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Prompt details ribbon */}
            {activeStatus?.prompt && (
              <div className="bg-white/[0.02] px-5 py-3 border-t border-white/[0.06] text-xs text-slate-300 font-sans flex items-start gap-2">
                <span className="font-tech-mono text-[10px] text-indigo-400 uppercase tracking-wider shrink-0 mt-0.5">
                  PROMPT:
                </span>
                <span className="text-slate-300 line-clamp-2">{activeStatus.prompt}</span>
              </div>
            )}
          </div>

          {/* Production Gallery & Video History */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-tech-mono uppercase tracking-widest text-slate-300 flex items-center gap-2">
                <Film className="w-4 h-4 text-indigo-400" />
                <span>{t.studio.historyTitle}</span>
                <span className="text-slate-500">({history.length})</span>
              </h3>

              <button
                onClick={fetchHistory}
                className="text-xs font-tech-mono text-slate-400 hover:text-white flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>{t.common.refresh}</span>
              </button>
            </div>

            {history.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                {history.map((item) => {
                  const isCurrent = activeStatus?.renderId === item.renderId;
                  return (
                    <div
                      key={item.renderId || item.id}
                      onClick={() => setActiveStatus(item)}
                      className={`group rounded-xl overflow-hidden bg-white/[0.02] border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                        isCurrent
                          ? 'border-indigo-500/70 ring-2 ring-indigo-500/20 shadow-lg shadow-indigo-500/10'
                          : 'border-white/[0.08] hover:border-white/[0.2] hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="aspect-video bg-black/60 relative overflow-hidden flex items-center justify-center">
                        {item.videoUrl ? (
                          <video
                            src={item.videoUrl}
                            muted
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt="Frame"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-slate-400">
                            <Video className="w-4 h-4" />
                          </div>
                        )}

                        {/* Status Badge */}
                        <div className="absolute top-2 right-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-tech-mono uppercase font-bold tracking-wider ${
                              item.status === 'completed'
                                ? 'bg-emerald-500/80 text-white'
                                : item.status === 'failed'
                                ? 'bg-rose-500/80 text-white'
                                : 'bg-amber-500/80 text-white animate-pulse'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>

                        {/* Hover Play Overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-white/90 text-slate-950 flex items-center justify-center shadow-md">
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          </div>
                        </div>
                      </div>

                      <div className="p-2.5 space-y-1">
                        <p className="text-[11px] font-medium text-slate-200 line-clamp-1">
                          {item.prompt || (language === 'bg' ? 'Генерирано видео' : 'Synthesized Video')}
                        </p>
                        <div className="flex items-center justify-between text-[9px] font-tech-mono text-slate-500">
                          <span>{item.mode || 'AI_VIDEO'}</span>
                          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-white/[0.01] border border-dashed border-white/[0.08] text-center text-xs font-tech-mono text-slate-500">
                {t.studio.emptyHistory}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
