import React from 'react';
import type { NodeType } from '../../types/diagram';
import { NODE_LABELS } from '../../types/diagram';
import { useDiagramStore } from '../../stores/diagramStore';

const nodeTypes: NodeType[] = ['Goal', 'Strategy', 'Context', 'Evidence', 'Assumption', 'Justification', 'Undeveloped', 'Module'];

// ノード形状のSVGアイコン
const NodeIcon: React.FC<{ type: NodeType }> = ({ type }) => {
  const size = 32;
  const strokeColor = '#374151';
  const fillColor = '#FFFFFF';

  switch (type) {
    case 'Goal':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <rect x="4" y="8" width="24" height="16" fill={fillColor} stroke={strokeColor} strokeWidth="1.5" />
        </svg>
      );
    case 'Strategy':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <path d="M 8 8 L 28 8 L 24 24 L 4 24 Z" fill={fillColor} stroke={strokeColor} strokeWidth="1.5" />
        </svg>
      );
    case 'Context':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <rect x="4" y="8" width="24" height="16" rx="4" ry="4" fill={fillColor} stroke={strokeColor} strokeWidth="1.5" />
        </svg>
      );
    case 'Evidence':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <ellipse cx="16" cy="16" rx="12" ry="8" fill={fillColor} stroke={strokeColor} strokeWidth="1.5" />
        </svg>
      );
    case 'Assumption':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <ellipse cx="14" cy="14" rx="11" ry="7" fill={fillColor} stroke={strokeColor} strokeWidth="1.5" />
          <text x="22" y="28" fontSize="12" fontWeight="bold" fill="#DC2626">A</text>
        </svg>
      );
    case 'Justification':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <ellipse cx="14" cy="14" rx="11" ry="7" fill={fillColor} stroke={strokeColor} strokeWidth="1.5" />
          <text x="23" y="28" fontSize="12" fontWeight="bold" fill="#2563EB">J</text>
        </svg>
      );
    case 'Undeveloped':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <polygon points="4,16 16,24 28,16 16,8" fill={fillColor} stroke={strokeColor} strokeWidth="1.5" />
        </svg>
      );
    case 'Module':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <path
            d="M 4 12 L 4 8 L 14 8 L 16 12 L 28 12 L 28 24 L 4 24 Z"
            fill="#E0E0E0"
            stroke={strokeColor}
            strokeWidth="1.5"
          />
          <text x="8" y="19" fontSize="10" fontWeight="bold" fill="#666666">M</text>
        </svg>
      );
    default:
      return null;
  }
};

export const NodePalette: React.FC = () => {
  const { canvasState, setSelectedNodeType, projectRole } = useDiagramStore();
  const { selectedNodeType } = canvasState;
  const isReadOnly = projectRole === 'viewer';

  const handleNodeTypeClick = (type: NodeType) => {
    if (selectedNodeType === type) {
      setSelectedNodeType(undefined);
    } else {
      setSelectedNodeType(type);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h3 style={{
        fontSize: '13px',
        fontWeight: '600',
        marginBottom: '16px',
        color: '#6B7280',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        ノード
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {nodeTypes.map((type) => (
          <button
            key={type}
            onClick={() => handleNodeTypeClick(type)}
            disabled={isReadOnly}
            style={{
              padding: '12px 16px',
              border: selectedNodeType === type ? '2px solid #3B82F6' : '1px solid #E5E7EB',
              backgroundColor: selectedNodeType === type ? '#EFF6FF' : '#FFFFFF',
              borderRadius: '8px',
              cursor: isReadOnly ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: selectedNodeType === type ? '600' : '500',
              color: selectedNodeType === type ? '#3B82F6' : '#374151',
              textAlign: 'left',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              opacity: isReadOnly ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (selectedNodeType !== type && !isReadOnly) {
                e.currentTarget.style.backgroundColor = '#F9FAFB';
                e.currentTarget.style.borderColor = '#D1D5DB';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedNodeType !== type && !isReadOnly) {
                e.currentTarget.style.backgroundColor = '#FFFFFF';
                e.currentTarget.style.borderColor = '#E5E7EB';
              }
            }}
          >
            <span>{NODE_LABELS[type]}</span>
            <NodeIcon type={type} />
          </button>
        ))}
      </div>
    </div>
  );
};
