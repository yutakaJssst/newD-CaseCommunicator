import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getProjectMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
} from '../controllers/projectMemberController';

const router = Router({ mergeParams: true }); // Access :projectId from parent

router.use(authenticate);

router.get('/', getProjectMembers);
router.post('/', inviteMember);
router.put('/:memberId', updateMemberRole);
router.delete('/:memberId', removeMember);

export default router;
