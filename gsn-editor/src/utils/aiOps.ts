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

export const applyAiOps = (ops: AiOp[], runAutoLayout = true) => {
  const store = useDiagramStore.getState();
  // Map AI-generated IDs to actual node IDs
  const idMap = new Map<string, string>();
  let hasAddNodeOps = false;

  console.log('[applyAiOps] Starting with ops:', JSON.stringify(ops, null, 2));

  ops.forEach((op, index) => {
    const state = useDiagramStore.getState();
    console.log(`[applyAiOps] Processing op ${index}:`, op.type, op);

    switch (op.type) {
      case 'addNode': {
        hasAddNodeOps = true;
        // Check if anchor uses an AI-generated ID that we've mapped
        const mappedAnchor = op.anchor ? (idMap.get(op.anchor) ?? op.anchor) : undefined;
        const anchorNode = mappedAnchor
          ? state.nodes.find((node) => node.id === mappedAnchor)
          : null;

        // If no anchor or anchor not found, use auto-layout position
        let position: { x: number; y: number };
        if (anchorNode && op.direction) {
          position = computePosition(
            { x: anchorNode.position.x, y: anchorNode.position.y },
            op.direction,
          );
        } else {
          // Auto-position based on existing nodes
          const existingNodes = state.nodes;
          if (existingNodes.length === 0) {
            // First node - center of viewport
            position = { x: 400, y: 100 };
          } else {
            // Position below existing nodes with offset
            const maxY = Math.max(...existingNodes.map(n => n.position.y));
            const avgX = existingNodes.reduce((sum, n) => sum + n.position.x, 0) / existingNodes.length;
            position = { x: avgX + (index * 50) % 200 - 100, y: maxY + NODE_OFFSET };
          }
        }

        console.log(`[applyAiOps] addNode position:`, position, 'anchor:', op.anchor, 'mappedAnchor:', mappedAnchor);

        const beforeIds = new Set(state.nodes.map((node) => node.id));
        store.addNode(op.nodeType, position.x, position.y);
        const nextState = useDiagramStore.getState();
        const newNode = nextState.nodes.find((node) => !beforeIds.has(node.id));

        if (newNode) {
          console.log(`[applyAiOps] Created node:`, newNode.id, newNode.label);

          // Map AI-generated ID to actual ID (if AI provided an ID)
          const aiId = (op as unknown as { id?: string }).id;
          if (aiId) {
            idMap.set(aiId, newNode.id);
            console.log(`[applyAiOps] Mapped AI ID ${aiId} -> ${newNode.id}`);
          }

          if (op.content || op.label) {
            store.updateNode(newNode.id, {
              content: op.content ?? newNode.content,
              label: op.label ?? newNode.label,
            });
          }
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
        // Map AI-generated IDs to actual IDs
        const mappedSource = idMap.get(op.source) ?? op.source;
        const mappedTarget = idMap.get(op.target) ?? op.target;
        console.log(`[applyAiOps] addLink: ${op.source} -> ${op.target}, mapped: ${mappedSource} -> ${mappedTarget}`);

        // Get fresh state after addNode operations
        const currentState = useDiagramStore.getState();
        const hasSource = currentState.nodes.find((node) => node.id === mappedSource);
        const hasTarget = currentState.nodes.find((node) => node.id === mappedTarget);
        if (!hasSource || !hasTarget) {
          console.log(`[applyAiOps] addLink skipped - source: ${!!hasSource}, target: ${!!hasTarget}`);
          break;
        }
        store.addLink(mappedSource, mappedTarget, op.linkType || 'solid');
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

  // Run auto layout if nodes were added
  if (runAutoLayout && hasAddNodeOps) {
    console.log('[applyAiOps] Running auto layout after adding nodes');
    useDiagramStore.getState().applyAutoLayout();
  }
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
