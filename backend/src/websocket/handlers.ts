import { Server, Socket } from 'socket.io';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userName?: string;
  currentProjectId?: string;
}

interface OnlineUser {
  userId: string;
  userName: string;
  socketId: string;
  joinedAt: string;
}

// Track online users per project (Map key is socketId, not userId)
const onlineUsers = new Map<string, Map<string, OnlineUser>>();

// Get online users for a project
const getOnlineUsers = (projectId: string): OnlineUser[] => {
  const projectUsers = onlineUsers.get(projectId);
  return projectUsers ? Array.from(projectUsers.values()) : [];
};

// Add user to online users (use socketId as key to allow multiple connections per user)
const addOnlineUser = (projectId: string, user: OnlineUser) => {
  if (!onlineUsers.has(projectId)) {
    onlineUsers.set(projectId, new Map());
  }
  onlineUsers.get(projectId)!.set(user.socketId, user);
};

// Remove user from online users (use socketId as key)
const removeOnlineUser = (projectId: string, socketId: string) => {
  const projectUsers = onlineUsers.get(projectId);
  if (projectUsers) {
    projectUsers.delete(socketId);
    if (projectUsers.size === 0) {
      onlineUsers.delete(projectId);
    }
  }
};

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

      // Add to online users
      addOnlineUser(projectId, {
        userId,
        userName,
        socketId: socket.id,
        joinedAt: new Date().toISOString(),
      });

      // Get current online users
      const currentUsers = getOnlineUsers(projectId);

      // Send current online users to the joining user
      socket.emit('online_users', currentUsers);

      // Notify other users in the room
      socket.to(projectId).emit('user_joined', {
        userId,
        userName,
        timestamp: new Date().toISOString(),
      });

      console.log(`[WebSocket] Project ${projectId} now has ${currentUsers.length} users online`);
    });

    // Handle leave_project
    socket.on('leave_project', ({ projectId }) => {
      console.log(`[WebSocket] User ${socket.userName} left project ${projectId}`);

      removeOnlineUser(projectId, socket.id);

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

    // Handle module operations
    socket.on('module_created', (data) => {
      console.log(`[WebSocket] Module created in project ${data.projectId}`);
      socket.to(data.projectId).emit('module_created', data);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);

      if (socket.currentProjectId) {
        removeOnlineUser(socket.currentProjectId, socket.id);

        socket.to(socket.currentProjectId).emit('user_left', {
          userId: socket.userId,
          userName: socket.userName,
          timestamp: new Date().toISOString(),
        });
      }
    });
  });
};
