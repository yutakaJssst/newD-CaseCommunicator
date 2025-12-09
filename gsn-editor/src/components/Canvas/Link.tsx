import React from 'react';
import type { Link as LinkType, Node } from '../../types/diagram';

interface LinkProps {
  link: LinkType;
  sourceNode: Node;
  targetNode: Node;
  onClick: () => void;
}

export const Link: React.FC<LinkProps> = ({ link, sourceNode, targetNode, onClick }) => {
  const color = link.style?.color || '#1F2937';
  const width = link.style?.width || 2;

  // InContextOf関係（ターゲットがContext/Assumption/Justificationの場合）の判定
  const isInContextOf = ['Context', 'Assumption', 'Justification'].includes(targetNode.type);

  // Context系ノードへのリンクは白抜き矢印、通常のリンクは塗りつぶし矢印
  const markerEnd = isInContextOf ? 'url(#arrowhead-hollow)' : 'url(#arrowhead)';

  // ノード間の相対位置を計算して最適な接続点を決定
  const dx = targetNode.position.x - sourceNode.position.x;
  const dy = targetNode.position.y - sourceNode.position.y;

  let x1: number, y1: number, x2: number, y2: number;

  // 横方向の距離が縦方向より大きい場合（横並び）
  if (Math.abs(dx) > Math.abs(dy)) {
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
  } else {
    // 縦方向の距離が大きい場合（縦並び）
    if (dy > 0) {
      // ターゲットが下側
      x1 = sourceNode.position.x;
      y1 = sourceNode.position.y + sourceNode.size.height / 2; // ソースの下端
      x2 = targetNode.position.x;
      y2 = targetNode.position.y - targetNode.size.height / 2; // ターゲットの上端
    } else {
      // ターゲットが上側
      x1 = sourceNode.position.x;
      y1 = sourceNode.position.y - sourceNode.size.height / 2; // ソースの上端
      x2 = targetNode.position.x;
      y2 = targetNode.position.y + targetNode.size.height / 2; // ターゲットの下端
    }
  }

  const pathData = `M ${x1} ${y1} L ${x2} ${y2}`;

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <path
        d={pathData}
        stroke={color}
        strokeWidth={width}
        fill="none"
        strokeDasharray={link.type === 'dashed' ? '8 8' : undefined}
        markerEnd={markerEnd}
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
