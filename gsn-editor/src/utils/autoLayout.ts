import type { Node, Link, DiagramData } from '../types/diagram';

/**
 * ツリー構造の自動レイアウトアルゴリズム
 * - 主要ノード（Goal、Strategy、Evidence等）は縦に階層配置
 * - Context系ノード（Context、Assumption、Justification）は横に配置
 * - ノードサイズを考慮して重なりを防止
 * - Context系ノードは隣のノードを飛び越えないように配置
 * - テキスト内容に合わせてノードサイズを最適化
 */

interface TreeNode {
  id: string;
  node: Node;
  children: TreeNode[];
  contextNodes: TreeNode[]; // 横に配置するContext系ノード
  parent: TreeNode | null;
  x: number;  // 相対X座標
  y: number;  // 相対Y座標
  mod: number; // modifier（兄弟ノードとの調整値）
  width: number;  // ノード幅
  height: number; // ノード高さ
}

// 最小間隔（ノードサイズに加算）
const MIN_HORIZONTAL_GAP = 40;  // ノード間の最小水平ギャップ
const MIN_VERTICAL_GAP = 60;    // レベル間の最小垂直ギャップ
const CONTEXT_GAP = 50;         // Contextノードと親ノード間のギャップ（リンクが見えるように長めに）
const INITIAL_OFFSET_X = 400;   // キャンバス上のツリー初期X位置

// デフォルトノードサイズ（ノードにサイズがない場合）
const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 100;

// サイズ最適化の設定
const MIN_NODE_WIDTH = 120;     // 最小ノード幅
const MAX_NODE_WIDTH = 280;     // 最大ノード幅
const MIN_NODE_HEIGHT = 60;     // 最小ノード高さ
const MAX_NODE_HEIGHT = 160;    // 最大ノード高さ
const ASCII_CHAR_WIDTH = 7;     // ASCII文字の推定幅（px）
const CJK_CHAR_WIDTH = 13;      // 日本語/CJK文字の推定幅（px）
const LINE_HEIGHT = 18;         // 1行の高さ（px）
const PADDING_X = 24;           // 左右パディング合計
const PADDING_Y = 20;           // 上下パディング合計
const GOLDEN_RATIO = 1.618;     // 黄金比（横:縦 = 1.618:1）

/**
 * CJK文字（日本語、中国語、韓国語）かどうかを判定
 */
function isCJKCharacter(char: string): boolean {
  const code = char.charCodeAt(0);
  // CJK統合漢字、ひらがな、カタカナ、全角文字など
  return (
    (code >= 0x3000 && code <= 0x9FFF) ||   // CJK統合漢字、ひらがな、カタカナ、句読点
    (code >= 0xAC00 && code <= 0xD7AF) ||   // ハングル
    (code >= 0xFF00 && code <= 0xFFEF) ||   // 全角ASCII、半角カタカナ
    (code >= 0x20000 && code <= 0x2A6DF)    // CJK統合漢字拡張B
  );
}

/**
 * テキストの推定ピクセル幅を計算
 */
function estimateTextWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    if (isCJKCharacter(char)) {
      width += CJK_CHAR_WIDTH;
    } else {
      width += ASCII_CHAR_WIDTH;
    }
  }
  return width;
}

/**
 * HTMLタグを除去してプレーンテキストを取得
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * モジュール内のトップゴール（最上位のGoalノード）を探す
 */
function findTopGoalContent(
  moduleId: string | undefined,
  modules: Record<string, DiagramData> | undefined
): string | null {
  if (!moduleId || !modules) return null;

  const moduleData = modules[moduleId];
  if (!moduleData || !moduleData.nodes || moduleData.nodes.length === 0) return null;

  // リンクのターゲットになっていないノードを探す（親を持たないノード）
  const targetIds = new Set(moduleData.links?.map((link) => link.target) || []);
  const rootNodes = moduleData.nodes.filter(
    (node) => node.type === 'Goal' && !targetIds.has(node.id)
  );

  // ルートのGoalノードがあればそのcontentを返す
  if (rootNodes.length > 0) {
    return rootNodes[0].content;
  }

  // ルートがなければ最初のGoalノードを探す
  const firstGoal = moduleData.nodes.find((node) => node.type === 'Goal');
  return firstGoal ? firstGoal.content : null;
}

