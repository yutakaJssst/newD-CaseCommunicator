import { create } from 'zustand';
import type {
  Node,
  Link,
  DiagramData,
  CanvasState,
  NodeType,
} from '../types/diagram';
import {
  DEFAULT_CANVAS_STATE,
  DEFAULT_NODE_SIZE,
  NODE_COLORS,
} from '../types/diagram';

interface DiagramStore {
  // State
  title: string;
  nodes: Node[];
  links: Link[];
  canvasState: CanvasState;

  // Actions
  setTitle: (title: string) => void;
  addNode: (type: NodeType, x: number, y: number) => void;
  updateNode: (id: string, updates: Partial<Node>) => void;
  deleteNode: (id: string) => void;
  moveNode: (id: string, x: number, y: number) => void;

  addLink: (sourceId: string, targetId: string, type: 'solid' | 'dashed') => void;
  deleteLink: (id: string) => void;

  setCanvasMode: (mode: CanvasState['mode']) => void;
  setSelectedNodeType: (type: NodeType | undefined) => void;
  setViewport: (viewport: Partial<CanvasState['viewport']>) => void;
  selectNode: (id: string) => void;
  deselectNode: (id: string) => void;
  clearSelection: () => void;

  exportData: () => DiagramData;
  importData: (data: DiagramData) => void;
  reset: () => void;
}

const generateId = () => `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const generateLinkId = () => `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useDiagramStore = create<DiagramStore>((set, get) => ({
  // Initial state
  title: '新しいGSN図',
  nodes: [],
  links: [],
  canvasState: DEFAULT_CANVAS_STATE,

  // Actions
  setTitle: (title) => set({ title }),

  addNode: (type, x, y) => {
    const newNode: Node = {
      id: generateId(),
      type,
      position: { x, y },
      size: { ...DEFAULT_NODE_SIZE },
      content: '',
      style: {
        fillColor: NODE_COLORS[type],
        borderColor: '#0000FF',
        borderWidth: 2,
      },
    };
    set((state) => ({
      nodes: [...state.nodes, newNode],
      canvasState: {
        ...state.canvasState,
        mode: 'select',
        selectedNodeType: undefined,
      },
    }));
  },

  updateNode: (id, updates) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, ...updates } : node
      ),
    }));
  },

  deleteNode: (id) => {
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== id),
      links: state.links.filter((link) => link.source !== id && link.target !== id),
      canvasState: {
        ...state.canvasState,
        selectedNodes: state.canvasState.selectedNodes.filter((nodeId) => nodeId !== id),
      },
    }));
  },

  moveNode: (id, x, y) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, position: { x, y } } : node
      ),
    }));
  },

  addLink: (sourceId, targetId, type) => {
    // Check if link already exists
    const existingLink = get().links.find(
      (link) => link.source === sourceId && link.target === targetId
    );

    if (existingLink) {
      console.warn('Link already exists');
      return;
    }

    const newLink: Link = {
      id: generateLinkId(),
      source: sourceId,
      target: targetId,
      type,
      style: {
        color: '#0000FF',
        width: 2,
      },
    };

    set((state) => ({
      links: [...state.links, newLink],
    }));
  },

  deleteLink: (id) => {
    set((state) => ({
      links: state.links.filter((link) => link.id !== id),
    }));
  },

  setCanvasMode: (mode) => {
    set((state) => ({
      canvasState: {
        ...state.canvasState,
        mode,
        selectedNodeType: mode === 'addNode' ? state.canvasState.selectedNodeType : undefined,
      },
    }));
  },

  setSelectedNodeType: (type) => {
    set((state) => ({
      canvasState: {
        ...state.canvasState,
        selectedNodeType: type,
        mode: type ? 'addNode' : 'select',
      },
    }));
  },

  setViewport: (viewport) => {
    set((state) => ({
      canvasState: {
        ...state.canvasState,
        viewport: {
          ...state.canvasState.viewport,
          ...viewport,
        },
      },
    }));
  },

  selectNode: (id) => {
    set((state) => ({
      canvasState: {
        ...state.canvasState,
        selectedNodes: [...state.canvasState.selectedNodes, id],
      },
    }));
  },

  deselectNode: (id) => {
    set((state) => ({
      canvasState: {
        ...state.canvasState,
        selectedNodes: state.canvasState.selectedNodes.filter((nodeId) => nodeId !== id),
      },
    }));
  },

  clearSelection: () => {
    set((state) => ({
      canvasState: {
        ...state.canvasState,
        selectedNodes: [],
      },
    }));
  },

  exportData: () => {
    const state = get();
    return {
      version: '1.0.0',
      title: state.title,
      nodes: state.nodes,
      links: state.links,
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  },

  importData: (data) => {
    set({
      title: data.title,
      nodes: data.nodes,
      links: data.links,
      canvasState: DEFAULT_CANVAS_STATE,
    });
  },

  reset: () => {
    set({
      title: '新しいGSN図',
      nodes: [],
      links: [],
      canvasState: DEFAULT_CANVAS_STATE,
    });
  },
}));
