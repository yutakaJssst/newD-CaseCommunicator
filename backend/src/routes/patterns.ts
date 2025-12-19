import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getPatterns,
  getPattern,
  createPattern,
  updatePattern,
  deletePattern,
} from '../controllers/patternController';

const router = Router();

// すべてのパターンルートは認証必須
router.use(authenticate);

// パターン一覧取得
router.get('/', getPatterns);

// パターン詳細取得
router.get('/:id', getPattern);

// パターン作成
router.post('/', createPattern);

// パターン更新
router.put('/:id', updatePattern);

// パターン削除
router.delete('/:id', deletePattern);

export default router;
