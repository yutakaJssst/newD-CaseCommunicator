import fs from 'fs/promises';
import { prisma } from '../../db/prisma';

// Cleanup attachments older than 24 hours
const ATTACHMENT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Interval for cleanup task (every hour)
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export const cleanupOldAttachments = async (): Promise<{ deleted: number; errors: number }> => {
  const cutoffDate = new Date(Date.now() - ATTACHMENT_MAX_AGE_MS);

  const oldAttachments = await prisma.aiAttachment.findMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
    select: {
      id: true,
      storagePath: true,
      fileName: true,
    },
  });

  let deleted = 0;
  let errors = 0;

  for (const attachment of oldAttachments) {
    try {
      // Delete file from filesystem
      await fs.unlink(attachment.storagePath);
      console.log(`[attachmentCleanup] ファイル削除: ${attachment.fileName}`);
    } catch (err) {
      // File may already be deleted or not exist
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`[attachmentCleanup] ファイル削除エラー: ${attachment.fileName}`, err);
        errors++;
      }
    }

    // Delete database record
    try {
      await prisma.aiAttachment.delete({
        where: { id: attachment.id },
      });
      deleted++;
    } catch (err) {
      console.error(`[attachmentCleanup] DB削除エラー: ${attachment.id}`, err);
      errors++;
    }
  }

  if (deleted > 0 || errors > 0) {
    console.log(`[attachmentCleanup] クリーンアップ完了: ${deleted}件削除, ${errors}件エラー`);
  }

  return { deleted, errors };
};

export const startAttachmentCleanupScheduler = (): void => {
  if (cleanupInterval) {
    console.log('[attachmentCleanup] スケジューラーは既に起動中');
    return;
  }

  console.log('[attachmentCleanup] クリーンアップスケジューラーを開始');

  // Run immediately on startup
  cleanupOldAttachments().catch((err) => {
    console.error('[attachmentCleanup] 初回クリーンアップエラー:', err);
  });

  // Schedule periodic cleanup
  cleanupInterval = setInterval(() => {
    cleanupOldAttachments().catch((err) => {
      console.error('[attachmentCleanup] 定期クリーンアップエラー:', err);
    });
  }, CLEANUP_INTERVAL_MS);
};

export const stopAttachmentCleanupScheduler = (): void => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('[attachmentCleanup] クリーンアップスケジューラーを停止');
  }
};
