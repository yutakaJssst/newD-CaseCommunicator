import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import patternRoutes from './routes/patterns';
import surveyRoutes from './routes/surveys';
import surveyPublicRoutes from './routes/surveysPublic';
import aiRoutes from './routes/ai';
import { errorHandler } from './middleware/errorHandler';
import { setupWebSocket } from './websocket/handlers';
import { setWebSocketServer } from './websocket/emitter';
import { requestContext } from './middleware/requestContext';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);

// Get CORS origins from environment variable
const corsOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:5174'];

// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(requestContext);
app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Routes
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/patterns', patternRoutes);
app.use('/api/surveys/public', surveyPublicRoutes);
app.use('/api/surveys', surveyRoutes);
app.use('/api/ai', aiRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Setup WebSocket handlers
setWebSocketServer(io);
setupWebSocket(io);

// Start server
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

httpServer.listen(PORT, HOST, () => {
  const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`🚀 Server running on http://${displayHost}:${PORT}`);
  console.log(`🔌 WebSocket server ready`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('HTTP server closed');
  });
});
