import React, { useState, useEffect } from 'react';
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
  Tv,
  Smartphone,
  Square,
  Wand2,
} from 'lucide-react';
import { MediaUploader } from './MediaUploader.tsx';
import { safeFetchJson } from '../utils/apiHelper.ts';

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

// Примерни шаблони за Character + Motion Remix
const REMIX_PRESETS = [
  {
    name: 'Танцуващ герой',
    imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    motionVideoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    description: 'Портрет на човек + динамично танцувално движение',
  },
  {
    name: 'Спортен атлет',
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
    motionVideoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    description: 'Цял ръст снимка + спортна моушън хореография',
  },
];

// Примерни промптове за Text to Video (H3 Video Generation)
const TEXT_TO_VIDEO_PRESETS = [
  {
    title: 'Хартиен самолет в офис',
    prompt: 'A paper airplane gliding smoothly through a sunlit modern architectural office, slow motion, cinematic 4k',
    aspectRatio: '16:9',
    badge: 'Офис / Кинематографично',
  },
  {
    title: 'Киберпънк кола в дъжд',
    prompt: 'Cyberpunk sports car drifting through neon-lit futuristic city streets in heavy rain, cinematic lighting, reflections on wet pavement',
    aspectRatio: '16:9',
    badge: 'Sci-Fi / Неон',
  },
  {
    title: 'Орел над алпийски върхове',
    prompt: 'Majestic golden eagle soaring gracefully above mist-covered alpine mountain peaks at sunrise, cinematic drone shot, high detail',
    aspectRatio: '16:9',
    badge: 'Природа / Дрон',
  },
  {
    title: 'Тропически водопад в джунгла',
    prompt: 'Lush tropical waterfall in a dense jungle with exotic colorful birds fluttering near emerald water, soft rays of sunlight',
    aspectRatio: '9:16',
    badge: 'Вертикално / 9:16',
  },
];

// Примерни шаблони за Image to Video (First Frame to Video)
const IMAGE_TO_VIDEO_PRESETS = [
  {
    name: 'Портрет с вятър и усмивка',
    imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    prompt: 'Gentle breeze blowing through hair, looking around with a warm friendly smile, cinematic soft natural daylight',
    description: 'Портретна снимка оживява с естествено движение и поглед',
  },
  {
    name: 'Градска сцена с движение',
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
    prompt: 'Walking forward towards the camera with confidence, city street background with subtle bokeh movement',
    description: 'Атлетичен персонаж прави уверени крачки напред',
  },
  {
    name: 'Пейзаж с плаващи облаци',
    imageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80',
    prompt: 'Time-lapse of clouds drifting gracefully over majestic mountain peaks with gentle ripples on the lake water',
    description: 'Планински пейзаж с живописни облаци и водна повърхност',
  },
];

