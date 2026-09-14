import React, { useState } from 'react';
import { Code2, Copy, Check, Terminal, Send, ArrowRight, ExternalLink } from 'lucide-react';

export const ApiDocs: React.FC = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const curlGenerate = `curl -X POST http://localhost:3000/api/generate-video \\
  -H "Content-Type: application/json" \\
  -d '{
    "userId": "usr_demo_123",
    "mode": "remix",
    "image_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
    "motion_video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
  }'`;

  const curlTextToVideo = `curl -X POST http://localhost:3000/api/text-to-video \\
  -H "Content-Type: application/json" \\
  -d '{
    "userId": "usr_demo_123",
    "prompt": "A paper airplane gliding smoothly through a sunlit modern architectural office, slow motion, cinematic 4k",
    "quality": "low",
    "duration_s": 5,
    "aspect_ratio": "16:9"
  }'`;

  const curlImageToVideo = `curl -X POST http://localhost:3000/api/image-to-video \\
  -H "Content-Type: application/json" \\
  -d '{
    "userId": "usr_demo_123",
    "image_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
    "prompt": "Walking forward smiling into the camera, cinematic lighting, slow zoom",
    "quality": "low",
    "duration_s": 5
  }'`;

  const curlStatus = `curl -X GET http://localhost:3000/api/video-status/viggle_rnd_example_123 \\
  -H "Accept: application/json"`;

  const curlCheckout = `curl -X POST http://localhost:3000/api/stripe/create-checkout-session \\
  -H "Content-Type: application/json" \\
  -d '{
    "userId": "usr_demo_123",
    "packageKey": "small"
  }'`;

  const curlStripeCLI = `# Локално препращане на Stripe Webhook събития с Stripe CLI:
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Задействане на тестово checkout.session.completed събитие:
stripe trigger checkout.session.completed`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/40 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            REST API Reference
          </span>
          <span className="text-xs text-slate-400">Node.js Express V1</span>
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          API Спецификация & cURL Примери
        </h2>
        <p className="text-sm text-slate-300 max-w-2xl mt-1">
          Всички ендпойнти могат да се извикват директно от всяко клиентско приложение (React, Next.js, мобилно приложение или cURL).
        </p>
      </div>

      <div className="space-y-6">
        {/* Endpoint 1: POST /api/generate-video */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-emerald-600 text-white font-mono">
                POST
              </span>
              <span className="font-mono text-sm font-semibold text-slate-900">
                /api/generate-video
              </span>
            </div>
            <span className="text-xs text-slate-500">Изисква поне 1 кредит</span>
          </div>
          <p className="text-xs text-slate-600 mb-4">
            Проверява наличността на кредит за потребителя, изпраща задачата с Bearer токен към{' '}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700">https://apis.viggle.ai/v1/renders</code>, удържа 1 кредит и връща <code>renderId</code>.
          </p>

          <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 text-slate-400 text-xs font-mono">
              <span>cURL заявка</span>
              <button
                onClick={() => copyToClipboard(curlGenerate, 'gen')}
                className="text-slate-400 hover:text-white flex items-center gap-1"
              >
                {copiedId === 'gen' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId === 'gen' ? 'Копирано' : 'Копирай'}
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-emerald-300 overflow-x-auto">
              <code>{curlGenerate}</code>
            </pre>
          </div>
        </div>

        {/* Endpoint 1b: POST /api/text-to-video */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-purple-600 text-white font-mono">
                POST
              </span>
              <span className="font-mono text-sm font-semibold text-slate-900">
                /api/text-to-video
              </span>
            </div>
            <span className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-medium">H3 Модел + Нативно Аудио</span>
          </div>
          <p className="text-xs text-slate-600 mb-4">
            Генерира видео изцяло от текстов промпт. Включва автоматично генерирано нативно аудио според описаната сцена. Извиква{' '}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-purple-700">POST https://apis.viggle.ai/v1/videos</code>.
          </p>

          <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 text-slate-400 text-xs font-mono">
              <span>cURL заявка (Text to Video)</span>
              <button
                onClick={() => copyToClipboard(curlTextToVideo, 't2v')}
                className="text-slate-400 hover:text-white flex items-center gap-1"
              >
                {copiedId === 't2v' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId === 't2v' ? 'Копирано' : 'Копирай'}
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-purple-300 overflow-x-auto">
              <code>{curlTextToVideo}</code>
            </pre>
          </div>
        </div>

        {/* Endpoint 1c: POST /api/image-to-video */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-sky-600 text-white font-mono">
                POST
              </span>
              <span className="font-mono text-sm font-semibold text-slate-900">
                /api/image-to-video
              </span>
            </div>
            <span className="text-xs text-sky-700 bg-sky-50 px-2 py-0.5 rounded font-medium">First Frame Animation</span>
          </div>
          <p className="text-xs text-slate-600 mb-4">
            Анимира първи кадър (First Frame) с кинематографично движение според описан текстов prompt. Извиква{' '}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sky-700">POST https://apis.viggle.ai/v1/videos</code> с multipart или image_url.
          </p>

          <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 text-slate-400 text-xs font-mono">
              <span>cURL заявка (Image to Video)</span>
              <button
                onClick={() => copyToClipboard(curlImageToVideo, 'i2v')}
                className="text-slate-400 hover:text-white flex items-center gap-1"
              >
                {copiedId === 'i2v' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId === 'i2v' ? 'Копирано' : 'Копирай'}
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-sky-300 overflow-x-auto">
              <code>{curlImageToVideo}</code>
            </pre>
          </div>
        </div>

        {/* Endpoint 2: GET /api/video-status/:renderId */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-blue-600 text-white font-mono">
                GET
              </span>
              <span className="font-mono text-sm font-semibold text-slate-900">
                /api/video-status/:renderId
              </span>
            </div>
            <span className="text-xs text-slate-500">Проверка на напредък и резултат</span>
          </div>
          <p className="text-xs text-slate-600 mb-4">
            Изпраща GET заявка с Bearer токен към{' '}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700">https://apis.viggle.ai/v1/videos/&#123;render_id&#125;</code> и връща текущия статус и директен линк към видеото, когато е готово.
          </p>

          <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 text-slate-400 text-xs font-mono">
              <span>cURL заявка</span>
              <button
                onClick={() => copyToClipboard(curlStatus, 'status')}
                className="text-slate-400 hover:text-white flex items-center gap-1"
              >
                {copiedId === 'status' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId === 'status' ? 'Копирано' : 'Копирай'}
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-sky-300 overflow-x-auto">
              <code>{curlStatus}</code>
            </pre>
          </div>
        </div>

        {/* Endpoint 3: POST /api/stripe/create-checkout-session */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-emerald-600 text-white font-mono">
                POST
              </span>
              <span className="font-mono text-sm font-semibold text-slate-900">
                /api/stripe/create-checkout-session
              </span>
            </div>
            <span className="text-xs text-slate-500">Stripe Checkout</span>
          </div>
          <p className="text-xs text-slate-600 mb-4">
            Генерира платежна сесия за Малък (50 кредита, $4.99) или Голям пакет (200 кредита, $14.99).
          </p>

          <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 text-slate-400 text-xs font-mono">
              <span>cURL заявка</span>
              <button
                onClick={() => copyToClipboard(curlCheckout, 'checkout')}
                className="text-slate-400 hover:text-white flex items-center gap-1"
              >
                {copiedId === 'checkout' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId === 'checkout' ? 'Копирано' : 'Копирай'}
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-purple-300 overflow-x-auto">
              <code>{curlCheckout}</code>
            </pre>
          </div>
        </div>

        {/* Stripe CLI Guide */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-2">
            <Terminal className="w-4 h-4 text-indigo-600" />
            Тестване на Stripe Webhook в локална среда
          </div>
          <p className="text-xs text-slate-600 mb-4">
            За да препращате истински Stripe събития към локалния сървър и да проверите криптографския подпис:
          </p>

          <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 text-slate-400 text-xs font-mono">
              <span>Stripe CLI команди</span>
              <button
                onClick={() => copyToClipboard(curlStripeCLI, 'cli')}
                className="text-slate-400 hover:text-white flex items-center gap-1"
              >
                {copiedId === 'cli' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId === 'cli' ? 'Копирано' : 'Копирай'}
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-amber-300 overflow-x-auto">
              <code>{curlStripeCLI}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
