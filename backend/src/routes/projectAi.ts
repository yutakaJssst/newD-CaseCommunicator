import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, requireProjectAccess } from '../middleware/auth';
import {
  chatWithAi,
  createConversation,
  getConversationMessages,
  uploadAttachment,
} from '../controllers/projectAiController';

const router = Router({ mergeParams: true });

const uploadRoot = path.join(process.cwd(), 'uploads', 'ai');

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const projectId = req.params.projectId;
    const folder = path.join(uploadRoot, projectId);
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error('Unsupported file type'));
      return;
    }
    cb(null, true);
  },
});

router.use(authenticate);
router.use(requireProjectAccess('editor'));

router.post('/conversations', createConversation);
router.get('/conversations/:conversationId/messages', getConversationMessages);
router.post('/attachments', upload.single('file'), uploadAttachment);
router.post('/chat', chatWithAi);

export default router;
