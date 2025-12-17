import { io, Socket } from 'socket.io-client';
import type { Node, Link } from '../types/diagram';

interface OnlineUser {
  userId: string;
  userName: string;
  socketId: string;
  joinedAt: string;
}

interface WebSocketCallbacks {
  onNodeCreated?: (node: Node) => void;
  onNodeUpdated?: (node: Node) => void;
  onNodeDeleted?: (nodeId: string) => void;
  onNodeMoved?: (nodeId: string, position: { x: number; y: number }) => void;
  onLinkCreated?: (link: Link) => void;
  onLinkDeleted?: (linkId: string) => void;
  onUserJoined?: (user: { userId: string; userName: string; timestamp: string }) => void;
  onUserLeft?: (user: { userId: string; userName: string; timestamp: string }) => void;
  onOnlineUsers?: (users: OnlineUser[]) => void;
}

class WebSocketService {
  private socket: Socket | null = null;
  private currentProjectId: string | null = null;
  private callbacks: WebSocketCallbacks = {};

  connect() {
    if (this.socket?.connected) {
      console.log('[WebSocket] Already connected');
      return;
    }

    this.socket = io('http://localhost:3001', {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error);
    });

    // Listen to events
    this.socket.on('node_created', (data) => {
      console.log('[WebSocket] Node created:', data);
      this.callbacks.onNodeCreated?.(data.node);
    });

    this.socket.on('node_updated', (data) => {
      console.log('[WebSocket] Node updated:', data);
      this.callbacks.onNodeUpdated?.(data.node);
    });

    this.socket.on('node_deleted', (data) => {
      console.log('[WebSocket] Node deleted:', data);
      this.callbacks.onNodeDeleted?.(data.nodeId);
    });

    this.socket.on('node_moved', (data) => {
      console.log('[WebSocket] Node moved:', data);
      this.callbacks.onNodeMoved?.(data.nodeId, data.position);
    });

    this.socket.on('link_created', (data) => {
      console.log('[WebSocket] Link created:', data);
      this.callbacks.onLinkCreated?.(data.link);
    });

    this.socket.on('link_deleted', (data) => {
      console.log('[WebSocket] Link deleted:', data);
      this.callbacks.onLinkDeleted?.(data.linkId);
    });

    this.socket.on('user_joined', (data) => {
      console.log('[WebSocket] User joined:', data);
      this.callbacks.onUserJoined?.(data);
    });

    this.socket.on('user_left', (data) => {
      console.log('[WebSocket] User left:', data);
      this.callbacks.onUserLeft?.(data);
    });

    this.socket.on('online_users', (users: OnlineUser[]) => {
      console.log('[WebSocket] Online users:', users);
      this.callbacks.onOnlineUsers?.(users);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.currentProjectId = null;
    }
  }

  joinProject(projectId: string, userId: string, userName: string) {
    if (!this.socket?.connected) {
      console.error('[WebSocket] Not connected');
      return;
    }

    if (this.currentProjectId === projectId) {
      console.log('[WebSocket] Already in project:', projectId);
      return;
    }

    // Leave previous project if any
    if (this.currentProjectId) {
      this.leaveProject(this.currentProjectId);
    }

    this.currentProjectId = projectId;

    this.socket.emit('join_project', {
      projectId,
      userId,
      userName,
    });

    console.log('[WebSocket] Joined project:', projectId);
  }

  leaveProject(projectId: string) {
    if (!this.socket?.connected) {
      return;
    }

    this.socket.emit('leave_project', { projectId });
    this.currentProjectId = null;

    console.log('[WebSocket] Left project:', projectId);
  }

  // Emit node operations
  emitNodeCreated(projectId: string, node: Node) {
    this.socket?.emit('node_created', { projectId, node });
  }

  emitNodeUpdated(projectId: string, node: Node) {
    this.socket?.emit('node_updated', { projectId, node });
  }

  emitNodeDeleted(projectId: string, nodeId: string) {
    this.socket?.emit('node_deleted', { projectId, nodeId });
  }

  emitNodeMoved(projectId: string, nodeId: string, position: { x: number; y: number }) {
    this.socket?.emit('node_moved', { projectId, nodeId, position });
  }

  // Emit link operations
  emitLinkCreated(projectId: string, link: Link) {
    this.socket?.emit('link_created', { projectId, link });
  }

  emitLinkDeleted(projectId: string, linkId: string) {
    this.socket?.emit('link_deleted', { projectId, linkId });
  }

  // Register callbacks
  setCallbacks(callbacks: WebSocketCallbacks) {
    this.callbacks = callbacks;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  getCurrentProjectId(): string | null {
    return this.currentProjectId;
  }
}

// Singleton instance
export const websocketService = new WebSocketService();
