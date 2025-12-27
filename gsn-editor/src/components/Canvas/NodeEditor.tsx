import React, { useEffect } from 'react';
import type { Node } from '../../types/diagram';

interface NodeEditorProps {
  node: Node;
  onSave: (content: string, label?: string) => void;
  onClose: () => void;
}

export const NodeEditor: React.FC<NodeEditorProps> = ({ node, onSave, onClose }) => {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const [label, setLabel] = React.useState(node.label || '');

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

  // 初期コンテンツをエディタに設定
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = node.content;
    }
  }, [node.content]);

  const handleSave = () => {
    const htmlContent = editorRef.current?.innerHTML || '';
    onSave(htmlContent, label);
    onClose();
  };

  // 書式適用
  const applyFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  // リンク挿入
  const insertLink = () => {
    const url = prompt('URLを入力してください (例: https://example.com):');
    if (url) {
      // URLの検証
      try {
        // 相対URLや不正なURLをチェック
        if (!url.match(/^https?:\/\/.+/)) {
          alert('⚠️ 無効なURLです。http:// または https:// で始まる完全なURLを入力してください。\n\n例: https://example.com');
          return;
        }
        // URLオブジェクトとして検証
        new URL(url);
        document.execCommand('createLink', false, url);
        editorRef.current?.focus();
      } catch {
        alert('⚠️ 無効なURLです。正しい形式で入力してください。\n\n例: https://example.com');
      }
    }
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

        {/* ラベル入力 */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '13px',
            fontWeight: '500',
            color: '#374151',
          }}>
            ラベル（例: G1, S2）
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="G1"
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '14px',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              outline: 'none',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#3B82F6')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#D1D5DB')}
          />
        </div>

        {/* ツールバー */}
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '8px',
          backgroundColor: '#F9FAFB',
          borderRadius: '8px 8px 0 0',
          borderBottom: '1px solid #D1D5DB',
        }}>
          <button
            onClick={() => applyFormat('bold')}
            style={{
              padding: '6px 12px',
              fontSize: '14px',
              fontWeight: 'bold',
              border: '1px solid #D1D5DB',
              borderRadius: '4px',
              cursor: 'pointer',
              backgroundColor: '#FFFFFF',
            }}
            title="太字"
          >
            B
          </button>
          <button
            onClick={() => applyFormat('italic')}
            style={{
              padding: '6px 12px',
              fontSize: '14px',
              fontStyle: 'italic',
              border: '1px solid #D1D5DB',
              borderRadius: '4px',
              cursor: 'pointer',
              backgroundColor: '#FFFFFF',
            }}
            title="斜体"
          >
            I
          </button>
          <button
            onClick={() => applyFormat('underline')}
            style={{
              padding: '6px 12px',
              fontSize: '14px',
              textDecoration: 'underline',
              border: '1px solid #D1D5DB',
              borderRadius: '4px',
              cursor: 'pointer',
              backgroundColor: '#FFFFFF',
            }}
            title="下線"
          >
            U
          </button>
          <div style={{ width: '1px', backgroundColor: '#D1D5DB', margin: '0 4px' }} />
          <select
            onChange={(e) => applyFormat('fontSize', e.target.value)}
            style={{
              padding: '6px',
              fontSize: '14px',
              border: '1px solid #D1D5DB',
              borderRadius: '4px',
              cursor: 'pointer',
              backgroundColor: '#FFFFFF',
            }}
            defaultValue="3"
          >
            <option value="1">小</option>
            <option value="3">中</option>
            <option value="5">大</option>
            <option value="7">特大</option>
          </select>
          <div style={{ width: '1px', backgroundColor: '#D1D5DB', margin: '0 4px' }} />
          <button
            onClick={insertLink}
            style={{
              padding: '6px 12px',
              fontSize: '14px',
              border: '1px solid #D1D5DB',
              borderRadius: '4px',
              cursor: 'pointer',
              backgroundColor: '#FFFFFF',
            }}
            title="リンク挿入"
          >
            🔗
          </button>
        </div>

        {/* エディタ */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          style={{
            flex: 1,
            minHeight: '240px',
            padding: '14px',
            fontSize: '15px',
            border: '1px solid #D1D5DB',
            borderRadius: '0 0 8px 8px',
            fontFamily: 'inherit',
            lineHeight: '1.6',
            outline: 'none',
            overflowY: 'auto',
            backgroundColor: '#FFFFFF',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = '#3B82F6')}
          onBlur={(e) => (e.currentTarget.style.borderColor = '#D1D5DB')}
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