/**
 * テキストが収まるサイズを計算し、黄金比（横長）に近づける
 * 文字がはみ出さないことを最優先にする
 * 日本語/英語混在テキストに対応
 */
function calculateSizeWithText(
  text: string,
  minWidth: number,
  maxWidth: number,
  minHeight: number,
  maxHeight: number,
  extraPaddingY: number = 0,
  widthMultiplier: number = 1.0
): { width: number; height: number } {
  if (text.length === 0) {
    // 空のノードは黄金比で最小サイズ（横長）
    const width = Math.min(Math.round(minHeight * GOLDEN_RATIO), maxWidth);
    return { width: Math.max(width, minWidth), height: minHeight };
  }

  // テキストの推定総幅（ピクセル）
  const totalTextWidth = estimateTextWidth(text);
  const textContentWidth = maxWidth - PADDING_X;

  // 最大幅で何行必要か（ピクセルベースで計算）
  const linesAtMaxWidth = Math.ceil(totalTextWidth / Math.max(textContentWidth, 1));
  const heightAtMaxWidth = linesAtMaxWidth * LINE_HEIGHT + PADDING_Y + extraPaddingY;

  // 黄金比に基づく理想の高さ（幅が最大の場合）
  const idealHeightForMaxWidth = maxWidth / GOLDEN_RATIO;

  let finalWidth: number;
  let finalHeight: number;

  // テキストが収まる最小の高さと、黄金比の高さを比較
  if (heightAtMaxWidth <= idealHeightForMaxWidth) {
    // テキストが黄金比の高さ内に収まる場合
    // 幅を少し縮めて、黄金比に近づける
    finalHeight = Math.max(heightAtMaxWidth, minHeight);
    finalWidth = Math.round(finalHeight * GOLDEN_RATIO * widthMultiplier);

    // 幅が最大を超えたら調整
    if (finalWidth > maxWidth) {
      finalWidth = maxWidth;
    }

    // 幅を縮めた場合、テキストが収まるか再確認
    const contentWidth = finalWidth - PADDING_X;
    const actualLines = Math.ceil(totalTextWidth / Math.max(contentWidth, 1));
    const actualHeight = actualLines * LINE_HEIGHT + PADDING_Y + extraPaddingY;

    if (actualHeight > finalHeight) {
      // テキストが収まらない場合は高さを増やす
      finalHeight = actualHeight;
      // 黄金比を維持するため幅も再調整
      const newWidth = Math.round(finalHeight * GOLDEN_RATIO * widthMultiplier);
      if (newWidth <= maxWidth) {
        finalWidth = newWidth;
      }
    }
  } else {
    // テキストが多い場合は最大幅を使用
    finalWidth = maxWidth;
    finalHeight = heightAtMaxWidth;
  }

  // 幅が最小値を下回る場合は調整
  if (finalWidth < minWidth) {
    finalWidth = minWidth;
    // この幅で何行必要か再計算
    const contentWidth = finalWidth - PADDING_X;
    const numLines = Math.ceil(totalTextWidth / Math.max(contentWidth, 1));
    finalHeight = numLines * LINE_HEIGHT + PADDING_Y + extraPaddingY;
  }

  // 最終段階: 上下の余白が大きすぎる場合は縮める
  const finalContentWidth = finalWidth - PADDING_X;
  const finalNumLines = Math.ceil(totalTextWidth / Math.max(finalContentWidth, 1));
  const requiredTextHeight = finalNumLines * LINE_HEIGHT;
  const minRequiredHeight = requiredTextHeight + PADDING_Y + extraPaddingY;

  // 余白を確認し、必要最小限に縮める（ただし黄金比を大きく崩さない範囲で）
  if (finalHeight > minRequiredHeight) {
    const excessHeight = finalHeight - minRequiredHeight;
    // 余白がテキスト高さの50%以上あれば縮める
    if (excessHeight > requiredTextHeight * 0.5) {
      // 適度な余白（テキスト高さの30%程度）を残す
      const targetHeight = minRequiredHeight + requiredTextHeight * 0.3;
      finalHeight = Math.max(targetHeight, minHeight);
    }
  }

  return {
    width: Math.round(Math.min(Math.max(finalWidth, minWidth), maxWidth)),
    height: Math.round(Math.min(Math.max(finalHeight, minHeight), maxHeight)),
  };
}

