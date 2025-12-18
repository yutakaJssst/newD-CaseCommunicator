import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Node,
  Link,
  DiagramData,
  ProjectData,
  CanvasState,
  NodeType,
} from '../types/diagram';
import {
  DEFAULT_CANVAS_STATE,
  DEFAULT_NODE_SIZE,
  NODE_COLORS,
} from '../types/diagram';
import { autoLayout } from '../utils/autoLayout';
import { diagramsApi } from '../api/diagrams';
import { websocketService } from '../services/websocket';

interface OnlineUser {
  userId: string;
  userName: string;
  socketId: string;
  joinedAt: string;
}

interface DiagramStore {
  // State
  currentProjectId: string | null;
  currentDiagramDbId: string | null; // DBに保存されているダイアグラムのID
  isSyncing: boolean; // DB同期中フラグ
  lastSyncedAt: string | null; // 最後の同期日時
  isWebSocketConnected: boolean; // WebSocket接続状態
  onlineUsers: OnlineUser[]; // プロジェクトに接続中のユーザー
  title: string;
  nodes: Node[];
  links: Link[];
  canvasState: CanvasState;
  history: DiagramData[];
  historyIndex: number;
  currentDiagramId: string;
  modules: Record<string, DiagramData>;
  labelCounters: Record<NodeType, number>;
  clipboard: Node[]; // コピーしたノードを保存
  isReconnecting: boolean;
  reconnectAttempts: number;

  // Actions
  setCurrentProject: (projectId: string | null) => void;
  initializeWebSocket: (userId: string, userName: string) => void;
  disconnectWebSocket: () => void;
  loadDiagramFromDB: (projectId: string, diagramId?: string) => Promise<void>;
  saveDiagramToDB: () => Promise<void>;
  createDiagramInDB: (title: string) => Promise<void>;
  migrateLocalStorageToDB: (projectId: string) => Promise<boolean>; // 移行が成功したらtrue
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
  selectAll: () => void;
  deleteSelectedNodes: () => void;
  moveSelectedNodes: (dx: number, dy: number) => void;
  copySelectedNodes: () => void;
  copyNodeTree: (nodeId: string) => void;
  pasteNodes: () => void;
  toggleGridSnap: () => void;
  fitToScreen: () => void;
  zoomToSelection: () => void;
  resetZoom: () => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  convertToModule: (goalId: string) => void;
  switchToModule: (moduleId: string) => void;
  switchToParent: () => void;
  switchToDiagram: (diagramId: string) => void;

  exportData: () => DiagramData;
  importData: (data: DiagramData) => void;
  exportProjectData: () => ProjectData;
  importProjectData: (data: ProjectData) => void;
  exportAsImage: (format: 'png' | 'svg') => void;
  applyAutoLayout: () => void;
  reset: () => void;
}

type ProjectStateSlice = Pick<
  DiagramStore,
  'title' | 'nodes' | 'links' | 'currentDiagramId' | 'modules' | 'labelCounters'
>;

const getDefaultLabelCounters = (): Record<NodeType, number> => ({
  Goal: 0,
  Strategy: 0,
  Context: 0,
  Evidence: 0,
  Assumption: 0,
  Justification: 0,
  Undeveloped: 0,
  Module: 0,
});

const createEmptyDiagramData = (title = 'ルート', id = 'root'): DiagramData => {
  const now = new Date().toISOString();
  return {
    version: '1.0.0',
    title,
    nodes: [],
    links: [],
    metadata: {
      createdAt: now,
      updatedAt: now,
      id,
      isModule: id !== 'root',
    },
  };
};

const ensureRootModuleExists = (
  modules: Record<string, DiagramData>,
  fallbackRoot: DiagramData,
): Record<string, DiagramData> => {
  if (modules.root) {
    return modules;
  }

  return {
    ...modules,
    root: {
      ...fallbackRoot,
      metadata: {
        ...fallbackRoot.metadata,
        id: 'root',
        isModule: false,
      },
    },
  };
};

const buildDiagramSnapshot = (state: ProjectStateSlice): DiagramData => {
  const existingMetadata = state.modules[state.currentDiagramId]?.metadata;
  return {
    version: '1.0.0',
    title: state.title,
    nodes: state.nodes,
    links: state.links,
    metadata: {
      createdAt: existingMetadata?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      id: state.currentDiagramId,
      isModule: state.currentDiagramId !== 'root',
      parentModuleId: existingMetadata?.parentModuleId,
    },
  };
};

const buildProjectDataFromState = (state: ProjectStateSlice): ProjectData => {
  const currentSnapshot = buildDiagramSnapshot(state);
  const mergedModules = {
    ...state.modules,
    [state.currentDiagramId]: currentSnapshot,
  };

  const fallbackRoot =
    mergedModules.root ||
    (state.currentDiagramId === 'root' ? currentSnapshot : createEmptyDiagramData());

  const normalizedModules = ensureRootModuleExists(mergedModules, fallbackRoot);

  return {
    version: '1.0.0',
    currentDiagramId: state.currentDiagramId,
    modules: normalizedModules,
    labelCounters: state.labelCounters ?? getDefaultLabelCounters(),
    exportedAt: new Date().toISOString(),
  };
};

const isProjectData = (data: unknown): data is ProjectData => {
  return Boolean(data && typeof data === 'object' && 'modules' in (data as Record<string, unknown>));
};

const normalizeProjectData = (rawData: unknown, fallbackTitle: string): ProjectData => {
  const now = new Date().toISOString();

  if (isProjectData(rawData)) {
    const modules = rawData.modules || {};
    const normalizedModules = ensureRootModuleExists(
      modules,
      modules.root || createEmptyDiagramData(fallbackTitle),
    );

    const targetId =
      rawData.currentDiagramId && normalizedModules[rawData.currentDiagramId]
        ? rawData.currentDiagramId
        : 'root';

    return {
      version: rawData.version || '1.0.0',
      currentDiagramId: targetId,
      modules: normalizedModules,
      labelCounters: rawData.labelCounters || getDefaultLabelCounters(),
      exportedAt: rawData.exportedAt || now,
    };
  }

  const diagramData = rawData as Partial<DiagramData> | undefined;
  const rootDiagram: DiagramData = diagramData
    ? {
        version: diagramData.version || '1.0.0',
        title: diagramData.title || fallbackTitle,
        nodes: diagramData.nodes || [],
        links: diagramData.links || [],
        metadata: {
          createdAt: diagramData.metadata?.createdAt || now,
          updatedAt: diagramData.metadata?.updatedAt || now,
          id: 'root',
          isModule: false,
        },
      }
    : createEmptyDiagramData(fallbackTitle);

  return {
    version: '1.0.0',
    currentDiagramId: 'root',
    modules: { root: rootDiagram },
    labelCounters: getDefaultLabelCounters(),
    exportedAt: now,
  };
};

