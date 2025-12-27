import React, { useState } from 'react';
import { NodePalette } from './NodePalette';
import { AiChatPanel } from './AiChatPanel';

export const Sidebar: React.FC = () => {
  const [isNodePaletteOpen, setIsNodePaletteOpen] = useState(true);

  return (
    <div
      style={{
        width: '240px',
        height: '100%',
        borderRight: '1px solid #E5E7EB',
        backgroundColor: '#F9FAFB',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <NodePalette isOpen={isNodePaletteOpen} onToggle={() => setIsNodePaletteOpen((prev) => !prev)} />
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <AiChatPanel />
      </div>
    </div>
  );
};
