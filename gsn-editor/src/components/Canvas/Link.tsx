import React from 'react';
import type { Link as LinkType, Node } from '../../types/diagram';

interface LinkProps {
  link: LinkType;
  sourceNode: Node;
  targetNode: Node;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export const Link: React.FC<LinkProps> = ({ link, sourceNode, targetNode, onClick, onContextMenu }) => {
  const color = link.style?.color || '#1F2937';
  const width = link.style?.width || 2;

  // InContextOf関係（ターゲットがContext/Assumption/Justificationの場合）の判定
  const isInContextOf = ['Context', 'Assumption', 'Justification'].includes(targetNode.type);

  // Context系ノードへのリンクは白抜き矢印、通常のリンクは塗りつぶし矢印
  const markerEnd = isInContextOf ? 'url(#arrowhead-hollow)' : 'url(#arrowhead)';

  // GSN標準に基づく接続点の決定
  // ゴール・戦略の下につくノード: Goal, Strategy, Evidence, Undeveloped, Module
  // それ以外のノード（Context, Assumption, Justification）は横につく
  const verticalTargets = ['Goal', 'Strategy', 'Evidence', 'Undeveloped', 'Module'];
  const shouldConnectVertically = verticalTargets.includes(targetNode.type);

  let x1: number, y1: number, x2: number, y2: number;

  if (shouldConnectVertically) {
    // 縦方向の接続（親ノードの下端 → 子ノードの上端）
    const dy = targetNode.position.y - sourceNode.position.y;

    if (dy > 0) {
      // ターゲットが下側（通常のケース）
      x1 = sourceNode.position.x;
      y1 = sourceNode.position.y + sourceNode.size.height / 2; // ソースの下端
      x2 = targetNode.position.x;
      y2 = targetNode.position.y - targetNode.size.height / 2; // ターゲットの上端
    } else {
      // ターゲットが上側（逆方向）
      x1 = sourceNode.position.x;
      y1 = sourceNode.position.y - sourceNode.size.height / 2; // ソースの上端
      x2 = targetNode.position.x;
      y2 = targetNode.position.y + targetNode.size.height / 2; // ターゲットの下端
    }
  } else {
    // 横方向の接続（Context, Assumption, Justification）
    const dx = targetNode.position.x - sourceNode.position.x;

    if (dx > 0) {
      // ターゲットが右側
      x1 = sourceNode.position.x + sourceNode.size.width / 2; // ソースの右端
      y1 = sourceNode.position.y;
      x2 = targetNode.position.x - targetNode.size.width / 2; // ターゲットの左端
      y2 = targetNode.position.y;
    } else {
      // ターゲットが左側
      x1 = sourceNode.position.x - sourceNode.size.width / 2; // ソースの左端
      y1 = sourceNode.position.y;
      x2 = targetNode.position.x + targetNode.size.width / 2; // ターゲットの右端
      y2 = targetNode.position.y;
    }
  }

  const pathData = `M ${x1} ${y1} L ${x2} ${y2}`;

  return (
    <g onClick={onClick} onContextMenu={onContextMenu} style={{ cursor: 'pointer' }}>
      {/* クリック可能な透明な太い線（クリック領域を広げるため） */}
      <path
        d={pathData}
        stroke="transparent"
        strokeWidth={12}
        fill="none"
      />
      {/* 実際の表示用の線 */}
      <path
        d={pathData}
        stroke={color}
        strokeWidth={width}
        fill="none"
        strokeDasharray={link.type === 'dashed' ? '8 8' : undefined}
        markerEnd={markerEnd}
        pointerEvents="none"
      />
    </g>
  );
};

// 矢印マーカーの定義
export const ArrowMarker: React.FC = () => (
  <defs>
    {/* 通常の塗りつぶし矢印（SupportedBy関係用） */}
    <marker
      id="arrowhead"
      markerWidth="10"
      markerHeight="10"
      refX="9"
      refY="3"
      orient="auto"
    >
      <polygon points="0 0, 10 3, 0 6" fill="#1F2937" />
    </marker>

    {/* 白抜き矢印（InContextOf関係用） */}
    <marker
      id="arrowhead-hollow"
      markerWidth="10"
      markerHeight="10"
      refX="9"
      refY="3"
      orient="auto"
    >
      <polygon points="0 0, 10 3, 0 6" fill="white" stroke="#1F2937" strokeWidth="1.5" />
    </marker>
  </defs>
);
