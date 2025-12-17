import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

// All diagram routes require authentication
router.use(authenticate);

// TODO: Implement diagram controllers
router.get('/:projectId/diagrams/:diagramId', (_req, res) => {
  res.json({ result: 'OK', message: 'Diagram retrieval not yet implemented' });
});

export default router;
