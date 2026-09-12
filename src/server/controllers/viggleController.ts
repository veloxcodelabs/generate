/**
 * Viggle AI Controller
 * Управлява генерирането на анимирани видеа и проверка на статус
 */

import { Request, Response } from 'express';
import { CreditService } from '../services/creditService.ts';
import { ViggleService } from '../services/viggleService.ts';
import { db } from '../db/db.ts';
import { config } from '../config.ts';

export class ViggleController {
  /**
   * ЕНДПОЙНТ 1: POST /api/generate-video
   * Поддържа 3 режима:
   * 1. 'remix' (Character + Motion Video)
   * 2. 'text-to-video' (H3 Video Generation от Prompt)
   * 3. 'image-to-video' (First Frame Image + Prompt)
   */
  static async generateVideo(req: Request, res: Response) {
    try {
      // Поддържаме както camelCase, така и snake_case
      const {
        userId = 'usr_demo_123',
        mode,
        prompt,
        quality = 'low',
        duration_s,
        durationSeconds,
        aspect_ratio,
        aspectRatio,
        resolution,
        image_url,
        imageUrl,
        motion_video_url,
        motionVideoUrl,
        bg_mode,
        bgMode,
      } = req.body;

      const rawPrompt = (prompt || '').trim();
      const rawImageUrl = (image_url || imageUrl || '').trim();
      const rawMotionVideoUrl = (motion_video_url || motionVideoUrl || '').trim();
      const finalQuality: 'low' | 'high' = quality === 'high' ? 'high' : 'low';
      const finalDuration = Number(duration_s || durationSeconds) || 5;
      const finalAspectRatio = aspect_ratio || aspectRatio || '16:9';
      // По подразбиране 480p, за да не се превишава кредитния баланс във Viggle AI (768p изисква повече кредити)
      const finalResolution = resolution || (finalQuality === 'high' ? '768p' : '480p');
      const finalBgMode = bg_mode !== undefined ? bg_mode : bgMode;

      // Определяне на режима (remix / text-to-video / image-to-video)
      let selectedMode: 'remix' | 'text-to-video' | 'image-to-video' = 'remix';
      if (mode === 'text-to-video' || (!rawImageUrl && !rawMotionVideoUrl && rawPrompt)) {
        selectedMode = 'text-to-video';
      } else if (mode === 'image-to-video' || (rawImageUrl && !rawMotionVideoUrl)) {
        selectedMode = 'image-to-video';
      } else {
        selectedMode = 'remix';
      }

      // 1. Валидация спрямо избрания режим
      if (selectedMode === 'text-to-video') {
        if (!rawPrompt) {
          return res.status(400).json({
            error: 'Липсва текст (prompt) за режим "Text to Video". Моля въведете описание на сцената.',
          });
        }
      } else if (selectedMode === 'image-to-video') {
        if (!rawImageUrl) {
          return res.status(400).json({
            error: 'Липсва начално изображение за режим "Image to Video". Моля качете файл или въведете image_url.',
          });
        }
      } else {
        // Remix режим
        if (!rawImageUrl || !rawMotionVideoUrl) {
          return res.status(400).json({
            error: 'Липсват задължителни параметри за Video Remix. Моля изпратете "image_url" и "motion_video_url".',
          });
        }
      }

      // За релативни пътища на изображения/видеа към пълен URL
      const proto = (req.headers['x-forwarded-proto'] as string) || (req.secure ? 'https' : 'http');
      const host = (req.headers['x-forwarded-host'] as string) || req.get('host');
      const baseUrl = `${proto}://${host}`;

      const finalImageUrl = rawImageUrl.startsWith('/') ? `${baseUrl}${rawImageUrl}` : rawImageUrl;
      const finalMotionVideoUrl = rawMotionVideoUrl.startsWith('/') ? `${baseUrl}${rawMotionVideoUrl}` : rawMotionVideoUrl;

      // 2. Проверка за кредити (1 кредит за всяка генерация)
      const hasCredits = await CreditService.hasSufficientCredits(userId, 1);
      if (!hasCredits) {
        const user = await db.getUserById(userId);
        const currentCredits = user ? user.credits : 0;
        return res.status(402).json({
          error: `Нямате достатъчно кредити за генериране на видео! Текущ баланс: ${currentCredits}. Необходим: 1 кредит.`,
          requiredCredits: 1,
          currentCredits,
        });
      }

      // 3. Изпращане на заявката към съответния Viggle API метод
      let renderResult: { renderId: string; isSimulated: boolean };
      if (selectedMode === 'text-to-video') {
        renderResult = await ViggleService.generateTextToVideo({
          userId,
          prompt: rawPrompt,
          quality: finalQuality,
          durationSeconds: finalDuration,
          aspectRatio: finalAspectRatio,
          resolution: finalResolution,
        });
      } else if (selectedMode === 'image-to-video') {
        renderResult = await ViggleService.generateImageToVideo({
          userId,
          imageUrl: finalImageUrl,
          prompt: rawPrompt,
          quality: finalQuality,
          durationSeconds: finalDuration,
        });
      } else {
        renderResult = await ViggleService.submitRender({
          userId,
          imageUrl: finalImageUrl,
          motionVideoUrl: finalMotionVideoUrl,
          bgMode: finalBgMode,
        });
      }

      // 4. Удържане на 1 кредит след успешно стартирана задача
      const updatedUser = await CreditService.deductCredits(userId, 1);

      console.log(
        `[ViggleController] [${selectedMode}] Успешно стартиран рендер ${renderResult.renderId}. Нов баланс: ${updatedUser.credits} кредита.`
      );

      // 5. Връщане на отговор
      return res.status(200).json({
        success: true,
        renderId: renderResult.renderId,
        mode: selectedMode,
        remainingCredits: updatedUser.credits,
        status: 'processing',
        isSimulated: renderResult.isSimulated,
        message: selectedMode === 'text-to-video'
          ? 'Задачата за генериране на видео от текст е изпратена успешно (включва нативно аудио).'
          : selectedMode === 'image-to-video'
          ? 'Задачата за анимиране на изображение към видео е изпратена успешно.'
          : 'Задачата за видео анимация (Remix) е изпратена успешно.',
      });
    } catch (error: any) {
      const viggleError = error.response?.data || error.details || error.message;
      const statusCode = error.statusCode || error.response?.status || 500;

      console.error('Пълна грешка от Viggle AI API (POST /api/generate-video):', JSON.stringify(viggleError, null, 2));

      return res.status(statusCode).json({
        error: typeof error.message === 'string' ? error.message : 'Възникна грешка при генерирането на видеото.',
        details: viggleError,
      });
    }
  }

