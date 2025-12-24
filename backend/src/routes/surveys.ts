import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getSurvey,
  updateSurvey,
  publishSurvey,
  closeSurvey,
  getSurveyAnalytics,
  getSurveyResponses,
} from '../controllers/surveyController';

const router = Router();

router.use(authenticate);

router.get('/:surveyId', getSurvey);
router.patch('/:surveyId', updateSurvey);
router.post('/:surveyId/publish', publishSurvey);
router.post('/:surveyId/close', closeSurvey);
router.get('/:surveyId/analytics', getSurveyAnalytics);
router.get('/:surveyId/responses', getSurveyResponses);

export default router;
