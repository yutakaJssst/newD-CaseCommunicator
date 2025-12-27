import React from 'react';
import type { AiOp } from '../../api/ai';
import { summarizeAiOps } from '../../utils/aiOps';

interface AiOpsPreviewModalProps {
  ops: AiOp[];
  onConfirm: () => void;
  onCancel: () => void;
}

export const AiOpsPreviewModal: React.FC<AiOpsPreviewModalProps> = ({
  ops,
  onConfirm,
  onCancel,
}) => {
  const summaries = summarizeAiOps(ops);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '10px',
          width: '520px',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 24px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 18px',
            borderBottom: '1px solid #E5E7EB',
            fontWeight: 600,
            fontSize: '14px',
          }}
        >
          AI提案の適用確認
        </div>
        <div style={{ padding: '16px', overflowY: 'auto' }}>
          {summaries.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#6B7280' }}>
              適用可能な操作がありません。
            </div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#111827' }}>
              {summaries.map((summary, index) => (
                <li key={`${summary}-${index}`} style={{ marginBottom: '8px' }}>
                  {summary}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div
          style={{
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            borderTop: '1px solid #E5E7EB',
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '6px 12px',
              border: '1px solid #E5E7EB',
              borderRadius: '6px',
              backgroundColor: '#FFFFFF',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={summaries.length === 0}
            style={{
              padding: '6px 12px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: summaries.length === 0 ? '#9CA3AF' : '#2563EB',
              color: '#FFFFFF',
              fontSize: '12px',
              cursor: summaries.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            適用
          </button>
        </div>
      </div>
    </div>
  );
};
