import React from 'react';
import { NodePalette } from './NodePalette';

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
      <NodePalette />
    </div>
  );
};