/**
 * テキスト内容に基づいて最適なノードサイズを計算（黄金比適用）
 */
function calculateOptimalSize(
  content: string,
  nodeType: string,
  moduleId?: string,
  modules?: Record<string, DiagramData>
): { width: number; height: number } {
  const text = stripHtml(content);

  // Context系ノードは小さめに
  const isContext = nodeType === 'Context' || nodeType === 'Assumption' || nodeType === 'Justification';
  const baseMaxWidth = isContext ? 200 : MAX_NODE_WIDTH;
  const baseMinWidth = isContext ? 100 : MIN_NODE_WIDTH;
  const baseMinHeight = isContext ? 50 : MIN_NODE_HEIGHT;

  // 空のノード
  if (text.length === 0) {
    const height = baseMinHeight;
    const width = Math.min(Math.round(height * GOLDEN_RATIO), baseMaxWidth);
    return { width, height };
  }

  // Undevelopedノードはダイヤモンド形状なので、正方形に近く
  if (nodeType === 'Undeveloped') {
    const size = calculateSizeWithText(text, baseMinWidth, baseMaxWidth, MIN_NODE_HEIGHT, MAX_NODE_HEIGHT);
    const avgSize = (size.width + size.height) / 2;
    return {
      width: Math.min(Math.max(Math.round(avgSize * 1.1), baseMinWidth), baseMaxWidth),
      height: Math.min(Math.max(Math.round(avgSize * 0.9), MIN_NODE_HEIGHT), MAX_NODE_HEIGHT),
    };
  }

  // Moduleノードはフォルダ形状で、中のトップゴールの内容が表示される
  if (nodeType === 'Module') {
    const topGoalContent = findTopGoalContent(moduleId, modules);
    if (topGoalContent) {
      const topGoalText = stripHtml(topGoalContent);

      if (topGoalText.length > 0) {
        return calculateSizeWithText(
          topGoalText,
          baseMinWidth,
          MAX_NODE_WIDTH + 20,
          MIN_NODE_HEIGHT + 20,
          MAX_NODE_HEIGHT + 40,
          20, // タブ部分のため追加パディング
          1.1
        );
      }
    }

    // トップゴールがない場合
    return calculateSizeWithText(
      text,
      baseMinWidth,
      baseMaxWidth,
      MIN_NODE_HEIGHT,
      MAX_NODE_HEIGHT,
      20,
      1.1
    );
  }

  // 楕円形ノード（Evidence等）は少し大きめに
  if (nodeType === 'Evidence' || nodeType === 'Assumption' || nodeType === 'Justification') {
    return calculateSizeWithText(
      text,
      baseMinWidth,
      baseMaxWidth,
      baseMinHeight,
      MAX_NODE_HEIGHT,
      0,
      1.15
    );
  }

  // 通常のノード（Goal, Strategy等）
  return calculateSizeWithText(
    text,
    baseMinWidth,
    baseMaxWidth,
    MIN_NODE_HEIGHT,
    MAX_NODE_HEIGHT
  );
}

/**
 * ノードのサイズを内容に合わせて最適化
 */
function optimizeNodeSizes(
  nodes: Node[],
  modules?: Record<string, DiagramData>
): Node[] {
  return nodes.map((node) => {
    const optimalSize = calculateOptimalSize(
      node.content,
      node.type,
      node.moduleId,
      modules
    );
    return {
      ...node,
      size: optimalSize,
    };
  });
}

/**
 * ノードがContext系（横配置）かどうか判定
 */
function isContextNode(nodeType: string): boolean {
  return nodeType === 'Context' || nodeType === 'Assumption' || nodeType === 'Justification';
}

/**
 * ノードのContext系ノードの合計幅を計算（片側分）
 */
function getContextWidth(node: TreeNode, side: 'left' | 'right'): number {
  if (node.contextNodes.length === 0) return 0;

  const halfCount = Math.ceil(node.contextNodes.length / 2);
  let contextNodes: TreeNode[];

  if (side === 'right') {
    contextNodes = node.contextNodes.slice(0, halfCount);
  } else {
    contextNodes = node.contextNodes.slice(halfCount);
  }

  if (contextNodes.length === 0) return 0;

  // 最大幅のContextノードを使用
  const maxWidth = Math.max(...contextNodes.map(ctx => ctx.width));
  return maxWidth + CONTEXT_GAP;
}

