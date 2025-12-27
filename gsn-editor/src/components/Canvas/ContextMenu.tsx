import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onAddLink: () => void;
  onDelete: () => void;
  onCopyTree?: () => void;
  onConvertToModule?: () => void;
  onOpenParentModule?: () => void;
  onSaveAsPattern?: () => void;
  isGoalNode?: boolean;
  isTopGoal?: boolean;
  hasSelection?: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  onClose,
  onAddLink,
  onDelete,
  onCopyTree,
  onConvertToModule,
  onOpenParentModule,
  onSaveAsPattern,
  isGoalNode = false,
  isTopGoal = false,
  hasSelection = false,
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    const handleClick = () => onClose();
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        zIndex: 1000,
        minWidth: '180px',
        overflow: 'hidden',
      }}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          onAddLink();
          onClose();
        }}
        style={{
          padding: '12px 16px',
          cursor: 'pointer',
          borderBottom: '1px solid #F3F4F6',
          fontSize: '14px',
          fontWeight: '500',
          color: '#374151',
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#F9FAFB';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        {t('canvas.contextMenu.linkToChild')}
      </div>
      {onCopyTree && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onCopyTree();
            onClose();
          }}
          style={{
            padding: '12px 16px',
            cursor: 'pointer',
            borderBottom: '1px solid #F3F4F6',
            fontSize: '14px',
            fontWeight: '500',
            color: '#374151',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F9FAFB';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {t('canvas.contextMenu.copyTree')}
        </div>
      )}
      {isGoalNode && onConvertToModule && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onConvertToModule();
            onClose();
          }}
          style={{
            padding: '12px 16px',
            cursor: 'pointer',
            borderBottom: '1px solid #F3F4F6',
            fontSize: '14px',
            fontWeight: '500',
            color: '#374151',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F9FAFB';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {t('canvas.contextMenu.convertToModule')}
        </div>
      )}
      {isTopGoal && onOpenParentModule && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onOpenParentModule();
            onClose();
          }}
          style={{
            padding: '12px 16px',
            cursor: 'pointer',
            borderBottom: '1px solid #F3F4F6',
            fontSize: '14px',
            fontWeight: '500',
            color: '#3B82F6',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#EFF6FF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {t('canvas.contextMenu.openParentModule')}
        </div>
      )}
      {hasSelection && onSaveAsPattern && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSaveAsPattern();
            onClose();
          }}
          style={{
            padding: '12px 16px',
            cursor: 'pointer',
            borderBottom: '1px solid #F3F4F6',
            fontSize: '14px',
            fontWeight: '500',
            color: '#059669',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#ECFDF5';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {t('canvas.contextMenu.saveAsPattern')}
        </div>
      )}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
          onClose();
        }}
        style={{
          padding: '12px 16px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '500',
          color: '#EF4444',
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#FEF2F2';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        {t('common.delete')}
      </div>
    </div>
  );
};
