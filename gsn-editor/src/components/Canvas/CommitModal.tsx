import React, { useState, useRef, useEffect } from 'react';

interface CommitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCommit: (message: string) => void;
}

const CommitModalContent: React.FC<Omit<CommitModalProps, 'isOpen'>> = ({ onClose, onCommit }) => {
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // フォーカスを設定
    const timeoutId = window.setTimeout(() => textareaRef.current?.focus(), 100);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) {
      setError('コミットメッセージを入力してください');
      return;
    }

    onCommit(message.trim());
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+Enter / Cmd+Enter で送信
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSubmit(e);
    }
    // ESC で閉じる
    if (e.key === 'Escape') {
      onClose();
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          width: '500px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div
          style={{
            padding: '20px',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
            💾 コミット
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6B7280',
            }}
          >
            ×
          </button>
        </div>

        {/* コンテンツ */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px' }}>
            <label
              htmlFor="commit-message"
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '500',
                color: '#374151',
              }}
            >
              コミットメッセージ <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <textarea
              ref={textareaRef}
              id="commit-message"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="変更内容を簡潔に説明してください&#10;例: ゴールG1とG2を追加、戦略S1を修正"
              rows={4}
              style={{
                width: '100%',
                padding: '12px',
                border: error ? '2px solid #EF4444' : '1px solid #D1D5DB',
                borderRadius: '6px',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical',
                outline: 'none',
              }}
            />
            {error && (
              <div style={{ marginTop: '8px', color: '#EF4444', fontSize: '13px' }}>{error}</div>
            )}
            <div style={{ marginTop: '8px', fontSize: '13px', color: '#6B7280' }}>
              💡 Ctrl+Enter で送信、ESC でキャンセル
            </div>
          </div>

          {/* フッター */}
          <div
            style={{
              padding: '16px 20px',
              borderTop: '1px solid #E5E7EB',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                backgroundColor: '#F3F4F6',
                color: '#374151',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500',
              }}
            >
              キャンセル
            </button>
            <button
              type="submit"
              style={{
                padding: '8px 16px',
                backgroundColor: '#3B82F6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500',
              }}
            >
              💾 コミット
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const CommitModal: React.FC<CommitModalProps> = ({ isOpen, onClose, onCommit }) => {
  if (!isOpen) return null;
  return <CommitModalContent onClose={onClose} onCommit={onCommit} />;
};
