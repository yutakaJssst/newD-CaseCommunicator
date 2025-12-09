import React, { useState, useEffect } from 'react';
import type { Node } from '../../types/diagram';

interface NodeEditorProps {
  node: Node;
  onSave: (content: string) => void;
  onClose: () => void;
}

export const NodeEditor: React.FC<NodeEditorProps> = ({ node, onSave, onClose }) => {
  const [content, setContent] = useState(node.content);

  // ESCキーで閉じる
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSave = () => {
    onSave(content);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          padding: '28px',
          width: '90%',
          maxWidth: '640px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
      >
        <h2 style={{
          margin: '0 0 24px 0',
          fontSize: '20px',
          fontWeight: '600',
          color: '#111827',
        }}>
          ノードの編集
        </h2>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="ノードの内容を入力してください"
          autoFocus
          style={{
            flex: 1,
            minHeight: '240px',
            padding: '14px',
            fontSize: '15px',
            border: '1px solid #D1D5DB',
            borderRadius: '8px',
            resize: 'vertical',
            fontFamily: 'inherit',
            lineHeight: '1.6',
            outline: 'none',
          }}
          onFocus={(e) => (e.target.style.borderColor = '#3B82F6')}
          onBlur={(e) => (e.target.style.borderColor = '#D1D5DB')}
        />

        <div
          style={{
            marginTop: '24px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
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
            キャンセル
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '10px 20px',
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
            保存
          </button>
        </div>
      </div>
    </div>
  );
};
