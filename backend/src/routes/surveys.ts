import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getSurvey,
  publishSurvey,
  closeSurvey,
  getSurveyAnalytics,
} from '../controllers/surveyController';

const router = Router();

router.use(authenticate);

router.get('/:surveyId', getSurvey);
router.post('/:surveyId/publish', publishSurvey);
router.post('/:surveyId/close', closeSurvey);
router.get('/:surveyId/analytics', getSurveyAnalytics);

export default router;
