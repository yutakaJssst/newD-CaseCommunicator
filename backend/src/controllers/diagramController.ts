import { Response } from 'express';
import { prisma } from '../db/prisma';
import type { AuthRequest } from '../middleware/auth';

/**
 * プロジェクトに紐づく全ダイアグラムを取得
 * GET /api/projects/:projectId/diagrams
 */
export const getDiagrams = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: '認証が必要です' });
      return;
    }

    // プロジェクトへのアクセス権限を確認
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
    });

    if (!project) {
      res.status(404).json({ error: 'プロジェクトが見つからないか、アクセス権限がありません' });
      return;
    }

    // ダイアグラム一覧を取得
    const diagrams = await prisma.diagram.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ diagrams });
  } catch (error) {
    console.error('Get diagrams error:', error);
    res.status(500).json({ error: 'ダイアグラムの取得に失敗しました' });
  }
};

/**
 * 特定のダイアグラムを取得
 * GET /api/projects/:projectId/diagrams/:diagramId
 */
export const getDiagram = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, diagramId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: '認証が必要です' });
      return;
    }

    // プロジェクトへのアクセス権限を確認
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
    });

    if (!project) {
      res.status(404).json({ error: 'プロジェクトが見つからないか、アクセス権限がありません' });
      return;
    }

    // ダイアグラムを取得
    const diagram = await prisma.diagram.findUnique({
      where: { id: diagramId },
    });

    if (!diagram || diagram.projectId !== projectId) {
      res.status(404).json({ error: 'ダイアグラムが見つかりません' });
      return;
    }

    res.json({ diagram });
  } catch (error) {
    console.error('Get diagram error:', error);
    res.status(500).json({ error: 'ダイアグラムの取得に失敗しました' });
  }
};

/**
 * 新規ダイアグラムを作成
 * POST /api/projects/:projectId/diagrams
 */
export const createDiagram = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: '認証が必要です' });
      return;
    }

    const { title, data } = req.body;

    // プロジェクトへのアクセス権限を確認（owner または editor）
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          { members: { some: { userId, role: { in: ['owner', 'editor'] } } } },
        ],
      },
    });

    if (!project) {
      res.status(404).json({ error: 'プロジェクトが見つからないか、編集権限がありません' });
      return;
    }

    // ダイアグラムを作成
    const diagram = await prisma.diagram.create({
      data: {
        projectId,
        title: title || '新しいダイアグラム',
        data: data || {},
      },
    });

    // アクティビティログに記録
    await prisma.activityLog.create({
      data: {
        userId,
        projectId,
        action: 'diagram_created',
        data: { diagramId: diagram.id, title: diagram.title },
      },
    });

    res.status(201).json({ diagram });
  } catch (error) {
    console.error('Create diagram error:', error);
    res.status(500).json({ error: 'ダイアグラムの作成に失敗しました' });
  }
};

/**
 * ダイアグラムを更新
 * PUT /api/projects/:projectId/diagrams/:diagramId
 */
export const updateDiagram = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, diagramId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: '認証が必要です' });
      return;
    }

    const { title, data } = req.body;

    // プロジェクトへのアクセス権限を確認（owner または editor）
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          { members: { some: { userId, role: { in: ['owner', 'editor'] } } } },
        ],
      },
    });

    if (!project) {
      res.status(404).json({ error: 'プロジェクトが見つからないか、編集権限がありません' });
      return;
    }

    // ダイアグラムの存在確認
    const existingDiagram = await prisma.diagram.findUnique({
      where: { id: diagramId },
    });

    if (!existingDiagram || existingDiagram.projectId !== projectId) {
      res.status(404).json({ error: 'ダイアグラムが見つかりません' });
      return;
    }

    // ダイアグラムを更新
    const diagram = await prisma.diagram.update({
      where: { id: diagramId },
      data: {
        ...(title !== undefined && { title }),
        ...(data !== undefined && { data }),
        version: { increment: 1 },
      },
    });

    // アクティビティログに記録
    await prisma.activityLog.create({
      data: {
        userId,
        projectId,
        action: 'diagram_updated',
        data: { diagramId: diagram.id, title: diagram.title },
      },
    });

    res.json({ diagram });
  } catch (error) {
    console.error('Update diagram error:', error);
    res.status(500).json({ error: 'ダイアグラムの更新に失敗しました' });
  }
};

/**
 * ダイアグラムを削除
 * DELETE /api/projects/:projectId/diagrams/:diagramId
 */
export const deleteDiagram = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, diagramId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: '認証が必要です' });
      return;
    }

    // プロジェクトへのアクセス権限を確認（owner または editor）
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          { members: { some: { userId, role: { in: ['owner', 'editor'] } } } },
        ],
      },
    });

    if (!project) {
      res.status(404).json({ error: 'プロジェクトが見つからないか、削除権限がありません' });
      return;
    }

    // ダイアグラムの存在確認
    const existingDiagram = await prisma.diagram.findUnique({
      where: { id: diagramId },
    });

    if (!existingDiagram || existingDiagram.projectId !== projectId) {
      res.status(404).json({ error: 'ダイアグラムが見つかりません' });
      return;
    }

    // ダイアグラムを削除
    await prisma.diagram.delete({
      where: { id: diagramId },
    });

    // アクティビティログに記録
    await prisma.activityLog.create({
      data: {
        userId,
        projectId,
        action: 'diagram_deleted',
        data: { diagramId, title: existingDiagram.title },
      },
    });

    res.json({ message: 'ダイアグラムを削除しました' });
  } catch (error) {
    console.error('Delete diagram error:', error);
    res.status(500).json({ error: 'ダイアグラムの削除に失敗しました' });
  }
};
