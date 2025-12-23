import { Response } from 'express';
import { prisma } from '../db/prisma';
import type { AuthRequest } from '../middleware/auth';

// バージョン一覧取得
export const getVersions = async (req: AuthRequest, res: Response) => {
  try {
    const { diagramId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    // ダイアグラムの存在確認
    const diagram = await prisma.diagram.findUnique({
      where: { id: diagramId },
      include: { project: true },
    });

    if (!diagram) {
      return res.status(404).json({ error: 'ダイアグラムが見つかりません' });
    }

    // プロジェクトへのアクセス権確認
    const projectId = diagram.projectId;
    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    const isOwner = diagram.project.ownerId === userId;

    if (!isOwner && !member) {
      return res.status(403).json({ error: 'このプロジェクトへのアクセス権限がありません' });
    }

    // バージョン一覧取得（降順: 最新が最初）
    const versions = await prisma.diagramVersion.findMany({
      where: { diagramId },
      orderBy: { versionNumber: 'desc' },
      select: {
        id: true,
        versionNumber: true,
        title: true,
        commitMessage: true,
        createdBy: true,
        createdAt: true,
      },
    });

    res.json(versions);
  } catch (error) {
    console.error('Error fetching versions:', error);
    res.status(500).json({ error: 'バージョン一覧の取得に失敗しました' });
    return;
  }
};

// 特定バージョン取得
export const getVersion = async (req: AuthRequest, res: Response) => {
  try {
    const { diagramId, versionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    // ダイアグラムの存在確認
    const diagram = await prisma.diagram.findUnique({
      where: { id: diagramId },
      include: { project: true },
    });

    if (!diagram) {
      return res.status(404).json({ error: 'ダイアグラムが見つかりません' });
    }

    // プロジェクトへのアクセス権確認
    const projectId = diagram.projectId;
    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    const isOwner = diagram.project.ownerId === userId;

    if (!isOwner && !member) {
      return res.status(403).json({ error: 'このプロジェクトへのアクセス権限がありません' });
    }

    // バージョン取得
    const version = await prisma.diagramVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.diagramId !== diagramId) {
      return res.status(404).json({ error: 'バージョンが見つかりません' });
    }

    res.json(version);
  } catch (error) {
    console.error('Error fetching version:', error);
    res.status(500).json({ error: 'バージョンの取得に失敗しました' });
    return;
  }
};

// バージョン作成（コミット）
export const createVersion = async (req: AuthRequest, res: Response) => {
  try {
    const { diagramId } = req.params;
    const { commitMessage } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    if (!commitMessage || typeof commitMessage !== 'string') {
      return res.status(400).json({ error: 'コミットメッセージは必須です' });
    }

    // ダイアグラムの存在確認と現在のデータ取得
    const diagram = await prisma.diagram.findUnique({
      where: { id: diagramId },
      include: { project: true },
    });

    if (!diagram) {
      return res.status(404).json({ error: 'ダイアグラムが見つかりません' });
    }

    // プロジェクトへのアクセス権確認（editor以上）
    const projectId = diagram.projectId;
    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    const isOwner = diagram.project.ownerId === userId;
    const isEditor = member?.role === 'editor';

    if (!isOwner && !isEditor) {
      return res.status(403).json({ error: 'バージョン作成権限がありません' });
    }

    // 最新のバージョン番号を取得
    const latestVersion = await prisma.diagramVersion.findFirst({
      where: { diagramId },
      orderBy: { versionNumber: 'desc' },
    });

    const newVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    // 新しいバージョンを作成
    const version = await prisma.diagramVersion.create({
      data: {
        diagramId,
        versionNumber: newVersionNumber,
        title: diagram.title,
        data: diagram.data as any,
        commitMessage,
        createdBy: userId,
      },
    });

    // アクティビティログ記録
    await prisma.activityLog.create({
      data: {
        projectId,
        userId,
        action: 'create_version',
        data: {
          diagramId,
          versionNumber: newVersionNumber,
          commitMessage,
        },
      },
    });

    res.status(201).json(version);
  } catch (error) {
    console.error('Error creating version:', error);
    res.status(500).json({ error: 'バージョンの作成に失敗しました' });
    return;
  }
};

// バージョンへのロールバック
export const restoreVersion = async (req: AuthRequest, res: Response) => {
  try {
    const { diagramId, versionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    // ダイアグラムの存在確認
    const diagram = await prisma.diagram.findUnique({
      where: { id: diagramId },
      include: { project: true },
    });

    if (!diagram) {
      return res.status(404).json({ error: 'ダイアグラムが見つかりません' });
    }

    // プロジェクトへのアクセス権確認（editor以上）
    const projectId = diagram.projectId;
    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    const isOwner = diagram.project.ownerId === userId;
    const isEditor = member?.role === 'editor';

    if (!isOwner && !isEditor) {
      return res.status(403).json({ error: 'ロールバック権限がありません' });
    }

    // バージョン取得
    const version = await prisma.diagramVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.diagramId !== diagramId) {
      return res.status(404).json({ error: 'バージョンが見つかりません' });
    }

    // ダイアグラムを更新（ロールバック）
    const updatedDiagram = await prisma.diagram.update({
      where: { id: diagramId },
      data: {
        title: version.title,
        data: version.data as any,
        version: diagram.version + 1, // バージョンカウンターをインクリメント
      },
    });

    // アクティビティログ記録
    await prisma.activityLog.create({
      data: {
        projectId,
        userId,
        action: 'restore_version',
        data: {
          diagramId,
          restoredFromVersion: version.versionNumber,
        },
      },
    });

    res.json(updatedDiagram);
  } catch (error) {
    console.error('Error restoring version:', error);
    res.status(500).json({ error: 'バージョンの復元に失敗しました' });
    return;
  }
};

// バージョン削除
export const deleteVersion = async (req: AuthRequest, res: Response) => {
  try {
    const { diagramId, versionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    // ダイアグラムの存在確認
    const diagram = await prisma.diagram.findUnique({
      where: { id: diagramId },
      include: { project: true },
    });

    if (!diagram) {
      return res.status(404).json({ error: 'ダイアグラムが見つかりません' });
    }

    // プロジェクトオーナーのみ削除可能
    const projectId = diagram.projectId;
    const isOwner = diagram.project.ownerId === userId;

    if (!isOwner) {
      return res.status(403).json({ error: 'バージョン削除はプロジェクトオーナーのみ可能です' });
    }

    // バージョン取得
    const version = await prisma.diagramVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.diagramId !== diagramId) {
      return res.status(404).json({ error: 'バージョンが見つかりません' });
    }

    // バージョン削除
    await prisma.diagramVersion.delete({
      where: { id: versionId },
    });

    // アクティビティログ記録
    await prisma.activityLog.create({
      data: {
        projectId,
        userId,
        action: 'delete_version',
        data: {
          diagramId,
          versionNumber: version.versionNumber,
        },
      },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting version:', error);
    res.status(500).json({ error: 'バージョンの削除に失敗しました' });
    return;
  }
};