export const ViggleStudio: React.FC<ViggleStudioProps> = ({ credits, userId, onCreditChange }) => {
  // Активен режим: 1. Text to Video, 2. Image to Video, 3. Motion Remix
  const [activeMode, setActiveMode] = useState<GenerationMode>('text-to-video');

  // Text to Video състояния
  const [textPrompt, setTextPrompt] = useState(TEXT_TO_VIDEO_PRESETS[0].prompt);
  const [t2vQuality, setT2vQuality] = useState<'low' | 'high'>('low');
  const [t2vDuration, setT2vDuration] = useState<number>(5);
  const [t2vAspectRatio, setT2vAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');

  // Image to Video състояния
  const [i2vImageUrl, setI2vImageUrl] = useState(IMAGE_TO_VIDEO_PRESETS[0].imageUrl);
  const [i2vPrompt, setI2vPrompt] = useState(IMAGE_TO_VIDEO_PRESETS[0].prompt);
  const [i2vQuality, setI2vQuality] = useState<'low' | 'high'>('low');
  const [i2vDuration, setI2vDuration] = useState<number>(5);

  // Motion Remix състояния
  const [imageUrl, setImageUrl] = useState(REMIX_PRESETS[0].imageUrl);
  const [motionVideoUrl, setMotionVideoUrl] = useState(REMIX_PRESETS[0].motionVideoUrl);

  // Общи състояния за рендериране
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<any | null>(null);
  const [activeRenderId, setActiveRenderId] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<any | null>(null);
  const [history, setHistory] = useState<VideoRenderItem[]>([]);
  const [polling, setPolling] = useState(false);

  // Зареждане на историята от сървъра
  const fetchHistory = async () => {
    try {
      const response = await safeFetchJson<{ videos: VideoRenderItem[] }>(`/api/videos?userId=${encodeURIComponent(userId)}`);
      if (response.ok && response.data) {
        const videos = response.data.videos || [];
        setHistory(videos);
        if (!activeStatus && videos.length > 0) {
          setActiveStatus(videos[0]);
        }
      }
    } catch (e) {
      console.error('Грешка при зареждане на видеа:', e);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [userId]);

  // Периодично запитване (Polling) към GET /api/video-status/:renderId
  useEffect(() => {
    if (!activeRenderId || !polling) return;

    let mounted = true;
    let pollCount = 0;

    const interval = setInterval(async () => {
      pollCount++;
      try {
        const response = await safeFetchJson<any>(`/api/video-status/${encodeURIComponent(activeRenderId)}`);
        if (!response.ok || !response.data) {
          return;
        }
        const data = response.data;
        if (!mounted) return;

        setActiveStatus((prev: any) => ({
          ...prev,
          ...data,
        }));

        // Ако статусът е готов или има наличен videoUrl, спираме polling
        if (data.status === 'completed' || data.status === 'failed' || Boolean(data.videoUrl)) {
          setPolling(false);
          fetchHistory();
          onCreditChange();
        }

        // Защита от безкраен polling (максимум 120 опита ~ 5 минути)
        if (pollCount > 120) {
          setPolling(false);
        }
      } catch (err: any) {
        console.error('Грешка при проверка на статус:', err);
      }
    }, 2500);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [activeRenderId, polling]);

  // Изпращане на заявка според избрания режим
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorDetails(null);

    if (credits < 1) {
      setError('Нямате достатъчно кредити (нужен е поне 1 кредит). Моля купете пакет от секцията "Stripe Кредити".');
      return;
    }

    let payload: any = { userId, mode: activeMode };

    if (activeMode === 'text-to-video') {
      if (!textPrompt.trim()) {
        setError('Моля, въведете текст (prompt) за генериране на видеото.');
        return;
      }
      payload = {
        userId,
        mode: 'text-to-video',
        prompt: textPrompt.trim(),
        quality: t2vQuality,
        duration_s: t2vDuration,
        aspect_ratio: t2vAspectRatio,
      };
    } else if (activeMode === 'image-to-video') {
      if (!i2vImageUrl.trim()) {
        setError('Моля, изберете или качете изображение за начален кадър (First Frame).');
        return;
      }
      payload = {
        userId,
        mode: 'image-to-video',
        image_url: i2vImageUrl.trim(),
        prompt: i2vPrompt.trim(),
        quality: i2vQuality,
        duration_s: i2vDuration,
      };
    } else {
      // Remix
      if (!imageUrl.trim() || !motionVideoUrl.trim()) {
        setError('Моля, попълнете и двете полета: image_url и motion_video_url.');
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
        setError(response.error || 'Грешка при изпращане на задачата за генериране.');
        setErrorDetails(response.details || null);
        return;
      }

      const data = response.data;

      // Успешно получен renderId
      setActiveRenderId(data.renderId);
      setActiveStatus({
        renderId: data.renderId,
        mode: activeMode,
        status: 'processing',
        progress: 15,
        isSimulated: data.isSimulated,
        prompt: activeMode === 'text-to-video' ? textPrompt : activeMode === 'image-to-video' ? i2vPrompt : undefined,
        imageUrl: activeMode === 'image-to-video' ? i2vImageUrl : activeMode === 'remix' ? imageUrl : undefined,
        motionVideoUrl: activeMode === 'remix' ? motionVideoUrl : undefined,
      });
      setPolling(true);
      onCreditChange();
      fetchHistory();
    } catch (err: any) {
      setError(typeof err.message === 'string' ? err.message : 'Възникна непредвидена грешка.');
      setErrorDetails(err.details || null);
    } finally {
      setLoading(false);
    }
  };

  const handleManualCheckStatus = async (renderId: string) => {
    setActiveRenderId(renderId);
    try {
      const response = await safeFetchJson<any>(`/api/video-status/${encodeURIComponent(renderId)}`);
      if (response.ok && response.data) {
        const data = response.data;
        setActiveStatus((prev: any) => ({
          ...prev,
          ...data,
        }));
        if (data.status === 'completed' || data.status === 'failed' || Boolean(data.videoUrl)) {
          setPolling(false);
          fetchHistory();
          onCreditChange();
        } else {
          setPolling(true);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Intro Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/40 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                AI Video Suite
              </span>
              <span className="text-xs text-slate-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30 font-medium">
                ✨ Включва Text to Video, Image to Video & Remix
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Студио за AI Видео Генерация
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl mt-1">
              Генерирайте видео от <strong>текстов промпт с нативно аудио</strong>, анимирайте статично <strong>изображение</strong> или трансферирайте <strong>моушън хореография</strong> върху персонаж.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-slate-800/80 px-4 py-3 rounded-xl border border-slate-700 shrink-0">
            <div className="text-right">
              <div className="text-xs text-slate-400">Такса на видео</div>
              <div className="text-lg font-bold text-amber-400">1 Кредит</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Mode Selector Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Tab 1: Text to Video */}
          <button
            type="button"
            id="tab-text-to-video"
            onClick={() => setActiveMode('text-to-video')}
            className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeMode === 'text-to-video'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>1. Text to Video</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
              activeMode === 'text-to-video' ? 'bg-indigo-500 text-white' : 'bg-indigo-100 text-indigo-700'
            }`}>
              H3 Audio
            </span>
          </button>

          {/* Tab 2: Image to Video */}
          <button
            type="button"
            id="tab-image-to-video"
            onClick={() => setActiveMode('image-to-video')}
            className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeMode === 'image-to-video'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>2. Image to Video</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
              activeMode === 'image-to-video' ? 'bg-indigo-500 text-white' : 'bg-sky-100 text-sky-700'
            }`}>
              First Frame
            </span>
          </button>

          {/* Tab 3: Motion Remix */}
          <button
            type="button"
            id="tab-remix"
            onClick={() => setActiveMode('remix')}
            className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeMode === 'remix'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>3. Character Remix</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
              activeMode === 'remix' ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              Motion Dance
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Generator Form & Mode Details */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            {/* Header info per mode */}
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                {activeMode === 'text-to-video' && <FileText className="w-5 h-5 text-indigo-600" />}
                {activeMode === 'image-to-video' && <ImageIcon className="w-5 h-5 text-indigo-600" />}
                {activeMode === 'remix' && <Video className="w-5 h-5 text-indigo-600" />}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {activeMode === 'text-to-video' && 'Генериране на видео от текст (Text-to-Video)'}
                    {activeMode === 'image-to-video' && 'Анимиране на изображение (Image-to-Video)'}
                    {activeMode === 'remix' && 'Персонаж + Видео хореография (Motion Remix)'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {activeMode === 'text-to-video' && 'H3 Video Generation модел с автоматично синхронизирано нативно аудио'}
                    {activeMode === 'image-to-video' && 'Задайте начална снимка (First Frame) и опишете желаната кинематографична анимация'}
                    {activeMode === 'remix' && 'Трансферирайте танц или движение от видео файл върху персонаж от снимка'}
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-medium text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 hidden sm:inline-block">
                POST /v1/videos
              </span>
            </div>

            <form onSubmit={handleGenerate} className="space-y-6">
              {/* ======================================================================= */}
              {/* MODE 1: TEXT TO VIDEO */}
              {/* ======================================================================= */}
              {activeMode === 'text-to-video' && (
                <div className="space-y-5">
                  {/* Native Audio Badge */}
                  <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200/80 rounded-xl flex items-center gap-2.5 text-xs text-purple-900">
                    <Volume2 className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>
                      <strong>Нативно аудио включено:</strong> Всеки видео клип, генериран от текст, се създава с оригинален звуков фон според сцената.
                    </span>
                  </div>

                  {/* Preset prompt pills */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Wand2 className="w-3.5 h-3.5 text-indigo-600" />
                        Примерни промптове с 1 клик:
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {TEXT_TO_VIDEO_PRESETS.map((preset, idx) => {
                        const isSelected = textPrompt === preset.prompt;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setTextPrompt(preset.prompt);
                              setT2vAspectRatio(preset.aspectRatio as any);
                            }}
                            className={`text-left p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                              isSelected
                                ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-300 font-medium'
                                : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between font-semibold text-slate-800">
                              <span>{preset.title}</span>
                              <span className="text-[10px] text-indigo-600 font-mono">{preset.badge}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 truncate mt-1">{preset.prompt}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Prompt Textarea */}
                  <div>
                    <label htmlFor="t2v-prompt-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Описание на сцената (Prompt) *
                    </label>
                    <textarea
                      id="t2v-prompt-input"
                      rows={3}
                      value={textPrompt}
                      onChange={(e) => setTextPrompt(e.target.value)}
                      placeholder="Опишете сцената в детайли (напр. 'A golden retriever catching a frisbee on a sunny beach, slow motion, 4k cinematic')..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-slate-800 placeholder:text-slate-400 bg-white"
                      required
                    />
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                      <span>Препоръчва се описателен английски език за най-високо качество</span>
                      <span>{textPrompt.length} знака</span>
                    </div>
                  </div>

                  {/* Controls: Quality, Duration, Aspect Ratio */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    {/* Quality Choice */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                        Качество (Quality)
                      </label>
                      <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setT2vQuality('low')}
                          className={`py-1 px-2 rounded text-xs font-semibold text-center cursor-pointer transition-all ${
                            t2vQuality === 'low'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Low (Бързо)
                        </button>
                        <button
                          type="button"
                          onClick={() => setT2vQuality('high')}
                          className={`py-1 px-2 rounded text-xs font-semibold text-center cursor-pointer transition-all ${
                            t2vQuality === 'high'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          High (Детайлно)
                        </button>
                      </div>
                    </div>

                    {/* Duration Choice */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                        Продължителност
                      </label>
                      <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setT2vDuration(5)}
                          className={`py-1 px-2 rounded text-xs font-semibold text-center cursor-pointer transition-all ${
                            t2vDuration === 5
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          5 сек (стандарт)
                        </button>
                        <button
                          type="button"
                          onClick={() => setT2vDuration(10)}
                          className={`py-1 px-2 rounded text-xs font-semibold text-center cursor-pointer transition-all ${
                            t2vDuration === 10
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          10 сек
                        </button>
                      </div>
                    </div>

                    {/* Aspect Ratio */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                        Формат (Aspect Ratio)
                      </label>
                      <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setT2vAspectRatio('16:9')}
                          title="16:9 Широкоекранен"
                          className={`py-1 px-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                            t2vAspectRatio === '16:9'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Tv className="w-3 h-3" />
                          <span>16:9</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setT2vAspectRatio('9:16')}
                          title="9:16 Вертикален (TikTok/Reels)"
                          className={`py-1 px-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                            t2vAspectRatio === '9:16'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Smartphone className="w-3 h-3" />
                          <span>9:16</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setT2vAspectRatio('1:1')}
                          title="1:1 Квадратен"
                          className={`py-1 px-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                            t2vAspectRatio === '1:1'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Square className="w-3 h-3" />
                          <span>1:1</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================================= */}
              {/* MODE 2: IMAGE TO VIDEO */}
              {/* ======================================================================= */}
              {activeMode === 'image-to-video' && (
                <div className="space-y-5">
                  {/* Preset Buttons for Image to Video */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Wand2 className="w-3.5 h-3.5 text-indigo-600" />
                        Примерни изображения и движения:
                      </label>
                      {i2vImageUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setI2vImageUrl('');
                            setI2vPrompt('');
                          }}
                          className="text-xs text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3 h-3" /> Изчисти
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {IMAGE_TO_VIDEO_PRESETS.map((preset, idx) => {
                        const isSelected = i2vImageUrl === preset.imageUrl;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setI2vImageUrl(preset.imageUrl);
                              setI2vPrompt(preset.prompt);
                            }}
                            className={`text-left p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                              isSelected
                                ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-300 font-medium'
                                : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="font-semibold text-slate-800 truncate">{preset.name}</div>
                            <div className="text-[10px] text-slate-500 mt-1 line-clamp-2">{preset.description}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Initial Frame Image Uploader */}
                  <MediaUploader
                    id="i2v-image-uploader"
                    label="1. Начално изображение (First Frame / Снимка)"
                    accept="image"
                    value={i2vImageUrl}
                    onChange={(url) => setI2vImageUrl(url)}
                    helperText="Снимката ще бъде първият кадър от видеото. Можете да качите файл от компютъра си (drag & drop) или да въведете URL."
                    placeholder="https://example.com/photo.jpg"
                  />

                  {/* Motion Prompt */}
                  <div>
                    <label htmlFor="i2v-prompt-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      2. Описание на движението (Motion Prompt)
                    </label>
                    <textarea
                      id="i2v-prompt-input"
                      rows={2}
                      value={i2vPrompt}
                      onChange={(e) => setI2vPrompt(e.target.value)}
                      placeholder="Опишете как се движи персонажът или камерата (напр. 'walking forward smiling into the camera, cinematic lighting, slow zoom')..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-slate-800 placeholder:text-slate-400 bg-white"
                    />
                  </div>

                  {/* Controls: Quality & Duration */}
                  <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                        Качество
                      </label>
                      <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setI2vQuality('low')}
                          className={`py-1 px-2 rounded text-xs font-semibold text-center cursor-pointer ${
                            i2vQuality === 'low' ? 'bg-indigo-600 text-white' : 'text-slate-600'
                          }`}
                        >
                          Low (Бързо)
                        </button>
                        <button
                          type="button"
                          onClick={() => setI2vQuality('high')}
                          className={`py-1 px-2 rounded text-xs font-semibold text-center cursor-pointer ${
                            i2vQuality === 'high' ? 'bg-indigo-600 text-white' : 'text-slate-600'
                          }`}
                        >
                          High
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                        Продължителност
                      </label>
                      <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setI2vDuration(5)}
                          className={`py-1 px-2 rounded text-xs font-semibold text-center cursor-pointer ${
                            i2vDuration === 5 ? 'bg-indigo-600 text-white' : 'text-slate-600'
                          }`}
                        >
                          5 сек
                        </button>
                        <button
                          type="button"
                          onClick={() => setI2vDuration(10)}
                          className={`py-1 px-2 rounded text-xs font-semibold text-center cursor-pointer ${
                            i2vDuration === 10 ? 'bg-indigo-600 text-white' : 'text-slate-600'
                          }`}
                        >
                          10 сек
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================================= */}
              {/* MODE 3: CHARACTER & MOTION REMIX */}
              {/* ======================================================================= */}
              {activeMode === 'remix' && (
                <div className="space-y-5">
                  {/* Presets and Clear */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">
                        Примерни демо шаблони:
                      </label>
                      {(imageUrl || motionVideoUrl) && (
                        <button
                          type="button"
                          onClick={() => {
                            setImageUrl('');
                            setMotionVideoUrl('');
                          }}
                          className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1 hover:underline cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                          Изчисти избора (Качи свои файлове)
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {REMIX_PRESETS.map((preset, idx) => {
                        const isSelected = imageUrl === preset.imageUrl && motionVideoUrl === preset.motionVideoUrl;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setImageUrl(preset.imageUrl);
                              setMotionVideoUrl(preset.motionVideoUrl);
                            }}
                            className={`text-left p-3 rounded-xl border transition-all group cursor-pointer ${
                              isSelected
                                ? 'border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-200'
                                : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50'
                            }`}
                          >
                            <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 flex items-center justify-between">
                              <span>{preset.name}</span>
                              {isSelected ? (
                                <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-semibold">Избран</span>
                              ) : (
                                <Play className="w-3 h-3 text-slate-400 group-hover:text-indigo-600" />
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1 leading-snug">{preset.description}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Image Uploader & Preview */}
                  <MediaUploader
                    id="image-url-input"
                    label="1. Изображение на персонаж (image_url или файл)"
                    accept="image"
                    value={imageUrl}
                    onChange={(url) => setImageUrl(url)}
                    helperText="Снимка на човек или характер с ясна фигура (JPEG, PNG или WebP)."
                    placeholder="https://example.com/character.jpg"
                  />

                  {/* Motion Video Uploader & Preview */}
                  <MediaUploader
                    id="motion-url-input"
                    label="2. Моушън видео за движение (motion_video_url или файл)"
                    accept="video"
                    value={motionVideoUrl}
                    onChange={(url) => setMotionVideoUrl(url)}
                    helperText="Видеото с движението/танца, което героят ще повтори (MP4, MOV, WEBM)."
                    placeholder="https://example.com/motion-dance.mp4"
                  />

                  {/* Selected Sources Verification Box */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>Потвърждение на източниците:</span>
                      <span className="text-[11px] text-slate-400 font-normal">Проверете файловете преди старт</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-white rounded-lg border border-slate-200 flex items-center gap-2 overflow-hidden">
                        {imageUrl ? (
                          <>
                            <img src={imageUrl} alt="Герой" className="w-8 h-8 rounded object-cover shrink-0 bg-slate-100" />
                            <div className="truncate">
                              <div className="text-[10px] font-bold text-slate-700 truncate">
                                {imageUrl.includes('/uploads/') ? '✅ Качен файл' : '🌐 Интернет URL'}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono truncate" title={imageUrl}>
                                {imageUrl.split('/').pop()}
                              </div>
                            </div>
                          </>
                        ) : (
                          <span className="text-rose-500 text-[11px] italic">Липсва изображение</span>
                        )}
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-slate-200 flex items-center gap-2 overflow-hidden">
                        {motionVideoUrl ? (
                          <>
                            <div className="w-8 h-8 rounded bg-slate-900 flex items-center justify-center text-white shrink-0">
                              <Film className="w-4 h-4" />
                            </div>
                            <div className="truncate">
                              <div className="text-[10px] font-bold text-slate-700 truncate">
                                {motionVideoUrl.includes('/uploads/') ? '✅ Качено видео' : '🌐 Интернет URL'}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono truncate" title={motionVideoUrl}>
                                {motionVideoUrl.split('/').pop()}
                              </div>
                            </div>
                          </>
                        ) : (
                          <span className="text-rose-500 text-[11px] italic">Липсва видео</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-2">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-semibold">Грешка: </span>
                      <span>{error}</span>
                    </div>
                  </div>

                  {errorDetails && (
                    <div className="pt-2 border-t border-rose-200/80">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700 mb-1">
                        Детайли от сървъра (JSON):
                      </div>
                      <pre className="p-2 bg-white/90 rounded-lg border border-rose-200 text-[11px] font-mono text-rose-950 overflow-x-auto whitespace-pre-wrap max-h-36">
                        {typeof errorDetails === 'string'
                          ? errorDetails
                          : JSON.stringify(errorDetails, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  id="btn-generate-video"
                  type="submit"
                  disabled={loading || credits < 1}
                  className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold shadow-md transition-all cursor-pointer ${
                    credits < 1
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20 active:scale-[0.99]'
                  }`}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Изпращане към AI Video API...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {activeMode === 'text-to-video' && 'Генерирай Видео от Текст (1 кредит)'}
                      {activeMode === 'image-to-video' && 'Анимирай Изображението (1 кредит)'}
                      {activeMode === 'remix' && 'Генерирай Motion Remix (1 кредит)'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Live Status Tracker & Active Video */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                Активен статус на рендера
              </h3>
              <div className="flex items-center gap-2">
                {activeRenderId && (
                  <button
                    onClick={() => handleManualCheckStatus(activeRenderId)}
                    title="Обнови статуса"
                    className="flex items-center gap-1 text-xs text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors font-medium"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Провери</span>
                  </button>
                )}
                {polling && (
                  <span className="flex items-center gap-1.5 text-xs text-indigo-600 font-medium animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Генериране...
                  </span>
                )}
              </div>
            </div>

            {activeStatus ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">ID на задачата:</span>
                    <span className="text-xs font-mono font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {activeStatus.renderId}
                    </span>
                  </div>

                  {/* Generation Mode Badge */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Режим:</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                      {activeStatus.mode === 'text-to-video' || (activeStatus.renderId?.startsWith('vid_') && !activeStatus.imageUrl)
                        ? 'Text to Video'
                        : activeStatus.mode === 'image-to-video' || (activeStatus.renderId?.startsWith('vid_') && activeStatus.imageUrl)
                        ? 'Image to Video'
                        : 'Character Motion Remix'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Статус:</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                        activeStatus.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : activeStatus.status === 'failed'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                    >
                      {activeStatus.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {activeStatus.status === 'failed' && <AlertCircle className="w-3.5 h-3.5" />}
                      {activeStatus.status === 'processing' && <RefreshCw className="w-3 h-3 animate-spin" />}
                      {activeStatus.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1 font-medium">
                      <span>Напредък:</span>
                      <span>{activeStatus.progress ?? (activeStatus.status === 'completed' ? 100 : 50)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          activeStatus.status === 'completed' ? 'bg-emerald-500' : 'bg-indigo-600'
                        }`}
                        style={{
                          width: `${activeStatus.progress ?? (activeStatus.status === 'completed' ? 100 : 50)}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Prompt Preview if available */}
                  {activeStatus.prompt && (
                    <div className="pt-2 border-t border-slate-200">
                      <div className="text-[11px] font-semibold text-slate-600 mb-1">Текстов промпт:</div>
                      <div className="text-xs text-slate-700 bg-white p-2 rounded-lg border border-slate-200 font-mono">
                        "{activeStatus.prompt}"
                      </div>
                    </div>
                  )}

                  {/* Input Source Thumbnails for Active Status */}
                  {(activeStatus.imageUrl || activeStatus.motionVideoUrl) && (
                    <div className="pt-2 border-t border-slate-200">
                      <div className="text-[11px] font-semibold text-slate-600 mb-1.5">Входни източници:</div>
                      <div className="flex items-center gap-2">
                        {activeStatus.imageUrl && (
                          <div className="flex items-center gap-1.5 p-1.5 bg-white rounded-lg border border-slate-200 text-[10px] text-slate-700">
                            <img src={activeStatus.imageUrl} alt="" className="w-7 h-7 rounded object-cover" />
                            <span className="truncate max-w-[90px]">
                              {activeStatus.mode === 'image-to-video' ? 'Начален кадър' : 'Персонаж'}
                            </span>
                          </div>
                        )}
                        {activeStatus.motionVideoUrl && (
                          <div className="flex items-center gap-1.5 p-1.5 bg-white rounded-lg border border-slate-200 text-[10px] text-slate-700">
                            <div className="w-7 h-7 rounded bg-slate-900 flex items-center justify-center text-white shrink-0">
                              <Film className="w-3.5 h-3.5" />
                            </div>
                            <span className="truncate max-w-[90px]">Моушън видео</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeStatus.isSimulated && (
                    <div className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                      ℹ️ Изпълнява се в симулиран демо режим (задайте API ключ в настройките за реална продукция).
                    </div>
                  )}
                </div>

                {/* Video Result Box */}
                {(activeStatus.status === 'completed' || Boolean(activeStatus.videoUrl)) && activeStatus.videoUrl && (
                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Готово видео с нативно аудио:
                      </span>
                      <a
                        href={activeStatus.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"
                      >
                        Отвори видео <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="rounded-xl overflow-hidden border border-slate-200 bg-black aspect-video flex items-center justify-center shadow-inner">
                      <video
                        src={activeStatus.videoUrl}
                        controls
                        autoPlay
                        loop
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10 px-4 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                <Video className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-medium text-slate-600">Няма активно генериране</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Изберете режим вляво (Text to Video, Image to Video или Remix) и кликнете бутона, за да стартирате.
                </p>
              </div>
            )}
          </div>

          {/* History List */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-800">Предишни генерирания</h4>
              <button
                onClick={fetchHistory}
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Опресни
              </button>
            </div>

            {history.length > 0 ? (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {history.map((item) => (
                  <div
                    key={item.renderId}
                    onClick={() => setActiveStatus(item)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs ${
                      activeStatus?.renderId === item.renderId
                        ? 'border-indigo-500 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-200'
                        : 'border-slate-100 bg-slate-50/70 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="w-9 h-9 rounded-lg object-cover bg-slate-200 border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0 text-indigo-600">
                          <FileText className="w-4 h-4" />
                        </div>
                      )}
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-semibold text-slate-800 truncate max-w-[110px]">
                            {item.renderId}
                          </span>
                          <span className="text-[9px] font-semibold uppercase px-1 py-0.2 rounded bg-slate-200 text-slate-700">
                            {item.mode === 'text-to-video' || (item.renderId?.startsWith('vid_') && !item.imageUrl)
                              ? 'Text'
                              : item.mode === 'image-to-video'
                              ? 'Image'
                              : 'Remix'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[160px]">
                          {item.prompt ? `"${item.prompt}"` : new Date(item.createdAt).toLocaleTimeString('bg-BG')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : item.status === 'failed'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {item.status}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleManualCheckStatus(item.renderId);
                        }}
                        className="p-1 text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer"
                        title="Провери статус"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-3 text-center">Все още нямате записани видеа в историята.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
