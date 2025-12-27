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
import projectSurveyRoutes from './projectSurveys';
import projectAiRoutes from './projectAi';

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

// Nested survey routes
router.use('/:projectId/surveys', projectSurveyRoutes);

// Nested AI routes
router.use('/:projectId/ai', projectAiRoutes);

export default router;
