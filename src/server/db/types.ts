/**
 * Типове за данни (Database Models & DTOs)
 */

export interface User {
  id: string;
  email: string;
  name: string;
  credits: number;
  stripeCustomerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreditPackage {
  id: string;
  key: 'small' | 'large';
  name: string;
  description: string;
  credits: number;
  priceInCents: number;
  currency: string;
  stripePriceId?: string;
  badge?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  packageKey?: string;
  stripeSessionId: string;
  stripePaymentId?: string;
  amountPaid: number;
  currency: string;
  creditsAdded: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
}

export type VideoGenerationMode = 'remix' | 'text-to-video' | 'image-to-video';

export interface VideoRender {
  id: string;
  userId: string;
  renderId: string;
  mode?: VideoGenerationMode;
  prompt?: string;
  quality?: 'low' | 'high';
  durationSeconds?: number;
  aspectRatio?: string;
  imageUrl?: string;
  motionVideoUrl?: string;
  status: 'processing' | 'completed' | 'failed';
  progress?: number;
  videoUrl?: string;
  creditsUsed: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
