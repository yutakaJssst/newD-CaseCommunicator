import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listProjectSurveys,
  createSurvey,
} from '../controllers/surveyController';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/', listProjectSurveys);
router.post('/', createSurvey);

export default router;
