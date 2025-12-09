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
        height: '60px',
        borderBottom: '1px solid #ddd',
        backgroundColor: '#fff',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: '20px',
      }}
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="タイトル"
        style={{
          flex: 1,
          maxWidth: '300px',
          padding: '8px',
          fontSize: '16px',
          border: '1px solid #ccc',
          borderRadius: '4px',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '14px' }}>
          表示倍率: {Math.round(viewport.scale * 100)}%
        </span>
        <button
          onClick={handleZoomOut}
          style={{
            padding: '5px 15px',
            fontSize: '18px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: '#fff',
          }}
        >
          −
        </button>
        <button
          onClick={handleZoomIn}
          style={{
            padding: '5px 15px',
            fontSize: '18px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: '#fff',
          }}
        >
          ＋
        </button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
        <button
          onClick={handleExport}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            border: '1px solid #007bff',
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: '#007bff',
            color: '#fff',
          }}
        >
          エクスポート
        </button>
        <button
          onClick={handleImport}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            border: '1px solid #28a745',
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: '#28a745',
            color: '#fff',
          }}
        >
          インポート
        </button>
        <button
          onClick={handleReset}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            border: '1px solid #dc3545',
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: '#dc3545',
            color: '#fff',
          }}
        >
          リセット
        </button>
      </div>
    </div>
  );
};
