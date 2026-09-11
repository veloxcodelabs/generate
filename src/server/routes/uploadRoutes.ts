/**
 * Модул за качване на медийни файлове (Снимки и Motion Видеа)
 * Използва Multer за запазване на файловете в публичната папка /uploads
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

export const uploadRouter = Router();

// Осигуряваме съществуването на директорията за качени файлове
// На Vercel Serverless process.cwd() е read-only, затова използваме /tmp/uploads
const uploadsDir = process.env.VERCEL
  ? path.join('/tmp', 'uploads')
  : path.join(process.cwd(), 'uploads');

try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (err) {
  console.warn('[UploadRouter] Предупреждение при създаване на uploads директория:', err);
}

// Конфигуриране на дисковото съхранение с Multer
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const ext = path.extname(file.originalname).toLowerCase() || '';
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

// Филтър за позволени файлови формати (изображения и видеоклипове)
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/jpg',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-msvideo',
  ];

  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov', '.webm', '.avi'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Неподдържан файлов формат (${file.mimetype || ext}). Позволени са JPG, PNG, WEBP, MP4, MOV, WEBM.`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB лимит
  },
});

/**
 * POST /api/upload
 * Приема единичен файл ('file') от FormData и връща публично достъпен пълен URL адрес
 */
uploadRouter.post('/upload', (req: Request, res: Response) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      console.error('[UploadRouter] Грешка при качване на файл:', err);
      return res.status(400).json({
        error: err.message || 'Възникна грешка при качването на файла.',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'Моля изберете файл за качване.',
      });
    }

    // Изграждаме пълен публичен URL, съобразен с reverse proxy / Cloud Run
    const proto = (req.headers['x-forwarded-proto'] as string) || (req.secure ? 'https' : 'http');
    const host = (req.headers['x-forwarded-host'] as string) || req.get('host');
    const fullUrl = `${proto}://${host}/uploads/${req.file.filename}`;

    const isVideo = req.file.mimetype.startsWith('video/') ||
      ['.mp4', '.mov', '.webm', '.avi'].includes(path.extname(req.file.filename).toLowerCase());

    console.log(`[UploadRouter] Успешно качен файл: ${req.file.filename} -> ${fullUrl}`);

    return res.status(200).json({
      success: true,
      url: fullUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      type: isVideo ? 'video' : 'image',
    });
  });
});
