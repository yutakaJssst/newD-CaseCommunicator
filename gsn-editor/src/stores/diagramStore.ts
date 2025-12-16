import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
  history: DiagramData[];
  historyIndex: number;

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

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  exportData: () => DiagramData;
  importData: (data: DiagramData) => void;
  reset: () => void;
}

const generateId = () => `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const generateLinkId = () => `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// 履歴管理用のヘルパー関数
const saveToHistory = (get: () => DiagramStore, set: (state: Partial<DiagramStore>) => void) => {
  const state = get();
  const currentSnapshot: DiagramData = {
    version: '1.0.0',
    title: state.title,
    nodes: state.nodes,
    links: state.links,
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };

  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(currentSnapshot);

  // 履歴は最大50件まで保持
  if (newHistory.length > 50) {
    newHistory.shift();
  }

  set({
    history: newHistory,
    historyIndex: newHistory.length - 1,
  });
};

export const useDiagramStore = create<DiagramStore>()(
  persist(
    (set, get) => ({
      // Initial state
      title: '新しいGSN図',
      nodes: [],
      links: [],
      canvasState: DEFAULT_CANVAS_STATE,
      history: [],
      historyIndex: -1,

      // Actions
      setTitle: (title) => {
        saveToHistory(get, set);
        set({ title });
      },

      addNode: (type, x, y) => {
        saveToHistory(get, set);
        const newNode: Node = {
          id: generateId(),
          type,
          position: { x, y },
          size: { ...DEFAULT_NODE_SIZE },
          content: '',
          style: {
            fillColor: NODE_COLORS[type],
            borderColor: '#374151',
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
        saveToHistory(get, set);
        set((state) => ({
          nodes: state.nodes.map((node) =>
            node.id === id ? { ...node, ...updates } : node
          ),
        }));
      },

      deleteNode: (id) => {
        saveToHistory(get, set);
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
        // 移動は履歴に保存しない（頻繁すぎるため）
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

        saveToHistory(get, set);
        const newLink: Link = {
          id: generateLinkId(),
          source: sourceId,
          target: targetId,
          type,
          style: {
            color: '#1F2937',
            width: 2,
          },
        };

        set((state) => ({
          links: [...state.links, newLink],
        }));
      },

      deleteLink: (id) => {
        saveToHistory(get, set);
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

      undo: () => {
        const state = get();
        if (state.historyIndex > 0) {
          const previousState = state.history[state.historyIndex - 1];
          set({
            title: previousState.title,
            nodes: previousState.nodes,
            links: previousState.links,
            historyIndex: state.historyIndex - 1,
          });
        }
      },

      redo: () => {
        const state = get();
        if (state.historyIndex < state.history.length - 1) {
          const nextState = state.history[state.historyIndex + 1];
          set({
            title: nextState.title,
            nodes: nextState.nodes,
            links: nextState.links,
            historyIndex: state.historyIndex + 1,
          });
        }
      },

      canUndo: () => {
        const state = get();
        return state.historyIndex > 0;
      },

      canRedo: () => {
        const state = get();
        return state.historyIndex < state.history.length - 1;
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
        saveToHistory(get, set);
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
          history: [],
          historyIndex: -1,
        });
      },
    }),
    {
      name: 'gsn-diagram-storage',
      partialize: (state) => ({
        title: state.title,
        nodes: state.nodes,
        links: state.links,
      }),
    }
  )
);
