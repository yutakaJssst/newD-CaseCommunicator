import { Response } from 'express';
import { prisma } from '../db/prisma';
import type { AuthRequest } from '../middleware/auth';
import { encryptSecret } from '../utils/crypto';

const ALLOWED_PROVIDERS = new Set(['claude']);

export const getAiCredentials = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: '認証が必要です' });
  }

  const credentials = await prisma.aiCredential.findMany({
    where: { userId },
    select: { provider: true },
  });

  return res.json({
    providers: credentials.map((credential) => ({
      provider: credential.provider,
      configured: true,
    })),
  });
};

export const setAiCredential = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: '認証が必要です' });
  }

  const { provider, apiKey } = req.body as { provider?: string; apiKey?: string };
  if (!provider || !ALLOWED_PROVIDERS.has(provider)) {
    return res.status(400).json({ error: '未対応のプロバイダです' });
  }
  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'APIキーが必要です' });
  }

  const encryptedApiKey = encryptSecret(apiKey.trim());
  await prisma.aiCredential.upsert({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
    update: { encryptedApiKey },
    create: {
      userId,
      provider,
      encryptedApiKey,
    },
  });

  return res.json({ provider, configured: true });
};

export const deleteAiCredential = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: '認証が必要です' });
  }

  const { provider } = req.params;
  if (!provider || !ALLOWED_PROVIDERS.has(provider)) {
    return res.status(400).json({ error: '未対応のプロバイダです' });
  }

  await prisma.aiCredential.deleteMany({
    where: { userId, provider },
  });

  return res.status(204).send();
};
