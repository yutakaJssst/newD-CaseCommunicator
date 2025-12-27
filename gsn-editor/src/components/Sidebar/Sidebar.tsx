import React from 'react';
import { NodePalette } from './NodePalette';
import { AiChatPanel } from './AiChatPanel';

export const Sidebar: React.FC = () => {
  return (
    <div
      style={{
        width: '240px',
        height: '100%',
        borderRight: '1px solid #E5E7EB',
        backgroundColor: '#F9FAFB',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <NodePalette />
      </div>
      <AiChatPanel />
    </div>
  );
};
