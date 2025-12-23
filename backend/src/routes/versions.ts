import express from 'express';
import { authenticate } from '../middleware/auth';
import {
  getVersions,
  getVersion,
  createVersion,
  restoreVersion,
  deleteVersion,
} from '../controllers/versionController';

const router = express.Router({ mergeParams: true });

// 全エンドポイントで認証必須
router.use(authenticate);

// GET /api/diagrams/:diagramId/versions - バージョン一覧取得
router.get('/', getVersions);

// GET /api/diagrams/:diagramId/versions/:versionId - 特定バージョン取得
router.get('/:versionId', getVersion);

// POST /api/diagrams/:diagramId/versions - バージョン作成（コミット）
router.post('/', createVersion);

// POST /api/diagrams/:diagramId/versions/:versionId/restore - バージョンへのロールバック
router.post('/:versionId/restore', restoreVersion);

// DELETE /api/diagrams/:diagramId/versions/:versionId - バージョン削除
router.delete('/:versionId', deleteVersion);

export default router;
