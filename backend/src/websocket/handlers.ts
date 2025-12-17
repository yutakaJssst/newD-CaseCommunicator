import { Server, Socket } from 'socket.io';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userName?: string;
  currentProjectId?: string;
}

export const setupWebSocket = (io: Server) => {
  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // Handle join_project
    socket.on('join_project', ({ projectId, userId, userName }) => {
      console.log(`[WebSocket] User ${userName} (${userId}) joined project ${projectId}`);

      socket.userId = userId;
      socket.userName = userName;
      socket.currentProjectId = projectId;

      // Join the project room
      socket.join(projectId);

      // Notify other users in the room
      socket.to(projectId).emit('user_joined', {
        userId,
        userName,
        timestamp: new Date().toISOString(),
      });

      // Send current online users to the joining user
      // TODO: Implement online users tracking
    });

    // Handle leave_project
    socket.on('leave_project', ({ projectId }) => {
      console.log(`[WebSocket] User ${socket.userName} left project ${projectId}`);

      socket.leave(projectId);

      // Notify other users
      socket.to(projectId).emit('user_left', {
        userId: socket.userId,
        userName: socket.userName,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle node operations
    socket.on('node_created', (data) => {
      console.log(`[WebSocket] Node created in project ${data.projectId}`);

      // Broadcast to other users in the same project
      socket.to(data.projectId).emit('node_created', data);
    });

    socket.on('node_updated', (data) => {
      socket.to(data.projectId).emit('node_updated', data);
    });

    socket.on('node_deleted', (data) => {
      socket.to(data.projectId).emit('node_deleted', data);
    });

    socket.on('node_moved', (data) => {
      socket.to(data.projectId).emit('node_moved', data);
    });

    // Handle link operations
    socket.on('link_created', (data) => {
      socket.to(data.projectId).emit('link_created', data);
    });

    socket.on('link_deleted', (data) => {
      socket.to(data.projectId).emit('link_deleted', data);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);

      if (socket.currentProjectId) {
        socket.to(socket.currentProjectId).emit('user_left', {
          userId: socket.userId,
          userName: socket.userName,
          timestamp: new Date().toISOString(),
        });
      }
    });
  });
};
