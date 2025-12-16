import React from 'react';
import { useDiagramStore } from '../../stores/diagramStore';
import type { CanvasMode } from '../../types/diagram';

export const EditMenu: React.FC = () => {
  const { canvasState, setCanvasMode } = useDiagramStore();
  const { mode } = canvasState;

  const modes: { value: CanvasMode; label: string; icon: string }[] = [
    { value: 'select', label: '選択', icon: '↖' },
    { value: 'addLink', label: 'リンク追加', icon: '→' },
    { value: 'delete', label: '削除', icon: '×' },
  ];

  return (
    <div style={{ padding: '20px', borderTop: '1px solid #E5E7EB' }}>
      <h3
        style={{
          fontSize: '13px',
          fontWeight: '600',
          marginBottom: '16px',
          color: '#6B7280',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        編集モード
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {modes.map((modeItem) => (
          <button
            key={modeItem.value}
            onClick={() => setCanvasMode(modeItem.value)}
            style={{
              padding: '12px 16px',
              border: mode === modeItem.value ? '2px solid #3B82F6' : '1px solid #E5E7EB',
              backgroundColor: mode === modeItem.value ? '#EFF6FF' : '#FFFFFF',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: mode === modeItem.value ? '600' : '500',
              color: mode === modeItem.value ? '#3B82F6' : '#374151',
              textAlign: 'left',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              if (mode !== modeItem.value) {
                e.currentTarget.style.backgroundColor = '#F9FAFB';
                e.currentTarget.style.borderColor = '#D1D5DB';
              }
            }}
            onMouseLeave={(e) => {
              if (mode !== modeItem.value) {
                e.currentTarget.style.backgroundColor = '#FFFFFF';
                e.currentTarget.style.borderColor = '#E5E7EB';
              }
            }}
          >
            <span style={{ fontSize: '18px', width: '20px', textAlign: 'center' }}>
              {modeItem.icon}
            </span>
            {modeItem.label}
          </button>
        ))}
      </div>
    </div>
  );
};
