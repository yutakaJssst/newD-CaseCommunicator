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
  labelCounters: Record<NodeType, number>;

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
  toggleGridSnap: () => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  convertToModule: (goalId: string) => void;
  switchToModule: (moduleId: string) => void;
  switchToParent: () => void;

  exportData: () => DiagramData;
  importData: (data: DiagramData) => void;
  exportAsImage: (format: 'png' | 'svg') => void;
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
      labelCounters: {
        Goal: 0,
        Strategy: 0,
        Context: 0,
        Evidence: 0,
        Assumption: 0,
        Justification: 0,
        Undeveloped: 0,
        Module: 0,
      },

      // Actions
      setTitle: (title) => {
        saveToHistory(get, set);
        set({ title });
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

      toggleGridSnap: () => {
        set((state) => ({
          canvasState: {
            ...state.canvasState,
            gridSnapEnabled: !state.canvasState.gridSnapEnabled,
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
          const verticalTargets = ['Strategy', 'Evidence', 'Undeveloped', 'Module'];
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
        labelCounters: state.labelCounters,
      }),
    }
  )
);
