import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

// All project routes require authentication
router.use(authenticate);

// TODO: Implement project controllers
router.get('/', (_req, res) => {
  res.json({ result: 'OK', projects: [] });
});

router.post('/', (_req, res) => {
  res.json({ result: 'OK', message: 'Project creation not yet implemented' });
});

export default router;