const buildProjectDataFromLegacyState = (stateData: any, fallbackTitle: string): ProjectData => {
  if (!stateData || typeof stateData !== 'object') {
    return normalizeProjectData(null, fallbackTitle);
  }

  const slice: ProjectStateSlice = {
    title: stateData.title || fallbackTitle,
    nodes: stateData.nodes || [],
    links: stateData.links || [],
    currentDiagramId: stateData.currentDiagramId || 'root',
    modules: stateData.modules || {},
    labelCounters: stateData.labelCounters || getDefaultLabelCounters(),
  };

  return buildProjectDataFromState(slice);
};

const generateId = () => `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const generateLinkId = () => `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const generateModuleId = () => `module_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// デバウンス用のタイマー
let saveTimer: ReturnType<typeof setTimeout> | null = null;

// デバウンスされたDB保存
const debouncedSaveToDB = (saveFn: () => Promise<void>) => {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveFn();
  }, 2000); // 2秒後に保存
};

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

// ノードタイプからラベルプレフィックスを取得
const getLabelPrefix = (type: NodeType): string => {
  const prefixes: Record<NodeType, string> = {
    Goal: 'G',
    Strategy: 'S',
    Context: 'C',
    Evidence: 'E',
    Assumption: 'A',
    Justification: 'J',
    Undeveloped: 'U',
    Module: 'M',
  };
  return prefixes[type];
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
      isModule: state.currentDiagramId !== 'root',
      parentModuleId: state.modules[state.currentDiagramId]?.metadata?.parentModuleId,
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
      currentProjectId: null,
      currentDiagramDbId: null,
      isSyncing: false,
      lastSyncedAt: null,
      isWebSocketConnected: false,
      onlineUsers: [],
      isReconnecting: false,
      reconnectAttempts: 0,
      title: 'ルート',
      nodes: [],
      links: [],
      canvasState: DEFAULT_CANVAS_STATE,
      history: [],
      historyIndex: -1,
      currentDiagramId: 'root',
      modules: { root: createEmptyDiagramData() },
      labelCounters: getDefaultLabelCounters(),
      clipboard: [],

      // WebSocket Actions
      initializeWebSocket: (userId: string, userName: string) => {
        // Connect to WebSocket
        websocketService.connect();

        // Set up callbacks
        websocketService.setCallbacks({
          onNodeCreated: (node, diagramId) => {
            const state = get();

            // 現在のダイアグラムと同じ場合のみ更新
            if (state.currentDiagramId === diagramId) {
              // 自分が作成したノードでない場合のみ追加
              if (!state.nodes.find(n => n.id === node.id)) {
                set({ nodes: [...state.nodes, node] });
              }
            } else {
              // 別のダイアグラムの変更は、modulesに保存されたデータを更新
              const targetModule = state.modules[diagramId];
              if (targetModule && !targetModule.nodes.find(n => n.id === node.id)) {
                set({
                  modules: {
                    ...state.modules,
                    [diagramId]: {
                      ...targetModule,
                      nodes: [...targetModule.nodes, node],
                    },
                  },
                });
              }
            }
          },
          onNodeUpdated: (node, diagramId) => {
            const state = get();

            if (state.currentDiagramId === diagramId) {
              set({
                nodes: state.nodes.map(n => n.id === node.id ? node : n),
              });
            } else {
              const targetModule = state.modules[diagramId];
              if (targetModule) {
                set({
                  modules: {
                    ...state.modules,
                    [diagramId]: {
                      ...targetModule,
                      nodes: targetModule.nodes.map(n => n.id === node.id ? node : n),
                    },
                  },
                });
              }
            }
          },
          onNodeDeleted: (nodeId, diagramId) => {
            const state = get();

            if (state.currentDiagramId === diagramId) {
              set({
                nodes: state.nodes.filter(n => n.id !== nodeId),
                links: state.links.filter(l => l.source !== nodeId && l.target !== nodeId),
              });
            } else {
              const targetModule = state.modules[diagramId];
              if (targetModule) {
                set({
                  modules: {
                    ...state.modules,
                    [diagramId]: {
                      ...targetModule,
                      nodes: targetModule.nodes.filter(n => n.id !== nodeId),
                      links: targetModule.links.filter(l => l.source !== nodeId && l.target !== nodeId),
                    },
                  },
                });
              }
            }
          },
          onNodeMoved: (nodeId, position, diagramId) => {
            const state = get();

            if (state.currentDiagramId === diagramId) {
              set({
                nodes: state.nodes.map(n =>
                  n.id === nodeId ? { ...n, position } : n
                ),
              });
            } else {
              const targetModule = state.modules[diagramId];
              if (targetModule) {
                set({
                  modules: {
                    ...state.modules,
                    [diagramId]: {
                      ...targetModule,
                      nodes: targetModule.nodes.map(n =>
                        n.id === nodeId ? { ...n, position } : n
                      ),
                    },
                  },
                });
              }
            }
          },
          onLinkCreated: (link, diagramId) => {
            const state = get();

            if (state.currentDiagramId === diagramId) {
              if (!state.links.find(l => l.id === link.id)) {
                set({ links: [...state.links, link] });
              }
            } else {
              const targetModule = state.modules[diagramId];
              if (targetModule && !targetModule.links.find(l => l.id === link.id)) {
                set({
                  modules: {
                    ...state.modules,
                    [diagramId]: {
                      ...targetModule,
                      links: [...targetModule.links, link],
                    },
                  },
                });
              }
            }
          },
          onLinkDeleted: (linkId, diagramId) => {
            const state = get();

            if (state.currentDiagramId === diagramId) {
              set({
                links: state.links.filter(l => l.id !== linkId),
              });
            } else {
              const targetModule = state.modules[diagramId];
              if (targetModule) {
                set({
                  modules: {
                    ...state.modules,
                    [diagramId]: {
                      ...targetModule,
                      links: targetModule.links.filter(l => l.id !== linkId),
                    },
                  },
                });
              }
            }
          },
          onModuleCreated: (moduleId, moduleData, parentDiagramId) => {
            const state = get();
            console.log('Module created:', moduleId, parentDiagramId);

            // 自分のcurrentDiagramIdと一致する場合は何もしない（自分が作成したモジュール）
            // modulesに追加するだけでOK（既にローカルで追加済み）
            set({
              modules: {
                ...state.modules,
                [moduleId]: moduleData,
              },
            });
          },
          onUserJoined: (user) => {
            console.log('User joined:', user);
            // オンラインユーザーリストは online_users イベントで更新される
          },
          onUserLeft: (user) => {
            const state = get();
            console.log('User left:', user);
            set({
              onlineUsers: state.onlineUsers.filter(u => u.userId !== user.userId),
            });
          },
          onOnlineUsers: (users) => {
            set({ onlineUsers: users });
          },
          onConnectionStatusChange: ({ connected, reconnecting, attempts }) => {
            set({
              isWebSocketConnected: connected,
              isReconnecting: reconnecting,
              reconnectAttempts: attempts,
            });
            if (!connected && !reconnecting && attempts >= 5) {
              console.warn('[DiagramStore] WebSocket reconnect exhausted, consider manual refresh');
            }
          },
        });

        set({ isWebSocketConnected: true });

        // プロジェクトに参加している場合は自動join
        const projectId = get().currentProjectId;
        if (projectId) {
          websocketService.joinProject(projectId, userId, userName);
        }
      },

      disconnectWebSocket: () => {
        websocketService.disconnect();
        set({ isWebSocketConnected: false, onlineUsers: [] });
      },

      // Actions
      loadDiagramFromDB: async (projectId: string, diagramId?: string) => {
        try {
          set({ isSyncing: true });

          const loadAndApplyProjectData = async (targetDiagramId: string) => {
            const diagram = await diagramsApi.getDiagram(projectId, targetDiagramId);
            const projectData = normalizeProjectData(diagram.data, diagram.title);
            const activeDiagram =
              projectData.modules[projectData.currentDiagramId] ||
              projectData.modules.root ||
              createEmptyDiagramData(diagram.title);

            set({
              currentDiagramDbId: diagram.id,
              title: activeDiagram.title,
              nodes: activeDiagram.nodes || [],
              links: activeDiagram.links || [],
              currentDiagramId: projectData.currentDiagramId,
              modules: projectData.modules,
              labelCounters: projectData.labelCounters || getDefaultLabelCounters(),
              history: [],
              historyIndex: -1,
              lastSyncedAt: new Date().toISOString(),
              isSyncing: false,
            });
          };

          if (diagramId) {
            await loadAndApplyProjectData(diagramId);
            return;
          }

          const diagrams = await diagramsApi.getDiagrams(projectId);
          if (diagrams.length > 0) {
            await loadAndApplyProjectData(diagrams[0].id);
            return;
          }

          const emptyProjectData = normalizeProjectData(null, 'ルート');
          const rootDiagram = emptyProjectData.modules[emptyProjectData.currentDiagramId];
          set({
            currentDiagramDbId: null,
            title: rootDiagram?.title || 'ルート',
            nodes: rootDiagram?.nodes || [],
            links: rootDiagram?.links || [],
            currentDiagramId: emptyProjectData.currentDiagramId,
            modules: emptyProjectData.modules,
            labelCounters: emptyProjectData.labelCounters,
            history: [],
            historyIndex: -1,
            lastSyncedAt: null,
            isSyncing: false,
          });
        } catch (error) {
          console.error('Failed to load diagram from DB:', error);
          set({ isSyncing: false });
          // LocalStorageからの読み込みにフォールバック
          const state = get();
          if (state.currentProjectId) {
            const storageKey = `gsn-diagram-storage-project-${state.currentProjectId}`;
            const stored = localStorage.getItem(storageKey);

            if (stored) {
              try {
                const data = JSON.parse(stored);
                const stateData = data.state || {};
                const fallbackTitle = stateData.title || 'ルート';
                const normalized = buildProjectDataFromLegacyState(stateData, fallbackTitle);
                const activeDiagram =
                  normalized.modules[normalized.currentDiagramId] ||
                  normalized.modules.root ||
                  createEmptyDiagramData(fallbackTitle);

                set({
                  title: activeDiagram.title,
                  nodes: activeDiagram.nodes,
                  links: activeDiagram.links,
                  currentDiagramId: normalized.currentDiagramId,
                  modules: normalized.modules,
                  labelCounters: normalized.labelCounters,
                });
              } catch (e) {
                console.error('Failed to load from LocalStorage:', e);
              }
            }
          }
        }
      },

      saveDiagramToDB: async () => {
        const state = get();
        if (!state.currentProjectId) {
          console.warn('No current project, skipping DB save');
          return;
        }

        try {
          set({ isSyncing: true });

          const projectData = buildProjectDataFromState(state);
          const rootTitle =
            projectData.modules.root?.title ||
            projectData.modules[projectData.currentDiagramId]?.title ||
            state.title;

          if (state.currentDiagramDbId) {
            // 既存のダイアグラムを更新
            await diagramsApi.updateDiagram(
              state.currentProjectId,
              state.currentDiagramDbId,
              {
                title: rootTitle,
                data: projectData,
              }
            );
          } else {
            // 新規作成
            const created = await diagramsApi.createDiagram(
              state.currentProjectId,
              {
                title: rootTitle,
                data: projectData,
              }
            );
            set({ currentDiagramDbId: created.id });
          }

          set({
            lastSyncedAt: new Date().toISOString(),
            isSyncing: false,
          });
        } catch (error) {
          console.error('Failed to save diagram to DB:', error);
          set({ isSyncing: false });
          // LocalStorageには常に保存（フォールバック）
        }
      },

      createDiagramInDB: async (title: string) => {
        const state = get();
        if (!state.currentProjectId) {
          console.warn('No current project, cannot create diagram');
          return;
        }

        try {
          set({ isSyncing: true });

          const rootDiagram = createEmptyDiagramData(title, 'root');
          const projectData: ProjectData = {
            version: '1.0.0',
            currentDiagramId: 'root',
            modules: {
              root: rootDiagram,
            },
            labelCounters: getDefaultLabelCounters(),
            exportedAt: new Date().toISOString(),
          };

          const created = await diagramsApi.createDiagram(
            state.currentProjectId,
            {
              title,
              data: projectData,
            }
          );

          set({
            currentDiagramDbId: created.id,
            title: created.title,
            nodes: rootDiagram.nodes,
            links: rootDiagram.links,
            currentDiagramId: 'root',
            modules: projectData.modules,
            labelCounters: projectData.labelCounters,
            history: [],
            historyIndex: -1,
            lastSyncedAt: new Date().toISOString(),
            isSyncing: false,
          });
        } catch (error) {
          console.error('Failed to create diagram in DB:', error);
          set({ isSyncing: false });
        }
      },

      migrateLocalStorageToDB: async (projectId: string) => {
        try {
          set({ isSyncing: true });

          // LocalStorageからプロジェクトデータを取得
          const storageKey = `gsn-diagram-storage-project-${projectId}`;
          const stored = localStorage.getItem(storageKey);

          if (!stored) {
            console.log('No LocalStorage data to migrate');
            set({ isSyncing: false });
            return false;
          }

          const data = JSON.parse(stored);
          const stateData = data.state;
          const fallbackTitle = stateData?.title || '移行されたGSN図';
          const projectData = buildProjectDataFromLegacyState(stateData, fallbackTitle);
          const hasContent = Object.values(projectData.modules).some(
            (diagram) => (diagram.nodes?.length || 0) > 0 || (diagram.links?.length || 0) > 0,
          );

          if (!hasContent) {
            console.log('LocalStorage data is empty, skipping migration');
            set({ isSyncing: false });
            return false;
          }

          const activeDiagram =
            projectData.modules[projectData.currentDiagramId] ||
            projectData.modules.root ||
            createEmptyDiagramData(fallbackTitle);

          // DBに保存
          const created = await diagramsApi.createDiagram(projectId, {
            title: projectData.modules.root?.title || fallbackTitle,
            data: projectData,
          });

          console.log('Successfully migrated LocalStorage data to DB:', created.id);

          // 現在の状態を更新
          set({
            currentDiagramDbId: created.id,
            title: activeDiagram.title,
            nodes: activeDiagram.nodes,
            links: activeDiagram.links,
            currentDiagramId: projectData.currentDiagramId,
            modules: projectData.modules,
            labelCounters: projectData.labelCounters,
            lastSyncedAt: new Date().toISOString(),
            isSyncing: false,
          });

          // 移行成功後、LocalStorageのデータを削除（オプション）
          // localStorage.removeItem(storageKey);

          return true;
        } catch (error) {
          console.error('Failed to migrate LocalStorage to DB:', error);
          set({ isSyncing: false });
          return false;
        }
      },

      setCurrentProject: async (projectId) => {
        const currentProjectId = get().currentProjectId;
        if (currentProjectId === projectId) return;

        // 現在のプロジェクトのデータをDBに保存
        if (currentProjectId) {
          await get().saveDiagramToDB();
        }

        // 新しいプロジェクトに切り替え
        if (projectId) {
          set({ currentProjectId: projectId });

          // DBからダイアグラムを読み込む
          try {
            const diagrams = await diagramsApi.getDiagrams(projectId);

            if (diagrams.length === 0) {
              // DBにダイアグラムがない場合、LocalStorageからの移行を試みる
              console.log('No diagrams in DB, checking LocalStorage for migration...');
              const migrated = await get().migrateLocalStorageToDB(projectId);

              if (!migrated) {
                // 移行するデータもない場合は空の状態で開始
                const emptyProjectData = normalizeProjectData(null, 'ルート');
                const rootDiagram =
                  emptyProjectData.modules[emptyProjectData.currentDiagramId];
                set({
                  currentDiagramDbId: null,
                  title: rootDiagram?.title || 'ルート',
                  nodes: rootDiagram?.nodes || [],
                  links: rootDiagram?.links || [],
                  currentDiagramId: emptyProjectData.currentDiagramId,
                  modules: emptyProjectData.modules,
                  labelCounters: emptyProjectData.labelCounters,
                });
              }
            } else {
              // DBにダイアグラムがある場合は通常の読み込み
              await get().loadDiagramFromDB(projectId);
            }
          } catch (error) {
            console.error('Error loading diagram:', error);
            // エラー時はLocalStorageからフォールバック
            const storageKey = `gsn-diagram-storage-project-${projectId}`;
            const stored = localStorage.getItem(storageKey);

            if (stored) {
              try {
                const data = JSON.parse(stored);
                const stateData = data.state;
                const fallbackTitle = stateData?.title || 'ルート';
                const normalized = buildProjectDataFromLegacyState(stateData, fallbackTitle);
                const activeDiagram =
                  normalized.modules[normalized.currentDiagramId] ||
                  normalized.modules.root ||
                  createEmptyDiagramData(fallbackTitle);

                set({
                  title: activeDiagram.title,
                  nodes: activeDiagram.nodes,
                  links: activeDiagram.links,
                  currentDiagramId: normalized.currentDiagramId,
                  modules: normalized.modules,
                  labelCounters: normalized.labelCounters,
                });
              } catch (e) {
                console.error('Failed to load from LocalStorage:', e);
              }
            }
          }
        } else {
          // プロジェクトなし（nullに戻す）
          set({
            currentProjectId: null,
            currentDiagramDbId: null,
            title: 'ルート',
            nodes: [],
            links: [],
            currentDiagramId: 'root',
            modules: { root: createEmptyDiagramData() },
            labelCounters: getDefaultLabelCounters(),
          });
        }
      },

      setTitle: (title) => {
        saveToHistory(get, set);
        set({ title });
        // DB保存をデバウンス
        debouncedSaveToDB(() => get().saveDiagramToDB());
      },

      addNode: (type, x, y) => {
        saveToHistory(get, set);
        const state = get();

        // ラベルカウンターをインクリメント
        const newCounter = state.labelCounters[type] + 1;
        const label = `${getLabelPrefix(type)}${newCounter}`;

        const newNode: Node = {
          id: generateId(),
          type,
          position: { x, y },
          size: { ...DEFAULT_NODE_SIZE },
          content: '',
          label,
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
            title: label, // ラベル（M1, M2など）をタイトルに
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
          newNode.content = label; // ラベルをコンテンツに

          set({
            nodes: [...state.nodes, newNode],
            modules: {
              ...state.modules,
              [moduleId]: moduleData,
            },
            labelCounters: {
              ...state.labelCounters,
              [type]: newCounter,
            },
            canvasState: {
              ...state.canvasState,
              mode: 'select',
              selectedNodeType: undefined,
            },
          });

          const projectId = state.currentProjectId;
          if (projectId && websocketService.isConnected()) {
            websocketService.emitModuleCreated(projectId, moduleId, moduleData, state.currentDiagramId);
          }
        } else {
          set((state) => ({
            nodes: [...state.nodes, newNode],
            labelCounters: {
              ...state.labelCounters,
              [type]: newCounter,
            },
            canvasState: {
              ...state.canvasState,
              mode: 'select',
              selectedNodeType: undefined,
            },
          }));
        }

        // WebSocketでブロードキャスト
        const projectId = state.currentProjectId;
        const diagramId = state.currentDiagramId;
        if (projectId && websocketService.isConnected()) {
          websocketService.emitNodeCreated(projectId, newNode, diagramId);
        }

        // DB保存をデバウンス
        debouncedSaveToDB(() => get().saveDiagramToDB());
      },

      updateNode: (id, updates) => {
        saveToHistory(get, set);
        const state = get();
        const updatedNode = state.nodes.find(n => n.id === id);

        // Moduleノードのラベルが変更された場合、モジュールタイトルも更新
        if (updatedNode && updatedNode.type === 'Module' && updates.label && updatedNode.moduleId) {
          set((state) => ({
            nodes: state.nodes.map((node) =>
              node.id === id ? { ...node, ...updates, moduleName: updates.label, content: updates.label } : node
            ),
            modules: {
              ...state.modules,
              [updatedNode.moduleId!]: {
                ...state.modules[updatedNode.moduleId!],
                title: updates.label,
              },
            },
          }));
        } else {
          set((state) => ({
            nodes: state.nodes.map((node) =>
              node.id === id ? { ...node, ...updates } : node
            ),
          }));
        }

        // WebSocketでブロードキャスト
        const projectId = get().currentProjectId;
        if (projectId && websocketService.isConnected() && updatedNode) {
          websocketService.emitNodeUpdated(projectId, { ...updatedNode, ...updates }, get().currentDiagramId);
        }

        // DB保存をデバウンス
        debouncedSaveToDB(() => get().saveDiagramToDB());
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

        // WebSocketでブロードキャスト
        const projectId = get().currentProjectId;
        if (projectId && websocketService.isConnected()) {
          websocketService.emitNodeDeleted(projectId, id, get().currentDiagramId);
        }

        // DB保存をデバウンス
        debouncedSaveToDB(() => get().saveDiagramToDB());
      },

      moveNode: (id, x, y) => {
        // 移動は履歴に保存しない（頻繁すぎるため）
        set((state) => ({
          nodes: state.nodes.map((node) =>
            node.id === id ? { ...node, position: { x, y } } : node
          ),
        }));

        // WebSocketでブロードキャスト
        const projectId = get().currentProjectId;
        if (projectId && websocketService.isConnected()) {
          websocketService.emitNodeMoved(projectId, id, { x, y }, get().currentDiagramId);
        }
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

        // WebSocketでブロードキャスト
        const projectId = get().currentProjectId;
        if (projectId && websocketService.isConnected()) {
          websocketService.emitLinkCreated(projectId, newLink, get().currentDiagramId);
        }

        // DB保存をデバウンス
        debouncedSaveToDB(() => get().saveDiagramToDB());
      },

      deleteLink: (id) => {
        saveToHistory(get, set);
        set((state) => ({
          links: state.links.filter((link) => link.id !== id),
        }));

        // WebSocketでブロードキャスト
        const projectId = get().currentProjectId;
        if (projectId && websocketService.isConnected()) {
          websocketService.emitLinkDeleted(projectId, id, get().currentDiagramId);
        }

        // DB保存をデバウンス
        debouncedSaveToDB(() => get().saveDiagramToDB());
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

      selectAll: () => {
        const state = get();
        set({
          canvasState: {
            ...state.canvasState,
            selectedNodes: state.nodes.map(n => n.id),
          },
        });
      },

      deleteSelectedNodes: () => {
        const state = get();
        if (state.canvasState.selectedNodes.length === 0) return;

        saveToHistory(get, set);
        const selectedIds = new Set(state.canvasState.selectedNodes);

        set({
          nodes: state.nodes.filter(n => !selectedIds.has(n.id)),
          links: state.links.filter(l => !selectedIds.has(l.source) && !selectedIds.has(l.target)),
          canvasState: {
            ...state.canvasState,
            selectedNodes: [],
          },
        });
      },

      moveSelectedNodes: (dx: number, dy: number) => {
        const state = get();
        if (state.canvasState.selectedNodes.length === 0) return;

        const selectedIds = new Set(state.canvasState.selectedNodes);

        set({
          nodes: state.nodes.map(node =>
            selectedIds.has(node.id)
              ? { ...node, position: { x: node.position.x + dx, y: node.position.y + dy } }
              : node
          ),
        });

        // WebSocketでブロードキャスト（各ノードの移動を通知）
        const projectId = get().currentProjectId;
        if (projectId && websocketService.isConnected()) {
          state.canvasState.selectedNodes.forEach(nodeId => {
            const node = state.nodes.find(n => n.id === nodeId);
            if (node) {
              const newPosition = { x: node.position.x + dx, y: node.position.y + dy };
              websocketService.emitNodeMoved(projectId, nodeId, newPosition, get().currentDiagramId);
            }
          });
        }
      },

      copySelectedNodes: () => {
        const state = get();
        if (state.canvasState.selectedNodes.length === 0) return;

        const selectedIds = new Set(state.canvasState.selectedNodes);
        const nodesToCopy = state.nodes.filter(n => selectedIds.has(n.id));

        set({
          clipboard: nodesToCopy,
        });
      },

      copyNodeTree: (nodeId: string) => {
        const state = get();
        // サブツリーを取得（ノードIDをルートとする全ての子孫ノードとリンク）
        const subtree = getSubtree(nodeId, state.nodes, state.links);

        set({
          clipboard: subtree.nodes,
        });
      },

      pasteNodes: () => {
        const state = get();
        if (state.clipboard.length === 0) return;

        saveToHistory(get, set);

        // クリップボードのノードをコピーして新しいIDを割り当てる
        const idMap = new Map<string, string>(); // 古いID → 新しいIDのマッピング
        const newNodes: Node[] = state.clipboard.map(node => {
          const newId = generateId();
          idMap.set(node.id, newId);

          // ペースト位置をずらす（右下に50pxずつオフセット）
          return {
            ...node,
            id: newId,
            position: {
              x: node.position.x + 50,
              y: node.position.y + 50,
            },
            // ラベルカウンターをインクリメント
            label: `${getLabelPrefix(node.type)}${state.labelCounters[node.type] + 1}`,
          };
        });

        // ラベルカウンターを更新
        const updatedCounters = { ...state.labelCounters };
        newNodes.forEach(node => {
          updatedCounters[node.type]++;
        });

        // クリップボード内のノード間のリンクもコピー
        const clipboardNodeIds = new Set(state.clipboard.map(n => n.id));
        const newLinks: Link[] = state.links
          .filter(link => clipboardNodeIds.has(link.source) && clipboardNodeIds.has(link.target))
          .map(link => ({
            ...link,
            id: generateLinkId(),
            source: idMap.get(link.source)!,
            target: idMap.get(link.target)!,
          }));

        // 新しいノードを選択状態にする
        const newNodeIds = newNodes.map(n => n.id);

        set({
          nodes: [...state.nodes, ...newNodes],
          links: [...state.links, ...newLinks],
          labelCounters: updatedCounters,
          canvasState: {
            ...state.canvasState,
            selectedNodes: newNodeIds,
          },
        });
      },

      toggleGridSnap: () => {
        set((state) => ({
          canvasState: {
            ...state.canvasState,
            gridSnapEnabled: !state.canvasState.gridSnapEnabled,
          },
        }));
      },

      fitToScreen: () => {
        const state = get();
        if (state.nodes.length === 0) return;

        // すべてのノードの境界を計算
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        state.nodes.forEach(node => {
          const left = node.position.x - node.size.width / 2;
          const right = node.position.x + node.size.width / 2;
          const top = node.position.y - node.size.height / 2;
          const bottom = node.position.y + node.size.height / 2;

          minX = Math.min(minX, left);
          maxX = Math.max(maxX, right);
          minY = Math.min(minY, top);
          maxY = Math.max(maxY, bottom);
        });

        // パディングを追加
        const padding = 100;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        const width = maxX - minX;
        const height = maxY - minY;

        // キャンバスサイズを取得（固定値または推定）
        const canvasWidth = window.innerWidth - 240; // サイドバー幅を引く
        const canvasHeight = window.innerHeight - 64; // ヘッダー高さを引く

        // 適切なズームレベルを計算
        const scaleX = canvasWidth / width;
        const scaleY = canvasHeight / height;
        const scale = Math.min(scaleX, scaleY, 3.0); // 最大3.0倍
        const finalScale = Math.max(scale, 0.2); // 最小0.2倍

        // 中心座標を計算
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // オフセットを計算（キャンバス中央にノード群の中央を配置）
        const offsetX = canvasWidth / 2 - centerX * finalScale;
        const offsetY = canvasHeight / 2 - centerY * finalScale;

        set({
          canvasState: {
            ...state.canvasState,
            viewport: {
              scale: finalScale,
              offsetX,
              offsetY,
            },
          },
        });
      },

      zoomToSelection: () => {
        const state = get();
        if (state.canvasState.selectedNodes.length === 0) return;

        const selectedNodes = state.nodes.filter(n =>
          state.canvasState.selectedNodes.includes(n.id)
        );

        if (selectedNodes.length === 0) return;

        // 選択ノードの境界を計算
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        selectedNodes.forEach(node => {
          const left = node.position.x - node.size.width / 2;
          const right = node.position.x + node.size.width / 2;
          const top = node.position.y - node.size.height / 2;
          const bottom = node.position.y + node.size.height / 2;

          minX = Math.min(minX, left);
          maxX = Math.max(maxX, right);
          minY = Math.min(minY, top);
          maxY = Math.max(maxY, bottom);
        });

        // パディングを追加
        const padding = 100;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        const width = maxX - minX;
        const height = maxY - minY;

        // キャンバスサイズ
        const canvasWidth = window.innerWidth - 240;
        const canvasHeight = window.innerHeight - 64;

        // ズームレベル計算
        const scaleX = canvasWidth / width;
        const scaleY = canvasHeight / height;
        const scale = Math.min(scaleX, scaleY, 3.0);
        const finalScale = Math.max(scale, 0.2);

        // 中心座標
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const offsetX = canvasWidth / 2 - centerX * finalScale;
        const offsetY = canvasHeight / 2 - centerY * finalScale;

        set({
          canvasState: {
            ...state.canvasState,
            viewport: {
              scale: finalScale,
              offsetX,
              offsetY,
            },
          },
        });
      },

      resetZoom: () => {
        set((state) => ({
          canvasState: {
            ...state.canvasState,
            viewport: {
              ...state.canvasState.viewport,
              scale: 1.0,
            },
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

        // WebSocketでブロードキャスト
        const projectId = state.currentProjectId;
        const currentDiagramId = state.currentDiagramId;
        console.log('[convertToModule] Broadcasting:', { projectId, isConnected: websocketService.isConnected(), currentDiagramId });
        if (projectId && websocketService.isConnected()) {
          // 1. サブツリーのノードを削除
          subtreeNodes.forEach(node => {
            websocketService.emitNodeDeleted(projectId, node.id, currentDiagramId);
          });

          // 2. サブツリーのリンクを削除
          subtreeLinks.forEach(link => {
            websocketService.emitLinkDeleted(projectId, link.id, currentDiagramId);
          });

          // 3. 親リンクを削除
          parentLinks.forEach(link => {
            websocketService.emitLinkDeleted(projectId, link.id, currentDiagramId);
          });

          // 4. Moduleノードを作成
          websocketService.emitNodeCreated(projectId, moduleNode, currentDiagramId);

          // 5. 新しいリンクを作成
          newLinks.forEach(link => {
            websocketService.emitLinkCreated(projectId, link, currentDiagramId);
          });

          // 6. モジュールデータを作成（カスタムイベント）
          websocketService.emitModuleCreated(projectId, moduleId, moduleData, currentDiagramId);
        }

        // DB保存をデバウンス
        debouncedSaveToDB(() => get().saveDiagramToDB());
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
            // 既存のparentModuleIdを保持（存在する場合）
            parentModuleId: state.modules[state.currentDiagramId]?.metadata?.parentModuleId,
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

        // 現在のダイアグラムの親IDを取得
        // modulesに保存されているメタデータから取得
        const parentId = state.modules[state.currentDiagramId]?.metadata?.parentModuleId;

        if (!parentId) {
          console.error('No parent module found');
          return;
        }

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
            parentModuleId: parentId,
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
        const updatedModuleNode = updatedParentNodes.find(
          (node) => node.type === 'Module' && node.moduleId === state.currentDiagramId,
        );

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

        const projectId = state.currentProjectId;
        if (projectId && websocketService.isConnected() && updatedModuleNode) {
          websocketService.emitNodeUpdated(projectId, updatedModuleNode, parentId);
        }
      },

      switchToDiagram: (diagramId) => {
        const state = get();

        // 既にそのダイアグラムにいる場合は何もしない
        if (state.currentDiagramId === diagramId) {
          return;
        }

        // rootダイアグラムへの切り替えの場合
        if (diagramId === 'root') {
          const rootData = state.modules['root'];

          // 現在のダイアグラムを保存
          if (state.currentDiagramId !== 'root') {
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
                parentModuleId: state.modules[state.currentDiagramId]?.metadata.parentModuleId,
              },
            };

            set({
              title: rootData?.title || 'ルート',
              nodes: rootData?.nodes || [],
              links: rootData?.links || [],
              currentDiagramId: 'root',
              modules: {
                ...state.modules,
                [state.currentDiagramId]: currentData,
              },
              canvasState: DEFAULT_CANVAS_STATE,
            });
          }
          return;
        }

        // 通常のモジュールへの切り替え
        const targetData = state.modules[diagramId];

        if (!targetData) {
          console.error('Target diagram not found:', diagramId);
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
            parentModuleId: state.modules[state.currentDiagramId]?.metadata.parentModuleId,
          },
        };

        // ターゲットダイアグラムに切り替え
        set({
          title: targetData.title,
          nodes: targetData.nodes,
          links: targetData.links,
          currentDiagramId: diagramId,
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

      exportProjectData: () => {
        const state = get();
        return buildProjectDataFromState(state);
      },

      importProjectData: (data) => {
        saveToHistory(get, set);

        const fallbackTitle =
          (data && typeof data === 'object' && 'title' in data && typeof (data as any).title === 'string'
            ? (data as any).title
            : 'インポートされたGSN図') || 'インポートされたGSN図';
        const projectData = normalizeProjectData(data, fallbackTitle);
        const targetDiagram =
          projectData.modules[projectData.currentDiagramId] ||
          projectData.modules.root ||
          createEmptyDiagramData(fallbackTitle);

        set({
          title: targetDiagram.title,
          nodes: targetDiagram.nodes,
          links: targetDiagram.links,
          currentDiagramId: projectData.currentDiagramId,
          modules: projectData.modules,
          labelCounters: projectData.labelCounters,
          canvasState: DEFAULT_CANVAS_STATE,
        });
      },

      applyAutoLayout: () => {
        const state = get();
        if (state.nodes.length === 0) {
          alert('レイアウトするノードがありません');
          return;
        }

        saveToHistory(get, set);
        const layoutedNodes = autoLayout(state.nodes, state.links);

        set({
          nodes: layoutedNodes,
        });

        // WebSocketで各ノードの移動を他のユーザーにブロードキャスト
        const projectId = state.currentProjectId;
        if (projectId && websocketService.isConnected()) {
          layoutedNodes.forEach((node) => {
            websocketService.emitNodeMoved(projectId, node.id, node.position, get().currentDiagramId);
          });
        }
      },

      exportAsImage: (format) => {
        const state = get();

        // ノードの境界を計算
        const { nodes, links } = state;
        if (nodes.length === 0) {
          alert('エクスポートするノードがありません');
          return;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach(node => {
          const left = node.position.x - node.size.width / 2;
          const right = node.position.x + node.size.width / 2;
          const top = node.position.y - node.size.height / 2;
          const bottom = node.position.y + node.size.height / 2;

          minX = Math.min(minX, left);
          maxX = Math.max(maxX, right);
          minY = Math.min(minY, top);
          maxY = Math.max(maxY, bottom);
        });

        // パディングを追加
        const padding = 50;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        const width = maxX - minX;
        const height = maxY - minY;

        // 新しいSVGを作成
        const newSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        newSvg.setAttribute('width', width.toString());
        newSvg.setAttribute('height', height.toString());
        newSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        newSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

        // 背景を追加
        const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bgRect.setAttribute('width', width.toString());
        bgRect.setAttribute('height', height.toString());
        bgRect.setAttribute('fill', '#FFFFFF');
        newSvg.appendChild(bgRect);

        // 矢印マーカーを追加
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

        // 通常の矢印
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '10');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '3');
        marker.setAttribute('orient', 'auto');
        const polygon1 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon1.setAttribute('points', '0 0, 10 3, 0 6');
        polygon1.setAttribute('fill', '#1F2937');
        marker.appendChild(polygon1);
        defs.appendChild(marker);

        // 白抜き矢印
        const markerHollow = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        markerHollow.setAttribute('id', 'arrowhead-hollow');
        markerHollow.setAttribute('markerWidth', '10');
        markerHollow.setAttribute('markerHeight', '10');
        markerHollow.setAttribute('refX', '9');
        markerHollow.setAttribute('refY', '3');
        markerHollow.setAttribute('orient', 'auto');
        const polygon2 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon2.setAttribute('points', '0 0, 10 3, 0 6');
        polygon2.setAttribute('fill', 'white');
        polygon2.setAttribute('stroke', '#1F2937');
        polygon2.setAttribute('stroke-width', '1.5');
        markerHollow.appendChild(polygon2);
        defs.appendChild(markerHollow);

        newSvg.appendChild(defs);

        // グループ要素
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', `translate(${-minX}, ${-minY})`);

        // リンクを描画（ノードの下に）
        links.forEach(link => {
          const sourceNode = nodes.find(n => n.id === link.source);
          const targetNode = nodes.find(n => n.id === link.target);
          if (!sourceNode || !targetNode) return;

          const isInContextOf = ['Context', 'Assumption', 'Justification'].includes(targetNode.type);
          const markerEnd = isInContextOf ? 'url(#arrowhead-hollow)' : 'url(#arrowhead)';
          const verticalTargets = ['Goal', 'Strategy', 'Evidence', 'Undeveloped', 'Module'];
          const shouldConnectVertically = verticalTargets.includes(targetNode.type);

          let x1, y1, x2, y2;
          if (shouldConnectVertically) {
            const dy = targetNode.position.y - sourceNode.position.y;
            if (dy > 0) {
              x1 = sourceNode.position.x;
              y1 = sourceNode.position.y + sourceNode.size.height / 2;
              x2 = targetNode.position.x;
              y2 = targetNode.position.y - targetNode.size.height / 2;
            } else {
              x1 = sourceNode.position.x;
              y1 = sourceNode.position.y - sourceNode.size.height / 2;
              x2 = targetNode.position.x;
              y2 = targetNode.position.y + targetNode.size.height / 2;
            }
          } else {
            const dx = targetNode.position.x - sourceNode.position.x;
            if (dx > 0) {
              x1 = sourceNode.position.x + sourceNode.size.width / 2;
              y1 = sourceNode.position.y;
              x2 = targetNode.position.x - targetNode.size.width / 2;
              y2 = targetNode.position.y;
            } else {
              x1 = sourceNode.position.x - sourceNode.size.width / 2;
              y1 = sourceNode.position.y;
              x2 = targetNode.position.x + targetNode.size.width / 2;
              y2 = targetNode.position.y;
            }
          }

          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', `M ${x1} ${y1} L ${x2} ${y2}`);
          path.setAttribute('stroke', '#1F2937');
          path.setAttribute('stroke-width', '2');
          path.setAttribute('fill', 'none');
          path.setAttribute('marker-end', markerEnd);
          if (link.type === 'dashed') {
            path.setAttribute('stroke-dasharray', '8 8');
          }
          g.appendChild(path);
        });

        // ノードを描画
        nodes.forEach(node => {
          const nodeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          nodeG.setAttribute('transform', `translate(${node.position.x}, ${node.position.y})`);

          const { width: w, height: h } = node.size;
          const color = NODE_COLORS[node.type] || '#FFFFFF';

          // ノード形状を描画
          let shape;
          switch (node.type) {
            case 'Goal':
            case 'Undeveloped':
              shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
              shape.setAttribute('x', (-w / 2).toString());
              shape.setAttribute('y', (-h / 2).toString());
              shape.setAttribute('width', w.toString());
              shape.setAttribute('height', h.toString());
              if (node.type === 'Undeveloped') {
                shape.setAttribute('transform', 'rotate(45)');
              }
              break;
            case 'Strategy':
              shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
              shape.setAttribute('x', (-w / 2).toString());
              shape.setAttribute('y', (-h / 2).toString());
              shape.setAttribute('width', w.toString());
              shape.setAttribute('height', h.toString());
              shape.setAttribute('transform', 'skewX(-15)');
              break;
            case 'Context':
              shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
              shape.setAttribute('x', (-w / 2).toString());
              shape.setAttribute('y', (-h / 2).toString());
              shape.setAttribute('width', w.toString());
              shape.setAttribute('height', h.toString());
              shape.setAttribute('rx', '10');
              shape.setAttribute('ry', '10');
              break;
            case 'Evidence':
            case 'Assumption':
            case 'Justification':
              shape = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
              shape.setAttribute('cx', '0');
              shape.setAttribute('cy', '0');
              shape.setAttribute('rx', (w / 2).toString());
              shape.setAttribute('ry', (h / 2).toString());
              break;
            case 'Module':
              const tabWidth = 60;
              const tabHeight = 20;
              const pathData = `
                M ${-w / 2} ${-h / 2 + tabHeight}
                L ${-w / 2} ${-h / 2}
                L ${-w / 2 + tabWidth} ${-h / 2}
                L ${-w / 2 + tabWidth + 10} ${-h / 2 + tabHeight}
                L ${w / 2} ${-h / 2 + tabHeight}
                L ${w / 2} ${h / 2}
                L ${-w / 2} ${h / 2}
                Z
              `;
              shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
              shape.setAttribute('d', pathData);
              break;
            default:
              shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
              shape.setAttribute('x', (-w / 2).toString());
              shape.setAttribute('y', (-h / 2).toString());
              shape.setAttribute('width', w.toString());
              shape.setAttribute('height', h.toString());
          }

          shape.setAttribute('fill', color);
          shape.setAttribute('stroke', '#1F2937');
          shape.setAttribute('stroke-width', '2');
          nodeG.appendChild(shape);

          // ラベル表示（左上）
          if (node.label) {
            const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            labelBg.setAttribute('x', (-w / 2).toString());
            labelBg.setAttribute('y', (-h / 2 - 20).toString());
            labelBg.setAttribute('width', '40');
            labelBg.setAttribute('height', '18');
            labelBg.setAttribute('fill', '#800000');
            labelBg.setAttribute('rx', '3');
            nodeG.appendChild(labelBg);

            const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            labelText.setAttribute('x', (-w / 2 + 20).toString());
            labelText.setAttribute('y', (-h / 2 - 6).toString());
            labelText.setAttribute('fill', '#FFFFFF');
            labelText.setAttribute('font-size', '12');
            labelText.setAttribute('font-weight', 'bold');
            labelText.setAttribute('text-anchor', 'middle');
            labelText.textContent = node.label;
            nodeG.appendChild(labelText);
          }

          // ノード内容を表示（テキストのみ、HTMLタグを除去）
          if (node.content) {
            // HTMLタグを除去してプレーンテキストに変換
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = node.content;
            const plainText = tempDiv.textContent || tempDiv.innerText || '';

            if (plainText.trim()) {
              // テキストを複数行に分割（長い場合）
              const maxCharsPerLine = 20;
              const words = plainText.split(/\s+/);
              const lines: string[] = [];
              let currentLine = '';

              words.forEach(word => {
                if ((currentLine + ' ' + word).length > maxCharsPerLine && currentLine.length > 0) {
                  lines.push(currentLine);
                  currentLine = word;
                } else {
                  currentLine = currentLine ? currentLine + ' ' + word : word;
                }
              });
              if (currentLine) {
                lines.push(currentLine);
              }

              // 最大5行まで表示
              const displayLines = lines.slice(0, 5);
              const lineHeight = 16;
              const totalHeight = displayLines.length * lineHeight;
              const startY = -totalHeight / 2;

              displayLines.forEach((line, index) => {
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', '0');
                text.setAttribute('y', (startY + index * lineHeight).toString());
                text.setAttribute('fill', '#1F2937');
                text.setAttribute('font-size', '14');
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('dominant-baseline', 'middle');
                text.textContent = line;
                nodeG.appendChild(text);
              });

              // 省略記号（5行を超える場合）
              if (lines.length > 5) {
                const ellipsis = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                ellipsis.setAttribute('x', '0');
                ellipsis.setAttribute('y', (startY + 5 * lineHeight).toString());
                ellipsis.setAttribute('fill', '#1F2937');
                ellipsis.setAttribute('font-size', '14');
                ellipsis.setAttribute('text-anchor', 'middle');
                ellipsis.textContent = '...';
                nodeG.appendChild(ellipsis);
              }
            }
          }

          g.appendChild(nodeG);
        });

        newSvg.appendChild(g);

        if (format === 'svg') {
          // SVGとしてエクスポート
          const svgData = new XMLSerializer().serializeToString(newSvg);
          const blob = new Blob([svgData], { type: 'image/svg+xml' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${state.title || 'gsn-diagram'}.svg`;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          // PNGとしてエクスポート
          const svgData = new XMLSerializer().serializeToString(newSvg);
          const canvas = document.createElement('canvas');
          canvas.width = width * 2;
          canvas.height = height * 2;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            console.error('Canvas context not available');
            return;
          }

          const img = new Image();
          img.onload = () => {
            ctx.scale(2, 2);
            ctx.drawImage(img, 0, 0);

            canvas.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${state.title || 'gsn-diagram'}.png`;
                a.click();
                URL.revokeObjectURL(url);
              }
            }, 'image/png');
          };

          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const svgUrl = URL.createObjectURL(svgBlob);
          img.src = svgUrl;
        }
      },

      reset: () => {
        const emptyProjectData = normalizeProjectData(null, '新しいGSN図');
        const rootDiagram = emptyProjectData.modules[emptyProjectData.currentDiagramId];
        set({
          title: rootDiagram?.title || '新しいGSN図',
          nodes: rootDiagram?.nodes || [],
          links: rootDiagram?.links || [],
          canvasState: DEFAULT_CANVAS_STATE,
          history: [],
          historyIndex: -1,
          currentDiagramId: emptyProjectData.currentDiagramId,
          modules: emptyProjectData.modules,
          labelCounters: emptyProjectData.labelCounters,
        });
      },
    }),
    {
      name: 'gsn-diagram-storage',
      // LocalStorageはデフォルトで使用される（プロジェクトIDベースの保存は setCurrentProject 内で処理）
    }
  )
);
