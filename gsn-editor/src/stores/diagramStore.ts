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
  currentDiagramId: string;
  modules: Record<string, DiagramData>;

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

  convertToModule: (goalId: string) => void;
  switchToModule: (moduleId: string) => void;
  switchToParent: () => void;

  exportData: () => DiagramData;
  importData: (data: DiagramData) => void;
  reset: () => void;
}

const generateId = () => `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const generateLinkId = () => `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const generateModuleId = () => `module_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// サブツリー抽出用のヘルパー関数（子孫ノードとリンクを再帰的に取得）
const getSubtree = (rootId: string, nodes: Node[], links: Link[]): { nodes: Node[], links: Link[] } => {
  const subtreeNodes: Node[] = [];
  const subtreeLinks: Link[] = [];
  const visited = new Set<string>();

  const traverse = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      subtreeNodes.push(node);

      // このノードから出るリンク（子ノードへのリンク）を探す
      const childLinks = links.filter(l => l.source === nodeId);
      childLinks.forEach(link => {
        subtreeLinks.push(link);
        traverse(link.target);
      });
    }
  };

  traverse(rootId);
  return { nodes: subtreeNodes, links: subtreeLinks };
};

// モジュール内のトップゴール（ルートノード）を取得
const getTopGoal = (nodes: Node[], links: Link[]): Node | null => {
  if (nodes.length === 0) return null;

  // Goalノードのみをフィルタ
  const goalNodes = nodes.filter(n => n.type === 'Goal');
  if (goalNodes.length === 0) return null;

  // 親を持たないノード（どのリンクのtargetにもなっていない）を探す
  const rootNodes = goalNodes.filter(node =>
    !links.some(link => link.target === node.id)
  );

  // ルートノードが1つだけの場合はそれを返す
  if (rootNodes.length === 1) {
    return rootNodes[0];
  }

  // 複数のルートがある場合は最初のGoalノードを返す
  return goalNodes[0];
};

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
      id: state.currentDiagramId,
      isModule: false,
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
      currentDiagramId: 'root',
      modules: {},

      // Actions
      setTitle: (title) => {
        saveToHistory(get, set);
        set({ title });
      },

      addNode: (type, x, y) => {
        saveToHistory(get, set);
        const state = get();
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

        // Moduleノードの場合、空のモジュールを作成
        if (type === 'Module') {
          const moduleId = generateModuleId();
          const moduleData: DiagramData = {
            version: '1.0.0',
            title: '新しいモジュール',
            nodes: [],
            links: [],
            metadata: {
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              id: moduleId,
              parentModuleId: state.currentDiagramId,
              isModule: true,
            },
          };

          newNode.moduleId = moduleId;
          newNode.moduleName = moduleData.title;
          newNode.content = '新しいモジュール';

          set({
            nodes: [...state.nodes, newNode],
            modules: {
              ...state.modules,
              [moduleId]: moduleData,
            },
            canvasState: {
              ...state.canvasState,
              mode: 'select',
              selectedNodeType: undefined,
            },
          });
        } else {
          set((state) => ({
            nodes: [...state.nodes, newNode],
            canvasState: {
              ...state.canvasState,
              mode: 'select',
              selectedNodeType: undefined,
            },
          }));
        }
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

      convertToModule: (goalId) => {
        saveToHistory(get, set);
        const state = get();
        const goalNode = state.nodes.find(n => n.id === goalId && n.type === 'Goal');

        if (!goalNode) {
          console.error('Goal node not found');
          return;
        }

        // サブツリー抽出
        const { nodes: subtreeNodes, links: subtreeLinks } = getSubtree(goalId, state.nodes, state.links);

        // モジュールIDとデータ作成
        const moduleId = generateModuleId();
        const moduleName = goalNode.content || 'モジュール';
        const moduleData: DiagramData = {
          version: '1.0.0',
          title: moduleName.replace(/<[^>]*>/g, '').substring(0, 50), // HTML削除
          nodes: subtreeNodes,
          links: subtreeLinks,
          metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            id: moduleId,
            parentModuleId: state.currentDiagramId,
            isModule: true,
          },
        };

        // モジュールノード作成（元のGoalと同じ位置）
        const moduleNode: Node = {
          ...goalNode,
          id: generateId(),
          type: 'Module',
          moduleId,
          moduleName: moduleData.title,
          style: {
            fillColor: NODE_COLORS.Module,
            borderColor: '#374151',
            borderWidth: 2,
          },
        };

        // 親からこのGoalへのリンクを探す
        const parentLinks = state.links.filter(l => l.target === goalId);

        // 新しいリンク作成（親 → モジュールノード）
        const newLinks = parentLinks.map(link => ({
          ...link,
          id: generateLinkId(),
          target: moduleNode.id,
        }));

        // 状態更新
        set({
          nodes: [
            ...state.nodes.filter(n => !subtreeNodes.find(sn => sn.id === n.id)),
            moduleNode,
          ],
          links: [
            ...state.links.filter(l =>
              !subtreeLinks.find(sl => sl.id === l.id) &&
              !parentLinks.find(pl => pl.id === l.id)
            ),
            ...newLinks,
          ],
          modules: {
            ...state.modules,
            [moduleId]: moduleData,
          },
        });
      },

      switchToModule: (moduleId) => {
        const state = get();
        const moduleData = state.modules[moduleId];

        if (!moduleData) {
          console.error('Module not found');
          return;
        }

        // 現在のダイアグラムを保存
        const currentData: DiagramData = {
          version: '1.0.0',
          title: state.title,
          nodes: state.nodes,
          links: state.links,
          metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            id: state.currentDiagramId,
            isModule: state.currentDiagramId !== 'root',
          },
        };

        // モジュールに切り替え
        set({
          title: moduleData.title,
          nodes: moduleData.nodes,
          links: moduleData.links,
          currentDiagramId: moduleId,
          modules: {
            ...state.modules,
            [state.currentDiagramId]: currentData,
          },
          canvasState: DEFAULT_CANVAS_STATE,
        });
      },

      switchToParent: () => {
        const state = get();
        const currentMetadata = state.modules[state.currentDiagramId]?.metadata;

        if (!currentMetadata?.parentModuleId) {
          console.error('No parent module found');
          return;
        }

        const parentId = currentMetadata.parentModuleId;
        const parentData = state.modules[parentId];

        if (!parentData) {
          console.error('Parent module data not found');
          return;
        }

        // 現在のダイアグラムを保存
        const currentData: DiagramData = {
          version: '1.0.0',
          title: state.title,
          nodes: state.nodes,
          links: state.links,
          metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            id: state.currentDiagramId,
            isModule: true,
            parentModuleId: currentMetadata.parentModuleId,
          },
        };

        // トップゴールを取得して、親ダイアグラムのモジュールノードを更新
        const topGoal = getTopGoal(state.nodes, state.links);
        const updatedParentNodes = parentData.nodes.map(node => {
          if (node.type === 'Module' && node.moduleId === state.currentDiagramId) {
            return {
              ...node,
              content: topGoal?.content || node.content,
              moduleName: topGoal?.content ? topGoal.content.replace(/<[^>]*>/g, '').substring(0, 50) : node.moduleName,
            };
          }
          return node;
        });

        // 親に切り替え
        set({
          title: parentData.title,
          nodes: updatedParentNodes,
          links: parentData.links,
          currentDiagramId: parentId,
          modules: {
            ...state.modules,
            [state.currentDiagramId]: currentData,
          },
          canvasState: DEFAULT_CANVAS_STATE,
        });
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
            id: state.currentDiagramId,
            isModule: false,
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
          currentDiagramId: 'root',
          modules: {},
        });
      },
    }),
    {
      name: 'gsn-diagram-storage',
      partialize: (state) => ({
        title: state.title,
        nodes: state.nodes,
        links: state.links,
        currentDiagramId: state.currentDiagramId,
        modules: state.modules,
      }),
    }
  )
);