/**
 * ツリー構造を構築
 */
function buildTree(
  nodes: Node[],
  links: Link[],
  rootId: string
): TreeNode | null {
  const nodeMap = new Map<string, Node>();
  nodes.forEach((node) => nodeMap.set(node.id, node));

  const rootNode = nodeMap.get(rootId);
  if (!rootNode) return null;

  const visited = new Set<string>();

  const buildRecursive = (
    nodeId: string,
    parent: TreeNode | null
  ): TreeNode | null => {
    if (visited.has(nodeId)) return null; // 循環参照防止
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) return null;

    const treeNode: TreeNode = {
      id: nodeId,
      node,
      children: [],
      contextNodes: [],
      parent,
      x: 0,
      y: 0,
      mod: 0,
      width: node.size?.width || DEFAULT_NODE_WIDTH,
      height: node.size?.height || DEFAULT_NODE_HEIGHT,
    };

    // 子ノードを探す
    const childLinks = links.filter((link) => link.source === nodeId);
    childLinks.forEach((link) => {
      const childNode = nodeMap.get(link.target);
      if (!childNode) return;

      const child = buildRecursive(link.target, treeNode);
      if (child) {
        // Context系ノードは別リストに格納
        if (isContextNode(childNode.type)) {
          treeNode.contextNodes.push(child);
        } else {
          treeNode.children.push(child);
        }
      }
    });

    return treeNode;
  };

  return buildRecursive(rootId, null);
}

/**
 * ルートノードを見つける（親を持たないノード）
 */
function findRootNodes(nodes: Node[], links: Link[]): string[] {
  const hasParent = new Set(links.map((link) => link.target));
  return nodes
    .filter((node) => !hasParent.has(node.id))
    .map((node) => node.id);
}

/**
 * 2つのノード間の必要な水平間隔を計算（Context系ノードの幅を含む）
 */
function getRequiredHorizontalSpacing(leftNode: TreeNode, rightNode: TreeNode): number {
  // 左ノードの右側Context幅 + 右ノードの左側Context幅を考慮
  const leftContextWidth = getContextWidth(leftNode, 'right');
  const rightContextWidth = getContextWidth(rightNode, 'left');

  return (leftNode.width / 2) + leftContextWidth + MIN_HORIZONTAL_GAP + rightContextWidth + (rightNode.width / 2);
}

/**
 * 各レベルの最大ノード高さを計算
 */
function getMaxHeightPerLevel(root: TreeNode): Map<number, number> {
  const maxHeights = new Map<number, number>();

  const traverse = (node: TreeNode, level: number) => {
    const currentMax = maxHeights.get(level) || 0;
    maxHeights.set(level, Math.max(currentMax, node.height));

    node.children.forEach((child) => traverse(child, level + 1));
  };

  traverse(root, 0);
  return maxHeights;
}

/**
 * 兄弟ノードとの境界を計算
 */
function getSiblingBoundaries(node: TreeNode): { leftBound: number | null; rightBound: number | null } {
  if (!node.parent) {
    return { leftBound: null, rightBound: null };
  }

  const siblings = node.parent.children;
  const index = siblings.indexOf(node);

  let leftBound: number | null = null;
  let rightBound: number | null = null;

  // 左の兄弟ノードの右端
  if (index > 0) {
    const leftSibling = siblings[index - 1];
    leftBound = leftSibling.x + leftSibling.width / 2 + getContextWidth(leftSibling, 'right');
  }

  // 右の兄弟ノードの左端
  if (index < siblings.length - 1) {
    const rightSibling = siblings[index + 1];
    rightBound = rightSibling.x - rightSibling.width / 2 - getContextWidth(rightSibling, 'left');
  }

  return { leftBound, rightBound };
}

/**
 * Reingold-Tilford アルゴリズムでツリーの相対座標を計算
 * ノードサイズを考慮して重なりを防止
 */
