import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ValidationResult, ValidationError, ValidationWarning } from '../../utils/validation';
import { useDiagramStore } from '../../stores/diagramStore';

interface ValidationModalProps {
  result: ValidationResult;
  onClose: () => void;
}

export const ValidationModal: React.FC<ValidationModalProps> = ({ result, onClose }) => {
  const { t } = useTranslation();
  const { nodes, selectNode, clearSelection, setViewport, canvasState } = useDiagramStore();

  const handleNodeClick = (nodeIds: string[] | undefined) => {
    if (!nodeIds || nodeIds.length === 0) return;

    clearSelection();

    // 複数ノードを選択
    nodeIds.forEach(id => {
      const node = nodes.find(n => n.id === id);
      if (node) {
        selectNode(id);
      }
    });

    // 最初のノードにビューを移動
    const firstNode = nodes.find(n => n.id === nodeIds[0]);
    if (firstNode) {
      setViewport({
        ...canvasState.viewport,
        offsetX: -firstNode.position.x + 400,
        offsetY: -firstNode.position.y + 300,
      });
    }

    onClose();
  };

  const getNodeLabels = (nodeIds: string[] | undefined): string => {
    if (!nodeIds || nodeIds.length === 0) return '';
    return nodeIds
      .map(id => {
        const node = nodes.find(n => n.id === id);
        return node?.label || id.slice(0, 8);
      })
      .join(', ');
  };

  const renderItem = (item: ValidationError | ValidationWarning, index: number) => {
    const isError = item.type === 'error';
    const bgColor = isError ? '#FEF2F2' : '#FFFBEB';
    const borderColor = isError ? '#FECACA' : '#FDE68A';
    const iconColor = isError ? '#DC2626' : '#D97706';
    const icon = isError ? '✕' : '⚠';

    return (
      <div
        key={`${item.code}-${index}`}
        style={{
          padding: '12px 16px',
          backgroundColor: bgColor,
          border: `1px solid ${borderColor}`,
          borderRadius: '8px',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <span
            style={{
              color: iconColor,
              fontWeight: 'bold',
              fontSize: '16px',
              lineHeight: '1.4',
            }}
          >
            {icon}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '500', color: '#1F2937', marginBottom: '4px' }}>
              {item.message}
            </div>
            {item.nodeIds && item.nodeIds.length > 0 && (
              <button
                onClick={() => handleNodeClick(item.nodeIds)}
                style={{
                  fontSize: '13px',
                  color: '#3B82F6',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {t('validation.affectedNodes')}: {getNodeLabels(item.nodeIds)}
              </button>
            )}
          </div>
        </div>
      </div>
    );
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
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#1F2937' }}>
            {t('validation.title')}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#9CA3AF',
              padding: '4px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* 結果サマリー */}
        <div
          style={{
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '20px',
            backgroundColor: result.isValid ? '#ECFDF5' : '#FEF2F2',
            border: `1px solid ${result.isValid ? '#A7F3D0' : '#FECACA'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>
              {result.isValid ? '✓' : '✕'}
            </span>
            <div>
              <div style={{ fontWeight: '600', color: result.isValid ? '#065F46' : '#991B1B', fontSize: '16px' }}>
                {result.isValid ? t('validation.passed') : t('validation.failed')}
              </div>
              <div style={{ color: '#6B7280', fontSize: '14px', marginTop: '4px' }}>
                {t('validation.errors')}: {result.errors.length} / {t('validation.warnings')}: {result.warnings.length}
              </div>
            </div>
          </div>
        </div>

        {/* エラー一覧 */}
        {result.errors.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#DC2626', marginBottom: '12px', textTransform: 'uppercase' }}>
              {t('validation.errors')} ({result.errors.length})
            </h3>
            {result.errors.map((error, index) => renderItem(error, index))}
          </div>
        )}

        {/* 警告一覧 */}
        {result.warnings.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#D97706', marginBottom: '12px', textTransform: 'uppercase' }}>
              {t('validation.warnings')} ({result.warnings.length})
            </h3>
            {result.warnings.map((warning, index) => renderItem(warning, index))}
          </div>
        )}

        {/* 全て合格の場合 */}
        {result.isValid && result.warnings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#6B7280' }}>
            {t('validation.noIssues')}
          </div>
        )}

        {/* 閉じるボタン */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '14px',
            }}
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
