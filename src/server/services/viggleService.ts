/**
 * Сервиз за интеграция с Viggle AI API (V1)
 * Използва axios пакета за HTTP комуникация
 */

import axios, { AxiosError } from 'axios';
import path from 'path';
import fs from 'fs';
import { config } from '../config.ts';
import { db } from '../db/db.ts';
import { VideoRender } from '../db/types.ts';

// Демо видеа за симулиран режим (когато няма въведен Viggle API ключ)
const DEMO_SAMPLE_VIDEOS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
];

/**
 * Клас за детайлни грешки от Viggle AI API, предотвратяващ [object Object]
 */
export class ViggleApiError extends Error {
  public statusCode: number;
  public details: any;

  constructor(message: string, statusCode: number = 500, details: any = null) {
    super(message);
    this.name = 'ViggleApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Помощна функция за извличане на четимо съобщение от отговор на Viggle AI
 */
function parseViggleErrorMessage(errorData: any, fallbackMessage: string): string {
  if (!errorData) return fallbackMessage;
  if (typeof errorData === 'string') return errorData;
  if (typeof errorData.message === 'string') return errorData.message;
  if (typeof errorData.error === 'string') return errorData.error;
  if (typeof errorData.msg === 'string') return errorData.msg;
  if (typeof errorData.detail === 'string') return errorData.detail;
  if (errorData.error && typeof errorData.error.message === 'string') return errorData.error.message;

  // Ако е обект без очевидно message поле, форматираме безопасно
  try {
    return JSON.stringify(errorData);
  } catch {
    return fallbackMessage;
  }
}

export interface ViggleRenderRequest {
  imageUrl: string;
  motionVideoUrl: string;
  bgMode?: number; // 1 = White, 2 = Green, 0 = Original
}

export interface ViggleStatusResponse {
  renderId: string;
  status: 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  progress?: number;
  message?: string;
  isSimulated?: boolean;
}

function resolveLocalUpload(urlOrPath: string): string | null {
  if (!urlOrPath) return null;
  const match = urlOrPath.match(/\/uploads\/([^/?#]+)/);
  if (match) {
    const filename = match[1];
    const defaultPath = path.join(process.cwd(), 'uploads', filename);
    if (fs.existsSync(defaultPath)) {
      return defaultPath;
    }
    const tmpPath = path.join('/tmp', 'uploads', filename);
    if (fs.existsSync(tmpPath)) {
      return tmpPath;
    }
  }
  return null;
}

export class ViggleService {
  /**
   * Изпраща заявка за генериране на анимирано видео към Viggle AI API (V1)
   * Поддържа както публични URL адреси, така и директен мултипарт ъплоуд на локални файлове
   * POST https://apis.viggle.ai/v1/renders
   */
  static async submitRender(params: {
    userId: string;
    imageUrl: string;
    motionVideoUrl: string;
    bgMode?: number;
  }): Promise<{ renderId: string; isSimulated: boolean }> {
    const { userId, imageUrl, motionVideoUrl, bgMode = 0 } = params;

    // Валидация на входните URL адреси
    if (!imageUrl || !motionVideoUrl) {
      throw new ViggleApiError('Моля, предоставете както image_url, така и motion_video_url.', 400);
    }

    const cleanImageUrl = imageUrl.trim();
    const cleanMotionVideoUrl = motionVideoUrl.trim();

    const localImageFile = resolveLocalUpload(cleanImageUrl);
    const localMotionFile = resolveLocalUpload(cleanMotionVideoUrl);

    // Проверка за валиден публичен URL или наличен локален качен файл
    if (!localImageFile && !/^https?:\/\//i.test(cleanImageUrl)) {
      throw new ViggleApiError(
        'Невалиден image_url: Адресът трябва да бъде пълен публичен HTTP/HTTPS URL или качен файл.',
        400,
        { field: 'image_url', provided: cleanImageUrl }
      );
    }

    if (!localMotionFile && !/^https?:\/\//i.test(cleanMotionVideoUrl)) {
      throw new ViggleApiError(
        'Невалиден motion_video_url: Адресът трябва да бъде пълен публичен HTTP/HTTPS URL на видео или качен файл.',
        400,
        { field: 'motion_video_url', provided: cleanMotionVideoUrl }
      );
    }

    // Режим със симулация, ако няма конфигуриран VIGGLE_API_KEY
    if (!config.isViggleConfigured()) {
      console.warn('[ViggleService] VIGGLE_API_KEY не е зададен. Използва се симулиран V1 рендер.');
      const simulatedRenderId = `viggle_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Записване на задачата в локалната база
      await db.createVideoRender({
        userId,
        renderId: simulatedRenderId,
        imageUrl: cleanImageUrl,
        motionVideoUrl: cleanMotionVideoUrl,
        status: 'processing',
      });

      return { renderId: simulatedRenderId, isSimulated: true };
    }

    // РЕАЛНО ИЗВИКВАНЕ НА VIGGLE AI API (V1)
    try {
      const idempotencyKey = `viggle_idemp_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      let data: any;

      if (localImageFile || localMotionFile) {
        console.log(`[ViggleService] Изпращане на директен multipart/form-data рендер към Viggle AI (Image=${localImageFile ? 'Local' : 'URL'}, Motion=${localMotionFile ? 'Local' : 'URL'})`);
        const formData = new FormData();

        if (localImageFile) {
          const fileBuffer = await fs.promises.readFile(localImageFile);
          const ext = path.extname(localImageFile).toLowerCase();
          const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
          const blob = new Blob([fileBuffer], { type: mime });
          formData.append('image', blob, path.basename(localImageFile));
        } else {
          formData.append('image_url', cleanImageUrl);
        }

        if (localMotionFile) {
          const fileBuffer = await fs.promises.readFile(localMotionFile);
          const ext = path.extname(localMotionFile).toLowerCase();
          const mime = ext === '.webm' ? 'video/webm' : ext === '.mov' ? 'video/quicktime' : 'video/mp4';
          const blob = new Blob([fileBuffer], { type: mime });
          formData.append('motion_video', blob, path.basename(localMotionFile));
        } else {
          formData.append('motion_video_url', cleanMotionVideoUrl);
        }

        formData.append('bg_mode', bgMode.toString());

        const res = await fetch(`${config.viggle.apiBaseUrl}/renders`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.viggle.apiKey}`,
            Accept: 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: formData,
        });

        const text = await res.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }

        if (!res.ok) {
          throw new ViggleApiError(
            `Грешка от API: ${parseViggleErrorMessage(data, 'Грешка при изпращане на задачата към видео сървъра.')}`,
            res.status,
            data
          );
        }
      } else {
        // Стандартен JSON рендер за публични интернет адреси
        const payload = {
          image_url: cleanImageUrl,
          motion_video_url: cleanMotionVideoUrl,
          bg_mode: bgMode,
        };

        console.log(`[ViggleService] Изпращане на заявка към ${config.viggle.apiBaseUrl}/renders с Bearer токен`);

        const response = await axios.post(`${config.viggle.apiBaseUrl}/renders`, payload, {
          headers: {
            Authorization: `Bearer ${config.viggle.apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          timeout: 30000,
        });
        data = response.data;
      }

      // API връща обект с ID или render_id
      const renderId = data.render_id || data.id || data.renderId || data.task_id;

      if (!renderId) {
        throw new ViggleApiError('API не върна валиден renderId в отговора си.', 502, data);
      }

      // Записване в базата данни за проследяване
      await db.createVideoRender({
        userId,
        renderId,
        mode: 'remix',
        imageUrl: cleanImageUrl,
        motionVideoUrl: cleanMotionVideoUrl,
        status: 'processing',
      });

      return { renderId, isSimulated: false };
    } catch (err: any) {
      const axiosErr = err as AxiosError<any>;
      const viggleData = axiosErr.response?.data;
      const statusCode = axiosErr.response?.status || err.statusCode || 500;

      // Детайлен лог на грешката от Viggle в JSON формат без [object Object]
      console.error('Пълна грешка от Viggle AI API (POST /renders):', JSON.stringify(viggleData || err.message, null, 2));

      const humanMessage = parseViggleErrorMessage(
        viggleData,
        err.message || 'Възникна грешка при изпращане на задачата към видео сървъра.'
      );

      throw new ViggleApiError(`Грешка от видео API: ${humanMessage}`, statusCode, viggleData || err.message);
    }
  }

  /**
   * Опция 1: Генериране на видео от текстов промпт (H3 Video Generation - Text to Video)
   * POST https://apis.viggle.ai/v1/videos
   * Поддържа качество low/high, продължителност 3-15 сек, пропорция 16:9, 9:16, 1:1
   * Всяко генерирано видео включва нативно аудио!
   */
  static async generateTextToVideo(params: {
    userId: string;
    prompt: string;
    quality?: 'low' | 'high';
    durationSeconds?: number;
    aspectRatio?: string;
    resolution?: string;
  }): Promise<{ renderId: string; isSimulated: boolean }> {
    const {
      userId,
      prompt,
      quality = 'low',
      durationSeconds = 5,
      aspectRatio = '16:9',
      resolution = '768p',
    } = params;

    const cleanPrompt = (prompt || '').trim();
    if (!cleanPrompt) {
      throw new ViggleApiError('Моля, въведете текст (prompt) за генериране на видеото.', 400);
    }

    const duration = Math.min(15, Math.max(3, Number(durationSeconds) || 5));

    if (!config.isViggleConfigured()) {
      console.warn('[ViggleService] VIGGLE_API_KEY не е зададен. Симулиране на Text-to-Video.');
      const simulatedRenderId = `viggle_sim_t2v_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await db.createVideoRender({
        userId,
        renderId: simulatedRenderId,
        mode: 'text-to-video',
        prompt: cleanPrompt,
        quality,
        durationSeconds: duration,
        aspectRatio,
        status: 'processing',
      });
      return { renderId: simulatedRenderId, isSimulated: true };
    }

    try {
      const form = new FormData();
      form.append('prompt', cleanPrompt);
      form.append('quality', quality);
      form.append('duration_s', String(duration));
      if (aspectRatio) {
        form.append('aspect_ratio', aspectRatio);
      }
      if (resolution) {
        form.append('resolution', resolution);
      }

      console.log(`[ViggleService] Изпращане на Text-to-Video към ${config.viggle.apiBaseUrl}/videos (prompt: "${cleanPrompt.substring(0, 45)}...")`);

      const response = await fetch(`${config.viggle.apiBaseUrl}/videos`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.viggle.apiKey}`,
        },
        body: form,
      });

      const data: any = await response.json().catch(() => ({}));

      if (!response.ok) {
        const msg = parseViggleErrorMessage(data, `HTTP ${response.status} грешка от видео API`);
        throw new ViggleApiError(`Грешка при генериране на видео от текст: ${msg}`, response.status, data);
      }

      const videoId = data.id || data.video_id || data.renderId;
      if (!videoId) {
        throw new ViggleApiError('API не върна валиден ID за видео задачата.', 502, data);
      }

      await db.createVideoRender({
        userId,
        renderId: videoId,
        mode: 'text-to-video',
        prompt: cleanPrompt,
        quality,
        durationSeconds: duration,
        aspectRatio,
        status: 'processing',
      });

      return { renderId: videoId, isSimulated: false };
    } catch (err: any) {
      if (err instanceof ViggleApiError) throw err;
      throw new ViggleApiError(`Възникна грешка при стартиране на Text-to-Video: ${err.message}`, 500, err);
    }
  }

  /**
   * Опция 2: Генериране на видео от изображение (Image to Video / First Frame to Video)
   * POST https://apis.viggle.ai/v1/videos
   * Използва first_frame_image (за качен файл) или first_frame_image_url (за публичен URL)
   */
  static async generateImageToVideo(params: {
    userId: string;
    imageUrl: string;
    prompt?: string;
    quality?: 'low' | 'high';
    durationSeconds?: number;
  }): Promise<{ renderId: string; isSimulated: boolean }> {
    const {
      userId,
      imageUrl,
      prompt = '',
      quality = 'low',
      durationSeconds = 5,
    } = params;

    const cleanImageUrl = (imageUrl || '').trim();
    if (!cleanImageUrl) {
      throw new ViggleApiError('Моля, изберете начално изображение за анимиране (Image to Video).', 400);
    }

    const cleanPrompt = (prompt || 'cinematic motion high quality').trim();
    const duration = Math.min(15, Math.max(3, Number(durationSeconds) || 5));
    const localImageFile = resolveLocalUpload(cleanImageUrl);

    if (!localImageFile && !/^https?:\/\//i.test(cleanImageUrl)) {
      throw new ViggleApiError(
        'Невалиден адрес на изображението: Моля, въведете публичен URL адрес или качете локален файл.',
        400,
        { imageUrl: cleanImageUrl }
      );
    }

    if (!config.isViggleConfigured()) {
      console.warn('[ViggleService] VIGGLE_API_KEY не е зададен. Симулиране на Image-to-Video.');
      const simulatedRenderId = `viggle_sim_i2v_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await db.createVideoRender({
        userId,
        renderId: simulatedRenderId,
        mode: 'image-to-video',
        imageUrl: cleanImageUrl,
        prompt: cleanPrompt,
        quality,
        durationSeconds: duration,
        status: 'processing',
      });
      return { renderId: simulatedRenderId, isSimulated: true };
    }

    try {
      const form = new FormData();
      if (localImageFile) {
        const fileBlob = await fs.promises.readFile(localImageFile);
        const mimeType = localImageFile.endsWith('.png') ? 'image/png' : localImageFile.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
        const blob = new Blob([fileBlob], { type: mimeType });
        form.append('first_frame_image', blob, path.basename(localImageFile));
      } else {
        form.append('first_frame_image_url', cleanImageUrl);
      }

      form.append('prompt', cleanPrompt);
      form.append('quality', quality);
      form.append('duration_s', String(duration));

      console.log(`[ViggleService] Изпращане на Image-to-Video към ${config.viggle.apiBaseUrl}/videos (file: ${localImageFile ? 'local' : cleanImageUrl})`);

      const response = await fetch(`${config.viggle.apiBaseUrl}/videos`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.viggle.apiKey}`,
        },
        body: form,
      });