function calculateTreeLayout(root: TreeNode): void {
  // 各レベルの最大高さを事前計算
  const maxHeightPerLevel = getMaxHeightPerLevel(root);

  // 左の兄弟ノードを取得
  function getLeftSibling(node: TreeNode): TreeNode | null {
    if (!node.parent) return null;
    const siblings = node.parent.children;
    const index = siblings.indexOf(node);
    return index > 0 ? siblings[index - 1] : null;
  }

  // 第1パス: 各ノードの初期X座標を計算（後順走査）
  function firstWalk(node: TreeNode): void {
    if (node.children.length === 0) {
      // 葉ノード
      if (node.parent && node.parent.children[0] === node) {
        // 最初の子
        node.x = 0;
      } else if (node.parent) {
        // 兄弟ノードの右側に配置（ノードサイズ + Context幅考慮）
        const leftSibling = getLeftSibling(node);
        if (leftSibling) {
          const spacing = getRequiredHorizontalSpacing(leftSibling, node);
          node.x = leftSibling.x + spacing;
        }
      }
    } else {
      // 子を持つノード
      node.children.forEach((child) => firstWalk(child));

      // 子ノードの中央に配置
      const leftmost = node.children[0];
      const rightmost = node.children[node.children.length - 1];
      const mid = (leftmost.x + rightmost.x) / 2;

      if (node.parent && node.parent.children[0] === node) {
        // 最初の子
        node.x = mid;
      } else if (node.parent) {
        const leftSibling = getLeftSibling(node);
        if (leftSibling) {
          const spacing = getRequiredHorizontalSpacing(leftSibling, node);
          node.x = leftSibling.x + spacing;
          node.mod = node.x - mid;
        }
      } else {
        // ルートノード
        node.x = mid;
      }
    }
  }

  // 第2パス: modifier を適用して最終座標を計算（前順走査）
  function secondWalk(node: TreeNode, modSum: number, level: number, yOffset: number): void {
    node.x += modSum;
    node.y = yOffset;

    // 次のレベルのY座標を計算（現在のレベルの最大高さ + ギャップ）
    const currentLevelMaxHeight = maxHeightPerLevel.get(level) || node.height;
    const nextYOffset = yOffset + currentLevelMaxHeight + MIN_VERTICAL_GAP;

    node.children.forEach((child) => {
      secondWalk(child, modSum + node.mod, level + 1, nextYOffset);
    });
  }

  firstWalk(root);
  secondWalk(root, 0, 0, 0);

  // 第3パス: Context系ノードの配置（兄弟ノードの境界を考慮）
  placeContextNodes(root);

  // 第4パス: 重なり検出と修正
  fixOverlaps(root);
}

/**
 * Context系ノードを配置（兄弟ノードを飛び越えないように）
 */
function placeContextNodes(root: TreeNode): void {
  const placeRecursive = (node: TreeNode) => {
    // まず子ノードのContext配置を再帰的に処理
    node.children.forEach((child) => placeRecursive(child));

    if (node.contextNodes.length === 0) return;

    // 兄弟ノードとの境界を取得
    const { leftBound, rightBound } = getSiblingBoundaries(node);

    // Context系ノードを左右に振り分け
    const halfCount = Math.ceil(node.contextNodes.length / 2);
    const rightContextNodes = node.contextNodes.slice(0, halfCount);
    const leftContextNodes = node.contextNodes.slice(halfCount);

    // 右側のContext配置
    const nodeRightEdge = node.x + node.width / 2;
    let rightYOffset = node.y - ((rightContextNodes.length - 1) * (DEFAULT_NODE_HEIGHT + CONTEXT_GAP)) / 2;

    rightContextNodes.forEach((contextNode) => {
      let contextX = nodeRightEdge + CONTEXT_GAP + contextNode.width / 2;

      // 右の兄弟ノードの境界を超えないように制限
      if (rightBound !== null) {
        const maxX = rightBound - CONTEXT_GAP - contextNode.width / 2;
        contextX = Math.min(contextX, maxX);
      }

      contextNode.x = contextX;
      contextNode.y = rightYOffset;
      rightYOffset += contextNode.height + CONTEXT_GAP;
    });

    // 左側のContext配置
    const nodeLeftEdge = node.x - node.width / 2;
    let leftYOffset = node.y - ((leftContextNodes.length - 1) * (DEFAULT_NODE_HEIGHT + CONTEXT_GAP)) / 2;

    leftContextNodes.forEach((contextNode) => {
      let contextX = nodeLeftEdge - CONTEXT_GAP - contextNode.width / 2;

      // 左の兄弟ノードの境界を超えないように制限
      if (leftBound !== null) {
        const minX = leftBound + CONTEXT_GAP + contextNode.width / 2;
        contextX = Math.max(contextX, minX);
      }

      contextNode.x = contextX;
      contextNode.y = leftYOffset;
      leftYOffset += contextNode.height + CONTEXT_GAP;
    });
  };

  placeRecursive(root);
}

