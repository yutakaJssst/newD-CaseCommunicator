import { Router } from 'express';
import {
  getPublicSurvey,
  submitPublicResponse,
} from '../controllers/surveyPublicController';

const router = Router();

router.get('/:token', getPublicSurvey);
router.post('/:token/response', submitPublicResponse);

export default router;