  /**
   * ЕНДПОЙНТ: POST /api/text-to-video
   * Директен псевдоним за режим Text to Video
   */
  static async textToVideo(req: Request, res: Response) {
    req.body.mode = 'text-to-video';
    return ViggleController.generateVideo(req, res);
  }

  /**
   * ЕНДПОЙНТ: POST /api/image-to-video
   * Директен псевдоним за режим Image to Video
   */
  static async imageToVideo(req: Request, res: Response) {
    req.body.mode = 'image-to-video';
    return ViggleController.generateVideo(req, res);
  }

  /**
   * ЕНДПОЙНТ 2: GET /api/video-status/:renderId
   * Проверява статуса на задачата към https://apis.viggle.ai/v1/videos/{render_id}
   * Връща статуса и линка към готовото видео, когато е готово.
   */
  static async getVideoStatus(req: Request, res: Response) {
    try {
      const { renderId } = req.params;

      if (!renderId) {
        return res.status(400).json({
          error: 'Липсва параметърът renderId в адреса на заявката.',
        });
      }

      // Проверка на статуса от Viggle AI API (или локален кеш)
      const statusData = await ViggleService.checkStatus(renderId);

      return res.status(200).json({
        renderId: statusData.renderId,
        status: statusData.status, // "processing" | "completed" | "failed"
        videoUrl: statusData.videoUrl || null,
        progress: statusData.progress ?? 0,
        message: statusData.message,
        errorMessage: statusData.errorMessage,
        isSimulated: statusData.isSimulated,
      });
    } catch (error: any) {
      // Вземаме детайлите от Viggle API, за да избегнем [object Object]
      const viggleError = error.response?.data || error.details || error.message;
      const statusCode = error.statusCode || error.response?.status || 500;

      console.error(
        `Пълна грешка от Viggle AI API (GET /api/video-status/${req.params.renderId}):`,
        JSON.stringify(viggleError, null, 2)
      );

      return res.status(statusCode).json({
        error: typeof error.message === 'string' ? error.message : 'Възникна грешка при проверка на статуса на видеото.',
        details: viggleError,
      });
    }
  }

  /**
   * Спомагателен ендпойнт за списък на всички генерирани видеа на потребителя
   * GET /api/videos
   */
  static async listUserVideos(req: Request, res: Response) {
    try {
      const userId = (req.query.userId as string) || 'usr_demo_123';
      const renders = await ViggleService.listVideos(userId);
      return res.json({ videos: renders });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Проверка на реалния баланс на кредити от Viggle AI акаунта
   * GET /api/viggle/credits
   */
  static async getAccountCredits(req: Request, res: Response) {
    try {
      if (!config.isViggleConfigured()) {
        return res.json({ configured: false, balance: null });
      }

      const resCredits = await fetch(`${config.viggle.apiBaseUrl}/credits`, {
        headers: {
          Authorization: `Bearer ${config.viggle.apiKey}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      });

      if (!resCredits.ok) {
        return res.json({ configured: true, balance: null, status: resCredits.status });
      }

      const data: any = await resCredits.json().catch(() => ({}));
      return res.json({ configured: true, balance: data.balance ?? null });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}