/**
 * ノード間の重なりを検出して修正
 */
function fixOverlaps(root: TreeNode): void {
  // すべてのノードを収集
  const allNodes: TreeNode[] = [];
  const collectNodes = (node: TreeNode) => {
    allNodes.push(node);
    node.contextNodes.forEach((ctx) => allNodes.push(ctx));
    node.children.forEach((child) => collectNodes(child));
  };
  collectNodes(root);

  // マージン（ノード間の最小間隔）
  const margin = 10;

  // 重なりチェックと修正（最大20回繰り返し）
  for (let iteration = 0; iteration < 20; iteration++) {
    let hasOverlap = false;

    for (let i = 0; i < allNodes.length; i++) {
      for (let j = i + 1; j < allNodes.length; j++) {
        const nodeA = allNodes[i];
        const nodeB = allNodes[j];

        // バウンディングボックスの重なりチェック（マージン込み）
        const aLeft = nodeA.x - nodeA.width / 2 - margin;
        const aRight = nodeA.x + nodeA.width / 2 + margin;
        const aTop = nodeA.y - nodeA.height / 2 - margin;
        const aBottom = nodeA.y + nodeA.height / 2 + margin;

        const bLeft = nodeB.x - nodeB.width / 2 - margin;
        const bRight = nodeB.x + nodeB.width / 2 + margin;
        const bTop = nodeB.y - nodeB.height / 2 - margin;
        const bBottom = nodeB.y + nodeB.height / 2 + margin;

        const overlapX = aRight > bLeft && aLeft < bRight;
        const overlapY = aBottom > bTop && aTop < bBottom;

        if (overlapX && overlapY) {
          hasOverlap = true;

          // 重なり量を計算
          const overlapAmountX = Math.min(aRight - bLeft, bRight - aLeft);
          const overlapAmountY = Math.min(aBottom - bTop, bBottom - aTop);

          // 重なりが少ない方向に移動（水平または垂直）
          if (overlapAmountX < overlapAmountY) {
            // 水平方向に移動
            const moveDistance = (overlapAmountX / 2) + margin;
            if (nodeA.x < nodeB.x) {
              nodeA.x -= moveDistance;
              nodeB.x += moveDistance;
            } else {
              nodeA.x += moveDistance;
              nodeB.x -= moveDistance;
            }
          } else {
            // 垂直方向に移動
            const moveDistance = (overlapAmountY / 2) + margin;
            if (nodeA.y < nodeB.y) {
              nodeA.y -= moveDistance;
              nodeB.y += moveDistance;
            } else {
              nodeA.y += moveDistance;
              nodeB.y -= moveDistance;
            }
          }
        }
      }
    }

    if (!hasOverlap) break;
  }
}

/**
 * TreeNodeから実際のノード位置を抽出
 */
function extractPositions(
  root: TreeNode,
  offsetX: number = 0,
  offsetY: number = 0
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  const traverse = (node: TreeNode) => {
    positions.set(node.id, {
      x: node.x + offsetX,
      y: node.y + offsetY,
    });

    // Context系ノードの位置も追加
    node.contextNodes.forEach((contextNode) => {
      positions.set(contextNode.id, {
        x: contextNode.x + offsetX,
        y: contextNode.y + offsetY,
      });
    });

    node.children.forEach((child) => traverse(child));
  };

  traverse(root);
  return positions;
}

/**
 * 自動レイアウトを実行
 * @param nodes ノードリスト
 * @param links リンクリスト
 * @param modules モジュールデータ（Moduleノードのサイズ計算に使用）
 * @returns 更新されたノードリスト（位置とサイズが最適化される）
 */
