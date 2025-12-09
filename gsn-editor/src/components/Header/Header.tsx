import React from 'react';
import { useDiagramStore } from '../../stores/diagramStore';

export const Header: React.FC = () => {
  const { title, setTitle, canvasState, setViewport, exportData, importData, reset } =
    useDiagramStore();
  const { viewport } = canvasState;

  const handleZoomIn = () => {
    const newScale = Math.min(3.0, viewport.scale + 0.1);
    setViewport({ scale: newScale });
  };

  const handleZoomOut = () => {
    const newScale = Math.max(0.2, viewport.scale - 0.1);
    setViewport({ scale: newScale });
  };

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'gsn-diagram'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target?.result as string);
            importData(data);
          } catch (error) {
            alert('JSONファイルの読み込みに失敗しました');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleReset = () => {
    if (confirm('すべてのデータをリセットしますか？')) {
      reset();
    }
  };

  return (
    <div
      style={{
        height: '64px',
        borderBottom: '1px solid #E5E7EB',
        backgroundColor: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: '24px',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      }}
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="タイトル"
        style={{
          flex: 1,
          maxWidth: '320px',
          padding: '10px 14px',
          fontSize: '15px',
          border: '1px solid #D1D5DB',
          borderRadius: '8px',
          backgroundColor: '#FFFFFF',
          outline: 'none',
          transition: 'border-color 0.2s',
        }}
        onFocus={(e) => (e.target.style.borderColor = '#3B82F6')}
        onBlur={(e) => (e.target.style.borderColor = '#D1D5DB')}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '14px', color: '#6B7280', fontWeight: '500' }}>
          {Math.round(viewport.scale * 100)}%
        </span>
        <button
          onClick={handleZoomOut}
          style={{
            width: '36px',
            height: '36px',
            fontSize: '18px',
            border: '1px solid #D1D5DB',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: '#FFFFFF',
            color: '#374151',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F3F4F6';
            e.currentTarget.style.borderColor = '#9CA3AF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FFFFFF';
            e.currentTarget.style.borderColor = '#D1D5DB';
          }}
        >
          −
        </button>
        <button
          onClick={handleZoomIn}
          style={{
            width: '36px',
            height: '36px',
            fontSize: '18px',
            border: '1px solid #D1D5DB',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: '#FFFFFF',
            color: '#374151',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F3F4F6';
            e.currentTarget.style.borderColor = '#9CA3AF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FFFFFF';
            e.currentTarget.style.borderColor = '#D1D5DB';
          }}
        >
          ＋
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginLeft: 'auto' }}>
        <button
          onClick={handleExport}
          style={{
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: '500',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: '#3B82F6',
            color: '#FFFFFF',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2563EB')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#3B82F6')}
        >
          エクスポート
        </button>
        <button
          onClick={handleImport}
          style={{
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: '500',
            border: '1px solid #D1D5DB',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: '#FFFFFF',
            color: '#374151',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F3F4F6';
            e.currentTarget.style.borderColor = '#9CA3AF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FFFFFF';
            e.currentTarget.style.borderColor = '#D1D5DB';
          }}
        >
          インポート
        </button>
        <button
          onClick={handleReset}
          style={{
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: '500',
            border: '1px solid #D1D5DB',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: '#FFFFFF',
            color: '#EF4444',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#FEF2F2';
            e.currentTarget.style.borderColor = '#EF4444';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FFFFFF';
            e.currentTarget.style.borderColor = '#D1D5DB';
          }}
        >
          リセット
        </button>
      </div>
    </div>
  );
};
