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

  // 線を描画（始点から終点へ）
  const x1 = sourceNode.position.x;
  const y1 = sourceNode.position.y + sourceNode.size.height / 2; // 下端
  const x2 = targetNode.position.x;
  const y2 = targetNode.position.y - targetNode.size.height / 2; // 上端

  const pathData = `M ${x1} ${y1} L ${x2} ${y2}`;

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <path
        d={pathData}
        stroke={color}
        strokeWidth={width}
        fill="none"
        strokeDasharray={link.type === 'dashed' ? '8 8' : undefined}
        markerEnd="url(#arrowhead)"
      />
    </g>
  );
};

// 矢印マーカーの定義
export const ArrowMarker: React.FC = () => (
  <defs>
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
  </defs>
);
