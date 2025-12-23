import React from 'react';

interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = '読み込み中...',
  fullScreen = false,
}) => {
  const baseStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    color: '#6B7280',
    padding: '20px',
  };

  const fullScreenStyle: React.CSSProperties = fullScreen
    ? { width: '100vw', height: '100vh' }
    : {};

  return <div style={{ ...baseStyle, ...fullScreenStyle }}>{message}</div>;
};
