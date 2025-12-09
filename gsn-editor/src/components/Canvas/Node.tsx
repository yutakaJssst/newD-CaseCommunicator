import React from 'react';
import type { Node as NodeType } from '../../types/diagram';

interface NodeProps {
  node: NodeType;
  isSelected: boolean;
  onSelect: () => void;
  onDoubleClick: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onResizeStart?: (e: React.MouseEvent, direction: string) => void;
}

export const Node: React.FC<NodeProps> = ({
  node,
  isSelected,
  onSelect,
  onDoubleClick,
  onDragStart,
  onContextMenu,
  onResizeStart,
}) => {
  const renderShape = () => {
    const { width, height } = node.size;
    const fillColor = node.style?.fillColor || '#FFFFFF';
    const borderColor = node.style?.borderColor || '#374151';
    const borderWidth = node.style?.borderWidth || 2;

    const shapeProps = {
      fill: fillColor,
      stroke: isSelected ? '#3B82F6' : borderColor,
      strokeWidth: isSelected ? 3 : borderWidth,
    };

    switch (node.type) {
      case 'Goal':
        return (
          <rect
            x={-width / 2}
            y={-height / 2}
            width={width}
            height={height}
            {...shapeProps}
          />
        );

      case 'Strategy':
        return (
          <rect
            x={-width / 2}
            y={-height / 2}
            width={width}
            height={height}
            transform="skewX(-15)"
            {...shapeProps}
          />
        );

      case 'Context':
        return (
          <rect
            x={-width / 2}
            y={-height / 2}
            width={width}
            height={height}
            rx={10}
            ry={10}
            {...shapeProps}
          />
        );

      case 'Evidence':
      case 'Assumption':
      case 'Justification':
        return (
          <ellipse
            cx={0}
            cy={0}
            rx={width / 2}
            ry={height / 2}
            {...shapeProps}
          />
        );

      case 'Undeveloped':
        const points = [
          `${-width / 2},0`,
          `0,${height / 2}`,
          `${width / 2},0`,
          `0,${-height / 2}`,
        ].join(' ');
        return <polygon points={points} {...shapeProps} />;

      default:
        return (
          <rect
            x={-width / 2}
            y={-height / 2}
            width={width}
            height={height}
            {...shapeProps}
          />
        );
    }
  };

  return (
    <g
      transform={`translate(${node.position.x}, ${node.position.y})`}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      onMouseDown={onDragStart}
      onContextMenu={onContextMenu}
      style={{ cursor: 'pointer' }}
    >
      {renderShape()}

      {/* コンテンツ表示エリア */}
      <foreignObject
        x={-node.size.width / 2}
        y={-node.size.height / 2}
        width={node.size.width}
        height={node.size.height}
        pointerEvents="none"
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            padding: '10px',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            textAlign: 'center',
            wordBreak: 'break-word',
          }}
        >
          {node.content || (
            <span style={{ color: '#999' }}>ダブルクリックで編集</span>
          )}
        </div>
      </foreignObject>

      {/* ラベル表示 */}
      {node.label && (
        <rect
          x={node.size.width / 2 - 80}
          y={-node.size.height / 2 - 10}
          width={80}
          height={20}
          fill="#800000"
          stroke="none"
        />
      )}
      {node.label && (
        <text
          x={node.size.width / 2 - 40}
          y={-node.size.height / 2 + 5}
          fill="#FFFFFF"
          fontSize={12}
          textAnchor="middle"
        >
          {node.label}
        </text>
      )}

      {/* リサイズハンドル（選択時のみ表示） */}
      {isSelected && onResizeStart && (
        <>
          {/* 右下 */}
          <circle
            cx={node.size.width / 2}
            cy={node.size.height / 2}
            r={6}
            fill="#3B82F6"
            stroke="#FFFFFF"
            strokeWidth={2}
            style={{ cursor: 'nwse-resize' }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onResizeStart(e, 'se');
            }}
          />
          {/* 右上 */}
          <circle
            cx={node.size.width / 2}
            cy={-node.size.height / 2}
            r={6}
            fill="#3B82F6"
            stroke="#FFFFFF"
            strokeWidth={2}
            style={{ cursor: 'nesw-resize' }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onResizeStart(e, 'ne');
            }}
          />
          {/* 左下 */}
          <circle
            cx={-node.size.width / 2}
            cy={node.size.height / 2}
            r={6}
            fill="#3B82F6"
            stroke="#FFFFFF"
            strokeWidth={2}
            style={{ cursor: 'nesw-resize' }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onResizeStart(e, 'sw');
            }}
          />
          {/* 左上 */}
          <circle
            cx={-node.size.width / 2}
            cy={-node.size.height / 2}
            r={6}
            fill="#3B82F6"
            stroke="#FFFFFF"
            strokeWidth={2}
            style={{ cursor: 'nwse-resize' }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onResizeStart(e, 'nw');
            }}
          />
        </>
      )}
    </g>
  );
};
