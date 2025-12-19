import React from 'react';
import type { Node as NodeType } from '../../types/diagram';
import { NODE_COLORS } from '../../types/diagram';

interface NodeProps {
  node: NodeType;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onResizeStart?: (e: React.MouseEvent, direction: string) => void;
  onCommentClick?: (e: React.MouseEvent) => void;
}

export const Node: React.FC<NodeProps> = ({
  node,
  isSelected,
  onSelect,
  onDoubleClick,
  onDragStart,
  onContextMenu,
  onResizeStart,
  onCommentClick,
}) => {
  const renderShape = () => {
    const { width, height } = node.size;
    const fillColor = node.style?.fillColor || NODE_COLORS[node.type];
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

      case 'Undeveloped': {
        const points = [
          `${-width / 2},0`,
          `0,${height / 2}`,
          `${width / 2},0`,
          `0,${-height / 2}`,
        ].join(' ');
        return <polygon points={points} {...shapeProps} />;
      }

      case 'Module': {
        // フォルダ形状（タブ付き矩形）
        const tabWidth = 60;
        const tabHeight = 20;
        const pathData = `
          M ${-width / 2} ${-height / 2 + tabHeight}
          L ${-width / 2} ${-height / 2}
          L ${-width / 2 + tabWidth} ${-height / 2}
          L ${-width / 2 + tabWidth + 10} ${-height / 2 + tabHeight}
          L ${width / 2} ${-height / 2 + tabHeight}
          L ${width / 2} ${height / 2}
          L ${-width / 2} ${height / 2}
          Z
        `;
        return (
          <>
            <path d={pathData} {...shapeProps} />
            {/* フォルダアイコン（📁の代わりにテキスト"M"を使用） */}
            <text
              x={-width / 2 + 10}
              y={-height / 2 + 15}
              fill="#666666"
              fontSize={14}
              fontWeight="bold"
            >
              M
            </text>
          </>
        );
      }

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
      >
        {node.content ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              padding: node.type === 'Module' ? '30px 10px 10px 10px' : '10px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              textAlign: 'center',
              wordBreak: 'break-word',
            }}
            dangerouslySetInnerHTML={{ __html: node.content }}
            onMouseDown={(e) => {
              // リンククリック時はノードのドラッグを防止
              const target = e.target as HTMLElement;
              if (target.tagName === 'A') {
                e.stopPropagation();
              }
            }}
            onClick={(e) => {
              const target = e.target as HTMLElement;
              // リンククリック時
              if (target.tagName === 'A') {
                e.preventDefault();
                e.stopPropagation();

                const href = (target as HTMLAnchorElement).href;
                // URLの検証
                try {
                  const url = new URL(href);
                  if (url.protocol === 'http:' || url.protocol === 'https:') {
                    window.open(href, '_blank', 'noopener,noreferrer');
                  } else {
                    alert('⚠️ セキュリティ上の理由から、http:// または https:// で始まるURLのみ開くことができます。');
                  }
                } catch (err) {
                  alert('⚠️ 無効なURLです。リンクを開けません。\n\nURL: ' + href);
                }
              }
            }}
            onDoubleClick={(e) => {
              // ダブルクリックは常に編集モードを開く（リンクがある場合でも）
              e.stopPropagation();
              onDoubleClick();
            }}
          />
        ) : (
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
            <span style={{ color: '#999' }}>ダブルクリックで編集</span>
          </div>
        )}
      </foreignObject>

      {/* ラベル表示（左上） */}
      {node.label && (
        <>
          <rect
            x={-node.size.width / 2}
            y={-node.size.height / 2 - 24}
            width={Math.max(40, node.label.length * 9)}
            height={20}
            fill="#1F2937"
            stroke="none"
            rx={4}
            ry={4}
          />
          <text
            x={-node.size.width / 2 + Math.max(40, node.label.length * 9) / 2}
            y={-node.size.height / 2 - 9}
            fill="#FFFFFF"
            fontSize={13}
            fontWeight="600"
            textAnchor="middle"
          >
            {node.label}
          </text>
        </>
      )}

      {/* Assumption/Justification添え字 */}
      {(node.type === 'Assumption' || node.type === 'Justification') && (
        <text
          x={node.size.width / 2 - 10}
          y={node.size.height / 2 - 5}
          fill="#000000"
          fontSize={16}
          fontWeight="bold"
          textAnchor="middle"
        >
          {node.type === 'Assumption' ? 'A' : 'J'}
        </text>
      )}

      {/* コメントアイコン（右上） */}
      {onCommentClick && (
        <g
          transform={`translate(${node.size.width / 2 - 10}, ${-node.size.height / 2 - 14})`}
          onClick={(e) => {
            e.stopPropagation();
            onCommentClick(e);
          }}
          style={{ cursor: 'pointer' }}
        >
          {/* コメントがある場合は青背景、ない場合は灰色背景 */}
          <circle
            cx={0}
            cy={0}
            r={12}
            fill={(node.comments && node.comments.length > 0) ? '#3B82F6' : '#9CA3AF'}
            stroke="white"
            strokeWidth={2}
          />
          {/* 吹き出しアイコン */}
          <text
            x={0}
            y={4}
            fill="white"
            fontSize={12}
            textAnchor="middle"
            style={{ pointerEvents: 'none' }}
          >
            💬
          </text>
          {/* コメント数バッジ */}
          {node.comments && node.comments.length > 0 && (
            <>
              <circle
                cx={8}
                cy={-8}
                r={8}
                fill="#EF4444"
                stroke="white"
                strokeWidth={1}
              />
              <text
                x={8}
                y={-5}
                fill="white"
                fontSize={9}
                fontWeight="bold"
                textAnchor="middle"
              >
                {node.comments.length > 9 ? '9+' : node.comments.length}
              </text>
            </>
          )}
        </g>
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
