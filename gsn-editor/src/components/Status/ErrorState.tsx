import React from 'react';

interface ErrorStateProps {
  message: string;
  fullScreen?: boolean;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message,
  fullScreen = false,
}) => {
  const baseStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    color: '#B91C1C',
    backgroundColor: '#FEE2E2',
    border: '1px solid #FCA5A5',
    borderRadius: '8px',
    padding: '12px 16px',
    margin: '12px 0',
  };

  const fullScreenStyle: React.CSSProperties = fullScreen
    ? { width: '100vw', height: '100vh', margin: 0 }
    : {};

  return <div style={{ ...baseStyle, ...fullScreenStyle }}>{message}</div>;
};
