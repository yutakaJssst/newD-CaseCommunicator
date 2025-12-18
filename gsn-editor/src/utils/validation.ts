import type { Node, Link } from '../types/diagram';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: 'error';
  code: string;
  message: string;
  nodeIds?: string[];
}

export interface ValidationWarning {
  type: 'warning';
  code: string;
  message: string;
  nodeIds?: string[];
}

/**
 * GSNダイアグラムの検証を行う
 */
export function validateDiagram(nodes: Node[], links: Link[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 1. ルートノードのチェック
  const rootCheck = checkRootNodes(nodes, links);
  if (rootCheck.error) errors.push(rootCheck.error);
  if (rootCheck.warning) warnings.push(rootCheck.warning);

  // 2. 循環参照のチェック
  const cycleCheck = checkCyclicReferences(nodes, links);
  if (cycleCheck.error) errors.push(cycleCheck.error);

  // 3. 孤立ノードのチェック
  const orphanCheck = checkOrphanNodes(nodes, links);
  if (orphanCheck.warning) warnings.push(orphanCheck.warning);

  // 4. 未展開ゴールのチェック
  const undevelopedCheck = checkUndevelopedGoals(nodes, links);
  if (undevelopedCheck.warning) warnings.push(undevelopedCheck.warning);

  // 5. Evidence到達チェック
  const evidenceCheck = checkEvidenceReachability(nodes, links);
  if (evidenceCheck.warning) warnings.push(evidenceCheck.warning);

  // 6. Strategyの子ノードチェック
  const strategyCheck = checkStrategyChildren(nodes, links);
  if (strategyCheck.warning) warnings.push(strategyCheck.warning);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * ルートノード（親がいないGoal）のチェック
 */
function checkRootNodes(nodes: Node[], links: Link[]): { error?: ValidationError; warning?: ValidationWarning } {
  const goalNodes = nodes.filter(n => n.type === 'Goal');

  if (goalNodes.length === 0) {
    return {
      error: {
        type: 'error',
        code: 'NO_ROOT_GOAL',
        message: 'ルートとなるゴールノードがありません',
      },
    };
  }

  // 親を持たないGoalを探す
  const childNodeIds = new Set(links.map(l => l.target));
  const rootGoals = goalNodes.filter(g => !childNodeIds.has(g.id));

  if (rootGoals.length === 0) {
    return {
      error: {
        type: 'error',
        code: 'NO_ROOT_GOAL',
        message: 'ルートとなるゴールノードがありません（全てのゴールが他のノードの子になっています）',
      },
    };
  }

  if (rootGoals.length > 1) {
    return {
      warning: {
        type: 'warning',
        code: 'MULTIPLE_ROOT_GOALS',
        message: `複数のルートゴールがあります（${rootGoals.length}個）。通常は1つのルートゴールが推奨されます`,
        nodeIds: rootGoals.map(g => g.id),
      },
    };
  }

  return {};
}

/**
 * 循環参照のチェック（深さ優先探索）
 */
function checkCyclicReferences(nodes: Node[], links: Link[]): { error?: ValidationError } {
  const adjacencyList = new Map<string, string[]>();

  // 隣接リストを構築
  for (const link of links) {
    if (!adjacencyList.has(link.source)) {
      adjacencyList.set(link.source, []);
    }
    adjacencyList.get(link.source)!.push(link.target);
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycleNodes: string[] = [];

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const children = adjacencyList.get(nodeId) || [];
    for (const childId of children) {
      if (!visited.has(childId)) {
        if (dfs(childId)) {
          cycleNodes.push(nodeId);
          return true;
        }
      } else if (recursionStack.has(childId)) {
        cycleNodes.push(childId);
        cycleNodes.push(nodeId);
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) {
        return {
          error: {
            type: 'error',
            code: 'CYCLIC_REFERENCE',
            message: '循環参照が検出されました。GSNはツリー構造である必要があります',
            nodeIds: [...new Set(cycleNodes)],
          },
        };
      }
    }
  }

  return {};
}

/**
 * 孤立ノード（リンクがないノード）のチェック
 */
function checkOrphanNodes(nodes: Node[], links: Link[]): { warning?: ValidationWarning } {
  if (nodes.length <= 1) return {};

  const linkedNodeIds = new Set<string>();
  for (const link of links) {
    linkedNodeIds.add(link.source);
    linkedNodeIds.add(link.target);
  }

  const orphanNodes = nodes.filter(n => !linkedNodeIds.has(n.id));

  if (orphanNodes.length > 0) {
    // ルートゴールが1つだけの場合は孤立ではない
    if (orphanNodes.length === 1 && orphanNodes[0].type === 'Goal' && nodes.length === 1) {
      return {};
    }

    return {
      warning: {
        type: 'warning',
        code: 'ORPHAN_NODES',
        message: `孤立したノードがあります（${orphanNodes.length}個）。他のノードと接続してください`,
        nodeIds: orphanNodes.map(n => n.id),
      },
    };
  }

  return {};
}

/**
 * 未展開ゴールのチェック
 * Goal/Strategyノードで子ノードがなく、Undevelopedマーカーもない
 */
function checkUndevelopedGoals(nodes: Node[], links: Link[]): { warning?: ValidationWarning } {
  const parentNodeIds = new Set(links.map(l => l.source));

  const undevelopedGoals = nodes.filter(n => {
    // GoalまたはStrategyで子ノードがない
    if ((n.type === 'Goal' || n.type === 'Strategy') && !parentNodeIds.has(n.id)) {
      // Undevelopedノードへのリンクがあるかチェック
      const hasUndevelopedChild = links.some(l => {
        if (l.source !== n.id) return false;
        const targetNode = nodes.find(node => node.id === l.target);
        return targetNode?.type === 'Undeveloped';
      });
      return !hasUndevelopedChild;
    }
    return false;
  });

  if (undevelopedGoals.length > 0) {
    return {
      warning: {
        type: 'warning',
        code: 'UNDEVELOPED_GOALS',
        message: `未展開のゴール/戦略があります（${undevelopedGoals.length}個）。子ノードを追加するか、Undevelopedマーカーを付けてください`,
        nodeIds: undevelopedGoals.map(n => n.id),
      },
    };
  }

  return {};
}

/**
 * Evidence到達チェック
 * 全てのGoalパスがEvidence（またはUndeveloped）に到達しているか
 */
function checkEvidenceReachability(nodes: Node[], links: Link[]): { warning?: ValidationWarning } {
  const goalNodes = nodes.filter(n => n.type === 'Goal');
  const adjacencyList = new Map<string, string[]>();

  for (const link of links) {
    if (!adjacencyList.has(link.source)) {
      adjacencyList.set(link.source, []);
    }
    adjacencyList.get(link.source)!.push(link.target);
  }

  // 各ゴールからEvidenceまたはUndevelopedに到達できるかチェック
  function canReachEvidence(nodeId: string, visited: Set<string>): boolean {
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return false;

    // Evidence, Undeveloped, Moduleに到達したらOK
    if (node.type === 'Evidence' || node.type === 'Undeveloped' || node.type === 'Module') {
      return true;
    }

    // Context, Assumption, Justificationは無視（SupportedBy関係ではない）
    if (node.type === 'Context' || node.type === 'Assumption' || node.type === 'Justification') {
      return true;
    }

    const children = adjacencyList.get(nodeId) || [];
    if (children.length === 0) {
      // 子がいない場合はEvidenceに到達できない
      return false;
    }

    // 子ノードのうち、SupportedBy関係（Goal, Strategy, Evidence, Undeveloped, Module）だけをチェック
    const supportedByChildren = children.filter(childId => {
      const child = nodes.find(n => n.id === childId);
      return child && ['Goal', 'Strategy', 'Evidence', 'Undeveloped', 'Module'].includes(child.type);
    });

    if (supportedByChildren.length === 0) {
      return false;
    }

    return supportedByChildren.every(childId => canReachEvidence(childId, new Set(visited)));
  }

  const unreachableGoals = goalNodes.filter(g => !canReachEvidence(g.id, new Set()));

  if (unreachableGoals.length > 0) {
    return {
      warning: {
        type: 'warning',
        code: 'NO_EVIDENCE_PATH',
        message: `証拠（Evidence）に到達できないゴールがあります（${unreachableGoals.length}個）`,
        nodeIds: unreachableGoals.map(n => n.id),
      },
    };
  }

  return {};
}

/**
 * Strategyの子ノードチェック
 * Strategyは複数の子ノード（Goal）を持つべき
 */
function checkStrategyChildren(nodes: Node[], links: Link[]): { warning?: ValidationWarning } {
  const strategyNodes = nodes.filter(n => n.type === 'Strategy');

  const strategiesWithSingleChild = strategyNodes.filter(s => {
    const children = links.filter(l => l.source === s.id);
    // SupportedBy関係の子ノード（Goal, Strategy, Evidence, Undeveloped, Module）をカウント
    const supportedByChildren = children.filter(l => {
      const child = nodes.find(n => n.id === l.target);
      return child && ['Goal', 'Strategy', 'Evidence', 'Undeveloped', 'Module'].includes(child.type);
    });
    return supportedByChildren.length === 1;
  });

  if (strategiesWithSingleChild.length > 0) {
    return {
      warning: {
        type: 'warning',
        code: 'SINGLE_CHILD_STRATEGY',
        message: `子ノードが1つだけの戦略があります（${strategiesWithSingleChild.length}個）。戦略は通常、複数のサブゴールに分解するために使用します`,
        nodeIds: strategiesWithSingleChild.map(n => n.id),
      },
    };
  }

  return {};
}

/**
 * ノードラベルを取得
 */
export function getNodeLabel(node: Node): string {
  return node.label || node.id.slice(0, 8);
}
