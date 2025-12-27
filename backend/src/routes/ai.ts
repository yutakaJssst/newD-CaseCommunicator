import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  deleteAiCredential,
  getAiCredentials,
  setAiCredential,
} from '../controllers/aiCredentialController';

const router = Router();

router.use(authenticate);

router.get('/credentials', getAiCredentials);
router.post('/credentials', setAiCredential);
router.delete('/credentials/:provider', deleteAiCredential);

export default router;
