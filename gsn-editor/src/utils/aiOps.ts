import type { AiOp } from '../api/ai';
import type { NodeType } from '../types/diagram';
import { useDiagramStore } from '../stores/diagramStore';

const NODE_OFFSET = 220;

const isNodeType = (value: string): value is NodeType =>
  ['Goal', 'Strategy', 'Context', 'Evidence', 'Assumption', 'Justification', 'Undeveloped', 'Module'].includes(value);

export const normalizeAiOps = (ops: unknown): AiOp[] => {
  if (!Array.isArray(ops)) return [];
  return ops
    .map((op) => {
      if (!op || typeof op !== 'object') return null;
      const raw = op as Record<string, unknown>;
      const type = raw.type as string | undefined;
      if (!type) return null;

      // Normalize field names: id -> nodeId, text -> content
      if (['updateNode', 'deleteNode', 'moveNode'].includes(type)) {
        const nodeId = (raw.nodeId ?? raw.id) as string | undefined;
        if (typeof nodeId !== 'string') return null;
        const updates = raw.updates as Record<string, unknown> | undefined;
        // Try multiple field names: content, text, or inside updates object
        const content = (raw.content ?? raw.text ?? updates?.content ?? updates?.text) as string | undefined;
        const label = (raw.label ?? updates?.label) as string | undefined;
        return {
          ...raw,
          type,
          nodeId,
          content,
          label,
        } as AiOp;
      }

      if (type === 'addNode') {
        const nodeType = raw.nodeType as string | undefined;
        if (typeof nodeType !== 'string' || !isNodeType(nodeType)) return null;
        const content = (raw.content ?? raw.text) as string | undefined;
        return { ...raw, type, nodeType, content } as AiOp;
      }

      if (type === 'addLink') {
        const { source, target } = raw as { source?: string; target?: string };
        if (typeof source !== 'string' || typeof target !== 'string') return null;
        return raw as AiOp;
      }

      if (type === 'deleteLink') {
        const linkId = raw.linkId as string | undefined;
        if (typeof linkId !== 'string') return null;
        return raw as AiOp;
      }

      return null;
    })
    .filter((op): op is AiOp => op !== null);
};

const computePosition = (
  anchor: { x: number; y: number } | null,
  direction?: 'up' | 'down' | 'left' | 'right',
) => {
  if (!anchor || !direction) {
    return { x: 0, y: 0 };
  }
  switch (direction) {
    case 'up':
      return { x: anchor.x, y: anchor.y - NODE_OFFSET };
    case 'down':
      return { x: anchor.x, y: anchor.y + NODE_OFFSET };
    case 'left':
      return { x: anchor.x - NODE_OFFSET, y: anchor.y };
    case 'right':
      return { x: anchor.x + NODE_OFFSET, y: anchor.y };
    default:
      return { x: anchor.x, y: anchor.y };
  }
};

export const applyAiOps = (ops: AiOp[]) => {
  const store = useDiagramStore.getState();
  ops.forEach((op) => {
    const state = useDiagramStore.getState();
    switch (op.type) {
      case 'addNode': {
        const anchorNode = op.anchor
          ? state.nodes.find((node) => node.id === op.anchor)
          : null;
        const position = computePosition(
          anchorNode ? { x: anchorNode.position.x, y: anchorNode.position.y } : null,
          op.direction,
        );
        const beforeIds = new Set(state.nodes.map((node) => node.id));
        store.addNode(op.nodeType, position.x, position.y);
        const nextState = useDiagramStore.getState();
        const newNode = nextState.nodes.find((node) => !beforeIds.has(node.id));
        if (newNode && (op.content || op.label)) {
          store.updateNode(newNode.id, {
            content: op.content ?? newNode.content,
            label: op.label ?? newNode.label,
          });
        }
        break;
      }
      case 'updateNode': {
        if (!state.nodes.find((node) => node.id === op.nodeId)) break;
        store.updateNode(op.nodeId, {
          content: op.content,
          label: op.label,
        });
        break;
      }
      case 'deleteNode': {
        if (!state.nodes.find((node) => node.id === op.nodeId)) break;
        store.deleteNode(op.nodeId);
        break;
      }
      case 'addLink': {
        const hasSource = state.nodes.find((node) => node.id === op.source);
        const hasTarget = state.nodes.find((node) => node.id === op.target);
        if (!hasSource || !hasTarget) break;
        store.addLink(op.source, op.target, op.linkType || 'solid');
        break;
      }
      case 'deleteLink': {
        const hasLink = state.links.find((link) => link.id === op.linkId);
        if (!hasLink) break;
        store.deleteLink(op.linkId);
        break;
      }
      case 'moveNode': {
        if (!state.nodes.find((node) => node.id === op.nodeId)) break;
        store.moveNode(op.nodeId, op.x, op.y);
        break;
      }
      default:
        break;
    }
  });
};

export const summarizeAiOps = (ops: AiOp[]) => {
  const state = useDiagramStore.getState();
  const nodeLabel = (nodeId: string) =>
    state.nodes.find((node) => node.id === nodeId)?.label || nodeId;

  return ops.map((op) => {
    switch (op.type) {
      case 'addNode':
        return `ノード追加: ${op.nodeType} (${op.anchor ?? 'no anchor'} -> ${op.direction ?? 'auto'})`;
      case 'updateNode':
        return `ノード更新: ${nodeLabel(op.nodeId)}`;
      case 'deleteNode':
        return `ノード削除: ${nodeLabel(op.nodeId)}`;
      case 'addLink':
        return `リンク追加: ${nodeLabel(op.source)} → ${nodeLabel(op.target)}`;
      case 'deleteLink':
        return `リンク削除: ${op.linkId}`;
      case 'moveNode':
        return `ノード移動: ${nodeLabel(op.nodeId)} (${op.x}, ${op.y})`;
      default:
        return '不明な操作';
    }
  });
};
