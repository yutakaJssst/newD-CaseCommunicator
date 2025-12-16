import React from 'react';
import type { NodeType } from '../../types/diagram';
import { NODE_LABELS } from '../../types/diagram';
import { useDiagramStore } from '../../stores/diagramStore';

const nodeTypes: NodeType[] = ['Goal', 'Strategy', 'Context', 'Evidence', 'Assumption', 'Justification', 'Undeveloped'];

export const NodePalette: React.FC = () => {
  const { canvasState, setSelectedNodeType } = useDiagramStore();
  const { selectedNodeType } = canvasState;

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
        要素
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {nodeTypes.map((type) => (
          <button
            key={type}
            onClick={() => handleNodeTypeClick(type)}
            style={{
              padding: '12px 16px',
              border: selectedNodeType === type ? '2px solid #3B82F6' : '1px solid #E5E7EB',
              backgroundColor: selectedNodeType === type ? '#EFF6FF' : '#FFFFFF',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: selectedNodeType === type ? '600' : '500',
              color: selectedNodeType === type ? '#3B82F6' : '#374151',
              textAlign: 'left',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (selectedNodeType !== type) {
                e.currentTarget.style.backgroundColor = '#F9FAFB';
                e.currentTarget.style.borderColor = '#D1D5DB';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedNodeType !== type) {
                e.currentTarget.style.backgroundColor = '#FFFFFF';
                e.currentTarget.style.borderColor = '#E5E7EB';
              }
            }}
          >
            {NODE_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
};
