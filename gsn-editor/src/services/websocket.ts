import { io, Socket } from 'socket.io-client';
import type { Node, Link } from '../types/diagram';

interface OnlineUser {
  userId: string;
  userName: string;
  socketId: string;
  joinedAt: string;
}

interface WebSocketCallbacks {
  onNodeCreated?: (node: Node, diagramId: string) => void;
  onNodeUpdated?: (node: Node, diagramId: string) => void;
  onNodeDeleted?: (nodeId: string, diagramId: string) => void;
  onNodeMoved?: (nodeId: string, position: { x: number; y: number }, diagramId: string) => void;
  onLinkCreated?: (link: Link, diagramId: string) => void;
  onLinkDeleted?: (linkId: string, diagramId: string) => void;
  onModuleCreated?: (moduleId: string, moduleData: any, parentDiagramId: string) => void;
  onUserJoined?: (user: { userId: string; userName: string; timestamp: string }) => void;
  onUserLeft?: (user: { userId: string; userName: string; timestamp: string }) => void;
  onOnlineUsers?: (users: OnlineUser[]) => void;
  onConnectionStatusChange?: (status: { connected: boolean; reconnecting: boolean; attempts: number }) => void;
}

class WebSocketService {
  private socket: Socket | null = null;
  private currentProjectId: string | null = null;
  private lastJoinPayload: { projectId: string; userId: string; userName: string } | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
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
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected:', this.socket?.id);
      this.reconnectAttempts = 0;
      this.callbacks.onConnectionStatusChange?.({
        connected: true,
        reconnecting: false,
        attempts: 0,
      });
      if (this.lastJoinPayload) {
        console.log('[WebSocket] Rejoining project after reconnect');
        this.joinProject(
          this.lastJoinPayload.projectId,
          this.lastJoinPayload.userId,
          this.lastJoinPayload.userName,
        );
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
      this.callbacks.onConnectionStatusChange?.({
        connected: false,
        reconnecting: true,
        attempts: this.reconnectAttempts,
      });
      if (reason === 'io client disconnect') {
        this.lastJoinPayload = null;
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error);
      this.reconnectAttempts += 1;
      this.callbacks.onConnectionStatusChange?.({
        connected: false,
        reconnecting: true,
        attempts: this.reconnectAttempts,
      });
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.warn('[WebSocket] Reconnect attempts exhausted');
        this.callbacks.onConnectionStatusChange?.({
          connected: false,
          reconnecting: false,
          attempts: this.reconnectAttempts,
        });
      }
    });
    this.socket.on('reconnect_attempt', (attempt) => {
      this.reconnectAttempts = attempt;
      console.log('[WebSocket] Reconnect attempt:', attempt);
      this.callbacks.onConnectionStatusChange?.({
        connected: false,
        reconnecting: true,
        attempts: attempt,
      });
    });

    this.socket.on('reconnect_failed', () => {
      console.warn('[WebSocket] Reconnect failed');
      this.callbacks.onConnectionStatusChange?.({
        connected: false,
        reconnecting: false,
        attempts: this.reconnectAttempts,
      });
    });

    // Listen to events
    this.socket.on('node_created', (data) => {
      console.log('[WebSocket] Node created:', data);
      this.callbacks.onNodeCreated?.(data.node, data.diagramId || 'root');
    });

    this.socket.on('node_updated', (data) => {
      console.log('[WebSocket] Node updated:', data);
      this.callbacks.onNodeUpdated?.(data.node, data.diagramId || 'root');
    });

    this.socket.on('node_deleted', (data) => {
      console.log('[WebSocket] Node deleted:', data);
      this.callbacks.onNodeDeleted?.(data.nodeId, data.diagramId || 'root');
    });

    this.socket.on('node_moved', (data) => {
      console.log('[WebSocket] Node moved:', data);
      this.callbacks.onNodeMoved?.(data.nodeId, data.position, data.diagramId || 'root');
    });

    this.socket.on('link_created', (data) => {
      console.log('[WebSocket] Link created:', data);
      this.callbacks.onLinkCreated?.(data.link, data.diagramId || 'root');
    });

    this.socket.on('link_deleted', (data) => {
      console.log('[WebSocket] Link deleted:', data);
      this.callbacks.onLinkDeleted?.(data.linkId, data.diagramId || 'root');
    });

    this.socket.on('module_created', (data) => {
      console.log('[WebSocket] Module created:', data);
      this.callbacks.onModuleCreated?.(data.moduleId, data.moduleData, data.parentDiagramId);
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
    this.lastJoinPayload = { projectId, userId, userName };

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
    if (this.lastJoinPayload?.projectId === projectId) {
      this.lastJoinPayload = null;
    }

    console.log('[WebSocket] Left project:', projectId);
  }

  // Emit node operations
  emitNodeCreated(projectId: string, node: Node, diagramId: string) {
    this.socket?.emit('node_created', { projectId, node, diagramId });
  }

  emitNodeUpdated(projectId: string, node: Node, diagramId: string) {
    this.socket?.emit('node_updated', { projectId, node, diagramId });
  }

  emitNodeDeleted(projectId: string, nodeId: string, diagramId: string) {
    this.socket?.emit('node_deleted', { projectId, nodeId, diagramId });
  }

  emitNodeMoved(projectId: string, nodeId: string, position: { x: number; y: number }, diagramId: string) {
    this.socket?.emit('node_moved', { projectId, nodeId, position, diagramId });
  }

  // Emit link operations
  emitLinkCreated(projectId: string, link: Link, diagramId: string) {
    this.socket?.emit('link_created', { projectId, link, diagramId });
  }

  emitLinkDeleted(projectId: string, linkId: string, diagramId: string) {
    this.socket?.emit('link_deleted', { projectId, linkId, diagramId });
  }

  // Emit module operations
  emitModuleCreated(projectId: string, moduleId: string, moduleData: any, parentDiagramId: string) {
    console.log('[WebSocket Client] Emitting module_created:', { projectId, moduleId, parentDiagramId });
    this.socket?.emit('module_created', { projectId, moduleId, moduleData, parentDiagramId });
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