export function autoLayout(
  nodes: Node[],
  links: Link[],
  modules?: Record<string, DiagramData>
): Node[] {
  if (nodes.length === 0) return nodes;

  // まずノードサイズを内容に合わせて最適化（Moduleノードは内部のトップゴールに基づく）
  const optimizedNodes = optimizeNodeSizes(nodes, modules);

  // ルートノードを見つける（Context系ノードは除外）
  const allRootIds = findRootNodes(optimizedNodes, links);
  const rootIds = allRootIds.filter((id) => {
    const node = optimizedNodes.find((n) => n.id === id);
    return node && !isContextNode(node.type);
  });

  if (rootIds.length === 0) {
    // ルートがない場合（循環グラフ）、最初の非Context系ノードをルートとして扱う
    const firstMainNode = optimizedNodes.find((n) => !isContextNode(n.type));
    if (firstMainNode) {
      rootIds.push(firstMainNode.id);
    } else {
      // すべてContext系ノードの場合はそのまま返す
      return optimizedNodes;
    }
  }

  // 各ルートからツリーを構築
  const trees: TreeNode[] = [];

  rootIds.forEach((rootId) => {
    const tree = buildTree(optimizedNodes, links, rootId);
    if (tree) {
      trees.push(tree);
    }
  });

  // 各ツリーにレイアウトアルゴリズムを適用
  trees.forEach((tree) => {
    calculateTreeLayout(tree);
  });

  // ツリーの境界を計算する関数
  function getTreeBounds(tree: TreeNode): { minX: number; maxX: number; minY: number; maxY: number } {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    const traverse = (node: TreeNode) => {
      const left = node.x - node.width / 2;
      const right = node.x + node.width / 2;
      const top = node.y - node.height / 2;
      const bottom = node.y + node.height / 2;

      minX = Math.min(minX, left);
      maxX = Math.max(maxX, right);
      minY = Math.min(minY, top);
      maxY = Math.max(maxY, bottom);

      node.contextNodes.forEach((ctx) => {
        const ctxLeft = ctx.x - ctx.width / 2;
        const ctxRight = ctx.x + ctx.width / 2;
        const ctxTop = ctx.y - ctx.height / 2;
        const ctxBottom = ctx.y + ctx.height / 2;
        minX = Math.min(minX, ctxLeft);
        maxX = Math.max(maxX, ctxRight);
        minY = Math.min(minY, ctxTop);
        maxY = Math.max(maxY, ctxBottom);
      });

      node.children.forEach((child) => traverse(child));
    };

    traverse(tree);
    return { minX, maxX, minY, maxY };
  }

  // 実際にツリーから位置を取得して適用
  // 各ツリーのオフセットを計算（ツリー間の重なりを防止）
  const treeOffsets: number[] = [];
  let currentOffsetX = INITIAL_OFFSET_X;

  trees.forEach((tree, treeIndex) => {
    const bounds = getTreeBounds(tree);
    const treeWidth = bounds.maxX - bounds.minX;

    if (treeIndex === 0) {
      // 最初のツリーは左端を基準に配置
      treeOffsets.push(currentOffsetX - bounds.minX);
    } else {
      // 前のツリーとの間隔を確保
      treeOffsets.push(currentOffsetX - bounds.minX);
    }

    currentOffsetX += treeWidth + MIN_HORIZONTAL_GAP * 2;
  });

  // optimizedNodesからサイズ情報を取得するためのマップを作成
  const sizeMap = new Map<string, { width: number; height: number }>();
  optimizedNodes.forEach((node) => {
    sizeMap.set(node.id, node.size);
  });

  const finalNodes = nodes.map((node) => {
    let found = false;
    let newPos = node.position;

    trees.forEach((tree, treeIndex) => {
      const offsetX = treeOffsets[treeIndex] || INITIAL_OFFSET_X;
      const treePositions = extractPositions(tree, offsetX, 100);
      const pos = treePositions.get(node.id);
      if (pos && !found) {
        newPos = pos;
        found = true;
      }
    });

    // 最適化されたサイズを適用
    const optimizedSize = sizeMap.get(node.id) || node.size;

    return {
      ...node,
      position: newPos,
      size: optimizedSize,
    };
  });

  return finalNodes;
}
