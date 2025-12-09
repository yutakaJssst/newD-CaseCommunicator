import React from 'react';
import { NodePalette } from './NodePalette';

export const Sidebar: React.FC = () => {
  return (
    <div
      style={{
        width: '200px',
        height: '100%',
        borderRight: '1px solid #ddd',
        backgroundColor: '#f8f9fa',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <NodePalette />
    </div>
  );
};
