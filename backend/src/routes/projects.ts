import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
} from '../controllers/projectController';
import diagramRoutes from './diagrams';
import memberRoutes from './projectMembers';

const router = Router();

// All project routes require authentication
router.use(authenticate);

// Project CRUD operations
router.get('/', getProjects);
router.get('/:projectId', getProject);
router.post('/', createProject);
router.put('/:projectId', updateProject);
router.delete('/:projectId', deleteProject);

// Nested diagram routes
router.use('/:projectId/diagrams', diagramRoutes);

// Nested member routes
router.use('/:projectId/members', memberRoutes);

export default router;
