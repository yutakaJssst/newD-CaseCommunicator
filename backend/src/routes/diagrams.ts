import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getDiagrams,
  getDiagram,
  createDiagram,
  updateDiagram,
  deleteDiagram,
} from '../controllers/diagramController';

const router = Router({ mergeParams: true }); // Allow access to :projectId from parent router

// All diagram routes require authentication
router.use(authenticate);

// Diagram CRUD operations
router.get('/', getDiagrams);
router.get('/:diagramId', getDiagram);
router.post('/', createDiagram);
router.put('/:diagramId', updateDiagram);
router.delete('/:diagramId', deleteDiagram);

export default router;
