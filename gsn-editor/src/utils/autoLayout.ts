import type { Node, Link } from '../types/diagram';

/**
 * ツリー構造の自動レイアウトアルゴリズム
 * - 主要ノード（Goal、Strategy、Evidence等）は縦に階層配置
 * - Context系ノード（Context、Assumption、Justification）は横に配置
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
}

const HORIZONTAL_SPACING = 250; // ノード間の水平間隔
const VERTICAL_SPACING = 180;   // レベル間の垂直間隔
const CONTEXT_HORIZONTAL_OFFSET = 200; // Contextノードの横オフセット
const CONTEXT_VERTICAL_SPACING = 140;  // Contextノード間の垂直間隔

/**
 * ノードがContext系（横配置）かどうか判定
 */
function isContextNode(nodeType: string): boolean {
  return nodeType === 'Context' || nodeType === 'Assumption' || nodeType === 'Justification';
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
 * Reingold-Tilford アルゴリズムでツリーの相対座標を計算
 */
function calculateTreeLayout(root: TreeNode): void {
  // 第1パス: 各ノードの初期X座標を計算（後順走査）
  function firstWalk(node: TreeNode): void {
    if (node.children.length === 0) {
      // 葉ノード
      if (node.parent && node.parent.children[0] === node) {
        // 最初の子
        node.x = 0;
      } else if (node.parent) {
        // 兄弟ノードの右側に配置
        const leftSibling = getLeftSibling(node);
        if (leftSibling) {
          node.x = leftSibling.x + HORIZONTAL_SPACING;
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
          node.x = leftSibling.x + HORIZONTAL_SPACING;
          node.mod = node.x - mid;
        }
      } else {
        // ルートノード
        node.x = mid;
      }
    }
  }

  // 第2パス: modifier を適用して最終座標を計算（前順走査）
  function secondWalk(node: TreeNode, modSum: number, level: number): void {
    node.x += modSum;
    node.y = level * VERTICAL_SPACING;

    node.children.forEach((child) => {
      secondWalk(child, modSum + node.mod, level + 1);
    });

    // Context系ノードの配置
    node.contextNodes.forEach((contextNode, index) => {
      // 親ノードの右側に配置
      contextNode.x = node.x + CONTEXT_HORIZONTAL_OFFSET;
      // 複数ある場合は縦にずらす
      contextNode.y = node.y + (index - (node.contextNodes.length - 1) / 2) * CONTEXT_VERTICAL_SPACING;
    });
  }

  // 左の兄弟ノードを取得
  function getLeftSibling(node: TreeNode): TreeNode | null {
    if (!node.parent) return null;
    const siblings = node.parent.children;
    const index = siblings.indexOf(node);
    return index > 0 ? siblings[index - 1] : null;
  }

  firstWalk(root);
  secondWalk(root, 0, 0);
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
 * @returns 更新されたノードリスト
 */
export function autoLayout(nodes: Node[], links: Link[]): Node[] {
  if (nodes.length === 0) return nodes;

  // ルートノードを見つける（Context系ノードは除外）
  const allRootIds = findRootNodes(nodes, links);
  const rootIds = allRootIds.filter((id) => {
    const node = nodes.find((n) => n.id === id);
    return node && !isContextNode(node.type);
  });

  if (rootIds.length === 0) {
    // ルートがない場合（循環グラフ）、最初の非Context系ノードをルートとして扱う
    const firstMainNode = nodes.find((n) => !isContextNode(n.type));
    if (firstMainNode) {
      rootIds.push(firstMainNode.id);
    } else {
      // すべてContext系ノードの場合はそのまま返す
      return nodes;
    }
  }

  // 各ルートからツリーを構築
  const trees: TreeNode[] = [];
  const processedNodes = new Set<string>();

  rootIds.forEach((rootId) => {
    const tree = buildTree(nodes, links, rootId);
    if (tree) {
      trees.push(tree);
      // 処理済みノードを記録
      const traverse = (node: TreeNode) => {
        processedNodes.add(node.id);
        node.children.forEach((child) => traverse(child));
        node.contextNodes.forEach((contextNode) => processedNodes.add(contextNode.id));
      };
      traverse(tree);
    }
  });

  // 各ツリーにレイアウトアルゴリズムを適用
  trees.forEach((tree) => {
    calculateTreeLayout(tree);
  });

  // 実際にツリーから位置を取得して適用
  const finalNodes = nodes.map((node) => {
    let found = false;
    let newPos = node.position;

    trees.forEach((tree, treeIndex) => {
      const offsetX = treeIndex * (HORIZONTAL_SPACING * 4) + 400;
      const treePositions = extractPositions(tree, offsetX, 100);
      const pos = treePositions.get(node.id);
      if (pos && !found) {
        newPos = pos;
        found = true;
      }
    });

    return {
      ...node,
      position: newPos,
    };
  });

  return finalNodes;
}
