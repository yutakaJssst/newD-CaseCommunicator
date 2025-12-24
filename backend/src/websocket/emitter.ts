import type { Server } from 'socket.io';

let io: Server | null = null;

export const setWebSocketServer = (server: Server) => {
  io = server;
};

export const emitSurveyResponseCreated = (projectId: string, surveyId: string) => {
  if (!io) return;
  io.to(projectId).emit('survey_response_created', {
    projectId,
    surveyId,
    timestamp: new Date().toISOString(),
  });
};
