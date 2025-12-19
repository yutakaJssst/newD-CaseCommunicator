import { Response } from 'express';
import { prisma } from '../db/prisma';
import { AuthRequest } from '../middleware/auth';

// パターン一覧取得（自分のパターン + 公開パターン）
export const getPatterns = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    const patterns = await prisma.pattern.findMany({
      where: {
        OR: [
          { authorId: userId }, // 自分のパターン
          { isPublic: true },   // 公開パターン
        ],
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    res.json({ patterns });
  } catch (error) {
    console.error('Error fetching patterns:', error);
    res.status(500).json({ error: 'パターンの取得に失敗しました' });
  }
};

// パターン詳細取得
export const getPattern = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const pattern = await prisma.pattern.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!pattern) {
      res.status(404).json({ error: 'パターンが見つかりません' });
      return;
    }

    // 非公開パターンは作成者のみアクセス可能
    if (!pattern.isPublic && pattern.authorId !== userId) {
      res.status(403).json({ error: 'このパターンにアクセスする権限がありません' });
      return;
    }

    res.json({ pattern });
  } catch (error) {
    console.error('Error fetching pattern:', error);
    res.status(500).json({ error: 'パターンの取得に失敗しました' });
  }
};

// パターン作成
export const createPattern = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { name, description, data, isPublic } = req.body;

    if (!name) {
      res.status(400).json({ error: 'パターン名は必須です' });
      return;
    }

    if (!data || !data.nodes || !Array.isArray(data.nodes)) {
      res.status(400).json({ error: 'パターンデータが不正です' });
      return;
    }

    const pattern = await prisma.pattern.create({
      data: {
        name,
        description: description || null,
        data,
        isPublic: isPublic || false,
        authorId: userId!,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    res.status(201).json({ pattern });
  } catch (error) {
    console.error('Error creating pattern:', error);
    res.status(500).json({ error: 'パターンの作成に失敗しました' });
  }
};

// パターン更新（作成者のみ）
export const updatePattern = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const { name, description, data, isPublic } = req.body;

    // パターンの存在確認
    const existingPattern = await prisma.pattern.findUnique({
      where: { id },
    });

    if (!existingPattern) {
      res.status(404).json({ error: 'パターンが見つかりません' });
      return;
    }

    // 作成者のみ更新可能
    if (existingPattern.authorId !== userId) {
      res.status(403).json({ error: 'このパターンを更新する権限がありません' });
      return;
    }

    const pattern = await prisma.pattern.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existingPattern.name,
        description: description !== undefined ? description : existingPattern.description,
        data: data !== undefined ? data : existingPattern.data,
        isPublic: isPublic !== undefined ? isPublic : existingPattern.isPublic,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    res.json({ pattern });
  } catch (error) {
    console.error('Error updating pattern:', error);
    res.status(500).json({ error: 'パターンの更新に失敗しました' });
  }
};

// パターン削除（作成者のみ）
export const deletePattern = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    // パターンの存在確認
    const existingPattern = await prisma.pattern.findUnique({
      where: { id },
    });

    if (!existingPattern) {
      res.status(404).json({ error: 'パターンが見つかりません' });
      return;
    }

    // 作成者のみ削除可能
    if (existingPattern.authorId !== userId) {
      res.status(403).json({ error: 'このパターンを削除する権限がありません' });
      return;
    }

    await prisma.pattern.delete({
      where: { id },
    });

    res.json({ message: 'パターンを削除しました' });
  } catch (error) {
    console.error('Error deleting pattern:', error);
    res.status(500).json({ error: 'パターンの削除に失敗しました' });
  }
};
