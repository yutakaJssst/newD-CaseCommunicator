import React from 'react';
import type { NodeType } from '../../types/diagram';
import { NODE_LABELS } from '../../types/diagram';
import { useDiagramStore } from '../../stores/diagramStore';

const nodeTypes: NodeType[] = ['Goal', 'Strategy', 'Context', 'Evidence'];

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
    <div style={{ padding: '10px' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>
        パーツ
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {nodeTypes.map((type) => (
          <button
            key={type}
            onClick={() => handleNodeTypeClick(type)}
            style={{
              padding: '10px',
              border: selectedNodeType === type ? '2px solid #007bff' : '1px solid #ccc',
              backgroundColor: selectedNodeType === type ? '#e7f3ff' : '#fff',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              textAlign: 'left',
              transition: 'all 0.2s',
            }}
          >
            {NODE_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
};
