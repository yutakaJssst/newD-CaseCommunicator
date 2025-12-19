import React, { useState, useEffect, useRef } from 'react';
import type { Node, Link } from '../../types/diagram';

interface SavePatternModalProps {
  nodes: Node[];
  links: Link[];
  onSave: (name: string, description: string, isPublic: boolean) => void;
  onClose: () => void;
}

export const SavePatternModal: React.FC<SavePatternModalProps> = ({
  nodes,
  links,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // モーダルが開いたら名前入力にフォーカス
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('パターン名を入力してください');
      return;
    }

    onSave(name.trim(), description.trim(), isPublic);
  };

  // ESCキーで閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          width: '450px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
            パターンとして保存
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#6B7280',
              padding: '4px 8px',
            }}
          >
            ×
          </button>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px' }}>
            {/* 選択内容の概要 */}
            <div
              style={{
                backgroundColor: '#F3F4F6',
                borderRadius: '6px',
                padding: '12px',
                marginBottom: '16px',
                fontSize: '13px',
              }}
            >
              <div style={{ fontWeight: 500, marginBottom: '4px' }}>選択中の内容</div>
              <div style={{ color: '#6B7280' }}>
                {nodes.length}ノード・{links.length}リンク
              </div>
            </div>

            {/* パターン名 */}
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                パターン名 <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="例: 基本的なゴール分解"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: error ? '1px solid #EF4444' : '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
              {error && (
                <div style={{ color: '#EF4444', fontSize: '12px', marginTop: '4px' }}>
                  {error}
                </div>
              )}
            </div>

            {/* 説明 */}
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                説明（任意）
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="パターンの使い方や用途を説明"
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '14px',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* 公開設定 */}
            <div style={{ marginBottom: '8px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                <span>全ユーザーに公開する</span>
              </label>
              <div style={{ marginLeft: '24px', fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                公開すると、他のユーザーもこのパターンを使用できます
              </div>
            </div>
          </div>

          {/* フッター */}
          <div
            style={{
              padding: '16px 20px',
              borderTop: '1px solid #E5E7EB',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                backgroundColor: '#F3F4F6',
                color: '#374151',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '14px',
              }}
            >
              キャンセル
            </button>
            <button
              type="submit"
              style={{
                padding: '10px 20px',
                backgroundColor: '#2563EB',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '14px',
              }}
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
