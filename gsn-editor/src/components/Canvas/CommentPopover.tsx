import React, { useState, useRef, useEffect } from 'react';
import type { NodeComment } from '../../types/diagram';

interface CommentPopoverProps {
  nodeId: string;
  nodeLabel: string;
  comments: NodeComment[];
  position: { x: number; y: number };
  currentUserId: string;
  currentUserName: string;
  onAddComment: (nodeId: string, content: string) => void;
  onDeleteComment: (nodeId: string, commentId: string) => void;
  onClose: () => void;
}

export const CommentPopover: React.FC<CommentPopoverProps> = ({
  nodeId,
  nodeLabel,
  comments,
  position,
  currentUserId,
  currentUserName,
  onAddComment,
  onDeleteComment,
  onClose,
}) => {
  const [newComment, setNewComment] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // テキストエリアにフォーカス
    if (textareaRef.current) {
      textareaRef.current.focus();
    }

    // クリック外で閉じる
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as globalThis.Node)) {
        onClose();
      }
    };

    // ESCキーで閉じる
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      onAddComment(nodeId, newComment.trim());
      setNewComment('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter で送信
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 画面内に収まるように位置を調整
  const adjustedPosition = {
    x: Math.min(position.x, window.innerWidth - 360),
    y: Math.min(position.y, window.innerHeight - 400),
  };

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        width: '340px',
        maxHeight: '400px',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1)',
        zIndex: 1000,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ヘッダー */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#F9FAFB',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>💬</span>
          <span style={{ fontWeight: '600', color: '#1F2937', fontSize: '14px' }}>
            {nodeLabel || 'ノード'}のコメント
          </span>
          {comments.length > 0 && (
            <span
              style={{
                backgroundColor: '#3B82F6',
                color: 'white',
                fontSize: '11px',
                fontWeight: '600',
                padding: '2px 6px',
                borderRadius: '10px',
              }}
            >
              {comments.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#9CA3AF',
            fontSize: '20px',
            padding: '0',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* コメント一覧 */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: comments.length > 0 ? '12px 16px' : '0',
          maxHeight: '200px',
        }}
      >
        {comments.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              color: '#9CA3AF',
              fontSize: '13px',
            }}
          >
            コメントはまだありません
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {comments.map((comment) => (
              <div
                key={comment.id}
                style={{
                  padding: '10px 12px',
                  backgroundColor: comment.authorId === currentUserId ? '#EFF6FF' : '#F3F4F6',
                  borderRadius: '8px',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* アバター */}
                    <div
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        backgroundColor: comment.authorId === currentUserId ? '#3B82F6' : '#6B7280',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontWeight: '600',
                      }}
                    >
                      {comment.authorName.charAt(0).toUpperCase()}
                    </div>
                    <span
                      style={{
                        fontWeight: '600',
                        fontSize: '12px',
                        color: '#374151',
                      }}
                    >
                      {comment.authorName}
                    </span>
                    <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                      {formatDate(comment.createdAt)}
                    </span>
                  </div>
                  {/* 削除ボタン（自分のコメントのみ） */}
                  {comment.authorId === currentUserId && (
                    <button
                      onClick={() => onDeleteComment(nodeId, comment.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#9CA3AF',
                        fontSize: '14px',
                        padding: '2px 4px',
                        borderRadius: '4px',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#EF4444';
                        e.currentTarget.style.backgroundColor = '#FEE2E2';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#9CA3AF';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      title="削除"
                    >
                      🗑️
                    </button>
                  )}
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    color: '#1F2937',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {comment.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 新規コメント入力 */}
      <form
        onSubmit={handleSubmit}
        style={{
          padding: '12px 16px',
          borderTop: '1px solid #E5E7EB',
          backgroundColor: '#FAFAFA',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: '#3B82F6',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: '600',
              flexShrink: 0,
            }}
          >
            {currentUserName.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <textarea
              ref={textareaRef}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="コメントを入力... (Ctrl+Enterで送信)"
              style={{
                width: '100%',
                minHeight: '36px',
                maxHeight: '80px',
                padding: '8px 10px',
                border: '1px solid #D1D5DB',
                borderRadius: '8px',
                fontSize: '13px',
                resize: 'none',
                outline: 'none',
                transition: 'border-color 0.15s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#3B82F6';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#D1D5DB';
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!newComment.trim()}
            style={{
              padding: '8px 14px',
              backgroundColor: newComment.trim() ? '#3B82F6' : '#E5E7EB',
              color: newComment.trim() ? 'white' : '#9CA3AF',
              border: 'none',
              borderRadius: '8px',
              cursor: newComment.trim() ? 'pointer' : 'not-allowed',
              fontWeight: '500',
              fontSize: '13px',
              transition: 'all 0.15s',
            }}
          >
            送信
          </button>
        </div>
      </form>
    </div>
  );
};