      const data: any = await response.json().catch(() => ({}));

      if (!response.ok) {
        const msg = parseViggleErrorMessage(data, `HTTP ${response.status} грешка от видео API`);
        throw new ViggleApiError(`Грешка при генериране на видео от изображение: ${msg}`, response.status, data);
      }

      const videoId = data.id || data.video_id || data.renderId;
      if (!videoId) {
        throw new ViggleApiError('API не върна валиден ID за видео задачата.', 502, data);
      }

      await db.createVideoRender({
        userId,
        renderId: videoId,
        mode: 'image-to-video',
        imageUrl: cleanImageUrl,
        prompt: cleanPrompt,
        quality,
        durationSeconds: duration,
        status: 'processing',
      });

      return { renderId: videoId, isSimulated: false };
    } catch (err: any) {
      if (err instanceof ViggleApiError) throw err;
      throw new ViggleApiError(`Възникна грешка при стартиране на Image-to-Video: ${err.message}`, 500, err);
    }
  }

  /**
   * Проверява статуса на задачата към Viggle AI API (V1)
   * GET https://apis.viggle.ai/v1/videos/{render_id}
   */
  static async checkStatus(renderId: string): Promise<ViggleStatusResponse> {
    if (!renderId) {
      throw new Error('Липсва renderId параметър.');
    }

    const localRecord = await db.getVideoRender(renderId);

    // 1. Ако задачата е симулирана (без реален ключ)
    if (!config.isViggleConfigured() || renderId.startsWith('viggle_sim_')) {
      return this.simulateStatusProgress(renderId, localRecord);
    }

    // 2. РЕАЛНО ИЗВИКВАНЕ НА VIGGLE AI API (V1) С AXIOS
    try {
      const url = `${config.viggle.apiBaseUrl}/videos/${encodeURIComponent(renderId)}`;
      console.log(`[ViggleService] Проверка на статус от ${url}`);

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${config.viggle.apiKey}`,
          Accept: 'application/json',
        },
        timeout: 20000,
      });

      const data = response.data;
      const rawStatus = (data.status || data.state || 'processing').toLowerCase();
      const videoUrl = data.video_url || data.result_url || data.url || data.output_url || undefined;

      // Нормализиране на статуса от Viggle V1:
      // ВАЖНО: Viggle V1 връща "status": "ready", когато видеото е генерирано успешно!
      // Също така, ако има върнат video_url, статусът гарантирано е completed.
      let normalizedStatus: 'processing' | 'completed' | 'failed' = 'processing';
      if (
        rawStatus === 'ready' ||
        rawStatus === 'done' ||
        rawStatus === 'completed' ||
        rawStatus === 'success' ||
        rawStatus === 'finished' ||
        Boolean(videoUrl)
      ) {
        normalizedStatus = 'completed';
      } else if (
        rawStatus === 'failed' ||
        rawStatus === 'error' ||
        rawStatus === 'canceled' ||
        rawStatus === 'cancelled' ||
        rawStatus === 'rejected'
      ) {
        normalizedStatus = 'failed';
      }

      const progress = typeof data.progress === 'number'
        ? data.progress
        : normalizedStatus === 'completed'
        ? 100
        : 50;

      // Обновяване на записа в базата данни
      if (localRecord) {
        await db.updateVideoRender(renderId, {
          status: normalizedStatus,
          progress,
          videoUrl,
          errorMessage: data.error ? (typeof data.error === 'string' ? data.error : JSON.stringify(data.error)) : data.message || undefined,
        });
      } else {
        await db.createVideoRender({
          userId: 'usr_demo_123',
          renderId,
          mode: renderId.startsWith('vid_') ? 'text-to-video' : 'remix',
          status: normalizedStatus,
        });
        if (normalizedStatus === 'completed' && videoUrl) {
          await db.updateVideoRender(renderId, {
            status: normalizedStatus,
            progress: 100,
            videoUrl,
          });
        }
      }

      return {
        renderId,
        status: normalizedStatus,
        videoUrl,
        progress,
        message: data.message || (normalizedStatus === 'completed' ? 'Видеото е готово!' : 'Видеото се рендерира...'),
        isSimulated: false,
      };
    } catch (err: any) {
      const axiosErr = err as AxiosError<any>;
      const viggleData = axiosErr.response?.data;
      const statusCode = axiosErr.response?.status || err.statusCode || 500;

      console.error(
        `Пълна грешка от Viggle AI API (GET /videos/${renderId}):`,
        JSON.stringify(viggleData || err.message, null, 2)
      );

      const humanMessage = parseViggleErrorMessage(
        viggleData,
        err.message || 'Неуспешна проверка на статус от видео API.'
      );

      // Ако локално имаме запис, връщаме го за отказоустойчивост с ясно съобщение
      if (localRecord) {
        return {
          renderId,
          status: localRecord.status,
          videoUrl: localRecord.videoUrl,
          progress: localRecord.progress,
          message: `Грешка при проверка в реално време: ${humanMessage}`,
          isSimulated: false,
        };
      }

      throw new ViggleApiError(`Неуспешна проверка на статус от видео API: ${humanMessage}`, statusCode, viggleData || err.message);
    }
  }

  /**
   * Помощна функция за реалистично симулиране на напредъка при липса на ключ
   */
  private static async simulateStatusProgress(
    renderId: string,
    record: VideoRender | null
  ): Promise<ViggleStatusResponse> {
    if (!record) {
      return {
        renderId,
        status: 'completed',
        progress: 100,
        videoUrl: DEMO_SAMPLE_VIDEOS[0],
        isSimulated: true,
      };
    }

    if (record.status === 'completed') {
      return {
        renderId,
        status: 'completed',
        progress: 100,
        videoUrl: record.videoUrl,
        isSimulated: true,
      };
    }

    // Изчисляване на прогрес спрямо времето от създаване (завършва за ~8 секунди)
    const elapsedSeconds = (Date.now() - new Date(record.createdAt).getTime()) / 1000;
    if (elapsedSeconds >= 8) {
      const chosenVideo = DEMO_SAMPLE_VIDEOS[Math.floor(Math.random() * DEMO_SAMPLE_VIDEOS.length)];
      await db.updateVideoRender(renderId, {
        status: 'completed',
        progress: 100,
        videoUrl: chosenVideo,
      });

      return {
        renderId,
        status: 'completed',
        progress: 100,
        videoUrl: chosenVideo,
        isSimulated: true,
      };
    }

    const calculatedProgress = Math.min(95, Math.max(10, Math.round((elapsedSeconds / 8) * 100)));
    await db.updateVideoRender(renderId, {
      status: 'processing',
      progress: calculatedProgress,
    });

    return {
      renderId,
      status: 'processing',
      progress: calculatedProgress,
      isSimulated: true,
    };
  }
}
