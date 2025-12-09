/**
 * GSN要素のノードタイプ
 */
export type NodeType =
  | 'Goal'
  | 'Strategy'
  | 'Context'
  | 'Evidence'
  | 'Assumption'
  | 'Justification'
  | 'Undeveloped';

/**
 * リンクタイプ
 */
export type LinkType = 'solid' | 'dashed';

/**
 * ノード位置情報
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * ノードサイズ情報
 */
export interface Size {
  width: number;
  height: number;
}

/**
 * ノードスタイル情報
 */
export interface NodeStyle {
  borderColor?: string;
  borderWidth?: number;
  fillColor?: string;
}

/**
 * GSNノード
 */
export interface Node {
  id: string;
  type: NodeType;
  position: Position;
  size: Size;
  content: string;
  style?: NodeStyle;
  label?: string;
}

/**
 * リンクスタイル情報
 */
export interface LinkStyle {
  color?: string;
  width?: number;
}

/**
 * ノード間のリンク
 */
export interface Link {
  id: string;
  source: string;
  target: string;
  type: LinkType;
  style?: LinkStyle;
}

/**
 * キャンバスのビューポート情報
 */
export interface Viewport {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/**
 * キャンバスの操作モード
 */
export type CanvasMode = 'select' | 'addNode' | 'addLink' | 'delete';

/**
 * キャンバス状態
 */
export interface CanvasState {
  viewport: Viewport;
  selectedNodes: string[];
  mode: CanvasMode;
  selectedNodeType?: NodeType;
}

/**
 * 図のメタデータ
 */
export interface DiagramMetadata {
  createdAt: string;
  updatedAt: string;
}

/**
 * 図全体のデータ
 */
export interface DiagramData {
  version: string;
  title: string;
  nodes: Node[];
  links: Link[];
  metadata: DiagramMetadata;
}

/**
 * ノードタイプごとのデフォルト色設定（モダンなカラーパレット）
 */
export const NODE_COLORS: Record<NodeType, string> = {
  Goal: '#FFFFFF',
  Strategy: '#FFFFFF',
  Context: '#FFFFFF',
  Evidence: '#FFFFFF',
  Assumption: '#FFFFFF',
  Justification: '#FFFFFF',
  Undeveloped: '#FFFFFF',
};

/**
 * ノードタイプごとの日本語名
 */
export const NODE_LABELS: Record<NodeType, string> = {
  Goal: 'ゴール',
  Strategy: '戦略',
  Context: '前提',
  Evidence: '証拠',
  Assumption: '仮定',
  Justification: '正当化',
  Undeveloped: '未展開',
};

/**
 * デフォルトのノードサイズ
 */
export const DEFAULT_NODE_SIZE: Size = {
  width: 180,
  height: 120,
};

/**
 * デフォルトのキャンバス設定
 */
export const DEFAULT_CANVAS_STATE: CanvasState = {
  viewport: {
    scale: 1.0,
    offsetX: 0,
    offsetY: 0,
  },
  selectedNodes: [],
  mode: 'select',
};
