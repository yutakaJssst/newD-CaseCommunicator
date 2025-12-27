import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDiagramStore } from '../../stores/diagramStore';
import type { User } from '../../services/api';
import { validateDiagram, type ValidationResult } from '../../utils/validation';
import { ValidationModal } from '../Canvas/ValidationModal';
import { CommitModal } from '../Canvas/CommitModal';
import { VersionHistoryModal } from '../Canvas/VersionHistoryModal';
import { LanguageSwitcher } from './LanguageSwitcher';

interface HeaderProps {
  user?: User | null;
  onLogout?: () => void;
  onBackToProjects?: () => void;
  onOpenSurveyManager?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onBackToProjects,
  onOpenSurveyManager,
}) => {
  const { t } = useTranslation();
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showModuleList, setShowModuleList] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const {
    title,
    setTitle,
    canvasState,
    setViewport,
    exportData,
    importData,
    exportProjectData,
    importProjectData,
    exportAsImage,
    reset,
    undo,
    redo,
    canUndo,
    canRedo,
    currentDiagramId,
    modules,
    switchToDiagram,
    toggleGridSnap,
    applyAutoLayout,
    fitToScreen,
    resetZoom,
    onlineUsers,
    isWebSocketConnected,
    isReconnecting,
    reconnectAttempts,
    nodes,
    links,
    setShowPatternLibrary,
    commitVersion,
    restoreVersion,
    currentProjectId,
    currentDiagramDbId,
    projectRole,
    remoteOutOfSync,
    hasLocalChanges,
    reloadDiagramFromDB,
  } = useDiagramStore();
  const { viewport, gridSnapEnabled } = canvasState;
  const canEdit = projectRole !== 'viewer';

  // パンくずリスト生成
  const getBreadcrumbs = () => {
    const breadcrumbs: Array<{ id: string; title: string }> = [];
    let currentId = currentDiagramId;
    const visited = new Set<string>(); // 無限ループ防止

    // 現在のダイアグラムから親方向に辿る
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);

      if (currentId === 'root') {
        // rootダイアグラムに到達
        const rootData = modules['root'];
        breadcrumbs.unshift({ id: 'root', title: rootData?.title || 'Root' });
        break;
      } else {
        const moduleData = modules[currentId];
        if (moduleData) {
          breadcrumbs.unshift({ id: currentId, title: moduleData.title });
          const parentId = moduleData.metadata.parentModuleId;

          if (!parentId || parentId === '') {
            // 親がない場合はrootを追加して終了
            const rootData = modules['root'];
            breadcrumbs.unshift({ id: 'root', title: rootData?.title || 'Root' });
            break;
          }

          currentId = parentId;
        } else {
          // 現在のダイアグラム（まだmodulesに保存されていない）
          breadcrumbs.unshift({ id: currentId, title: title });
          // rootを追加
          const rootData = modules['root'];
          breadcrumbs.unshift({ id: 'root', title: rootData?.title || 'Root' });
          break;
        }
      }
    }

    // rootが含まれていない場合は先頭に追加
    if (breadcrumbs.length === 0 || breadcrumbs[0].id !== 'root') {
      const rootData = modules['root'];
      breadcrumbs.unshift({ id: 'root', title: rootData?.title || 'Root' });
    }

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();
  const roleLabel = projectRole
    ? projectRole === 'owner'
      ? 'Owner'
      : projectRole === 'editor'
        ? 'Editor'
        : 'Viewer'
    : null;

  // すべてのモジュールを取得（rootを除く）
  const getAllModules = () => {
    return Object.entries(modules)
      .filter(([id]) => id !== 'root')
      .map(([id, data]) => ({ id, title: data.title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  };

  const allModules = getAllModules();

  // ドロップダウンを閉じる
  useEffect(() => {
    const handleClickOutside = () => {
      if (showModuleList || showExportMenu) {
        setShowModuleList(false);
        setShowExportMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showModuleList, showExportMenu]);

  // キーボードショートカット（Ctrl+Z / Ctrl+Y）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo()) {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (canRedo()) {
          redo();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  // メニューを閉じる
  useEffect(() => {
    const handleClick = () => setShowExportMenu(false);
    if (showExportMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showExportMenu]);

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

  const handleExportProject = () => {
    const data = exportProjectData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'gsn-project'}-project.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleImport = () => {
    if (!canEdit) {
      alert('このプロジェクトは閲覧専用です');
      return;
    }
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

            // プロジェクトデータかダイアグラムデータかを判定
            if (data.modules && data.labelCounters) {
              // プロジェクトデータ
              if (confirm('プロジェクト全体をインポートしますか？現在のデータは上書きされます。')) {
                importProjectData(data);
              }
            } else {
              // 単一ダイアグラムデータ
              importData(data);
            }
          } catch {
            alert('JSONファイルの読み込みに失敗しました');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleReset = () => {
    if (!canEdit) {
      alert('このプロジェクトは閲覧専用です');
      return;
    }
    if (confirm('すべてのデータをリセットしますか？')) {
      reset();
    }
  };

  const handleValidate = () => {
    const result = validateDiagram(nodes, links);
    setValidationResult(result);
  };

  const handleCommit = async (message: string) => {
    try {
      if (!canEdit) {
        alert('このプロジェクトは閲覧専用です');
        return;
      }
      await commitVersion(message);
      setShowCommitModal(false);
      alert('コミットが完了しました');
    } catch (error) {
      console.error('Commit error:', error);
      alert('コミットに失敗しました');
    }
  };

  const handleRestore = async (versionId: string) => {
    try {
      await restoreVersion(versionId);
      setShowVersionHistory(false);
      alert('バージョンの復元が完了しました');
    } catch (error) {
      console.error('Restore error:', error);
      alert('復元に失敗しました');
    }
  };

  return (
    <div
      style={{
        height: '60px',
        borderBottom: '1px solid #E5E7EB',
        backgroundColor: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: '12px',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* プロジェクト一覧に戻るボタン */}
      {onBackToProjects && (
        <button
          onClick={onBackToProjects}
          style={{
            padding: '6px 10px',
            fontSize: '12px',
            fontWeight: '500',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            cursor: 'pointer',
            backgroundColor: '#FFFFFF',
            color: '#374151',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s',
            flexShrink: 0,
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
          <span>←</span>
          <span>{t('projects.title')}</span>
        </button>
      )}

      {/* パンくずリスト */}
      {breadcrumbs.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', flexShrink: 1, minWidth: 0 }}>
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.id}>
              {index > 0 && <span style={{ color: '#9CA3AF', flexShrink: 0 }}>›</span>}
              {index === breadcrumbs.length - 1 ? (
                <span style={{ color: '#374151', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{crumb.title}</span>
              ) : (
                <button
                  onClick={() => switchToDiagram(crumb.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#3B82F6',
                    cursor: 'pointer',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    transition: 'background-color 0.2s',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#EFF6FF';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {crumb.title}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="タイトル"
        style={{
          width: '160px',
          padding: '6px 10px',
          fontSize: '13px',
          border: '1px solid #D1D5DB',
          borderRadius: '6px',
          backgroundColor: '#FFFFFF',
          outline: 'none',
          transition: 'border-color 0.2s',
          flexShrink: 0,
        }}
        onFocus={(e) => (e.target.style.borderColor = '#3B82F6')}
        onBlur={(e) => (e.target.style.borderColor = '#D1D5DB')}
      />

      {/* モジュール一覧ドロップダウン */}
      {allModules.length > 0 && (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowModuleList(!showModuleList);
            }}
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: '500',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: '#FFFFFF',
              color: '#374151',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
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
            <span>📁</span>
            <span>{t('nodes.Module')} ({allModules.length})</span>
          </button>

          {showModuleList && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                minWidth: '200px',
                maxHeight: '300px',
                overflowY: 'auto',
                zIndex: 1000,
              }}
            >
              {allModules.map((module) => (
                <button
                  key={module.id}
                  onClick={() => {
                    switchToDiagram(module.id);
                    setShowModuleList(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: 'none',
                    backgroundColor: module.id === currentDiagramId ? '#EFF6FF' : '#FFFFFF',
                    color: module.id === currentDiagramId ? '#3B82F6' : '#374151',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    fontWeight: module.id === currentDiagramId ? '600' : '400',
                  }}
                  onMouseEnter={(e) => {
                    if (module.id !== currentDiagramId) {
                      e.currentTarget.style.backgroundColor = '#F9FAFB';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (module.id !== currentDiagramId) {
                      e.currentTarget.style.backgroundColor = '#FFFFFF';
                    }
                  }}
                >
                  {module.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        {/* Undo/Redoボタン */}
        <button
          onClick={undo}
          disabled={!canUndo() || !canEdit}
          title="元に戻す (Ctrl+Z)"
          style={{
            width: '30px',
            height: '30px',
            fontSize: '16px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            cursor: canUndo() && canEdit ? 'pointer' : 'not-allowed',
            backgroundColor: '#FFFFFF',
            color: canUndo() && canEdit ? '#374151' : '#D1D5DB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (canUndo() && canEdit) {
              e.currentTarget.style.backgroundColor = '#F3F4F6';
              e.currentTarget.style.borderColor = '#9CA3AF';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FFFFFF';
            e.currentTarget.style.borderColor = '#D1D5DB';
          }}
        >
          ↶
        </button>
        <button
          onClick={redo}
          disabled={!canRedo() || !canEdit}
          title="やり直す (Ctrl+Y)"
          style={{
            width: '30px',
            height: '30px',
            fontSize: '16px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            cursor: canRedo() && canEdit ? 'pointer' : 'not-allowed',
            backgroundColor: '#FFFFFF',
            color: canRedo() && canEdit ? '#374151' : '#D1D5DB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (canRedo() && canEdit) {
              e.currentTarget.style.backgroundColor = '#F3F4F6';
              e.currentTarget.style.borderColor = '#9CA3AF';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FFFFFF';
            e.currentTarget.style.borderColor = '#D1D5DB';
          }}
        >
          ↷
        </button>

        <button
          onClick={() => onOpenSurveyManager?.()}
          disabled={!currentProjectId}
          title="アンケート"
          style={{
            padding: '6px 12px',
            fontSize: '13px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            cursor: currentProjectId ? 'pointer' : 'not-allowed',
            backgroundColor: '#FFFFFF',
            color: currentProjectId ? '#374151' : '#D1D5DB',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (currentProjectId) {
              e.currentTarget.style.backgroundColor = '#F3F4F6';
              e.currentTarget.style.borderColor = '#9CA3AF';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FFFFFF';
            e.currentTarget.style.borderColor = '#D1D5DB';
          }}
        >
          <span>📝</span>
          <span>{t('header.surveys')}</span>
        </button>

        {/* コミットボタン */}
        <button
          onClick={() => setShowCommitModal(true)}
          disabled={!currentProjectId || !currentDiagramDbId || !canEdit}
          title="コミット"
          style={{
            padding: '6px 12px',
            fontSize: '13px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            cursor: currentProjectId && currentDiagramDbId && canEdit ? 'pointer' : 'not-allowed',
            backgroundColor: '#FFFFFF',
            color: currentProjectId && currentDiagramDbId && canEdit ? '#374151' : '#D1D5DB',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (currentProjectId && currentDiagramDbId && canEdit) {
              e.currentTarget.style.backgroundColor = '#F3F4F6';
              e.currentTarget.style.borderColor = '#9CA3AF';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FFFFFF';
            e.currentTarget.style.borderColor = '#D1D5DB';
          }}
        >
          <span>💾</span>
          <span>{t('header.commit')}</span>
        </button>

        {/* 履歴ボタン */}
        <button
          onClick={() => setShowVersionHistory(true)}
          disabled={!currentProjectId || !currentDiagramDbId}
          title="履歴"
          style={{
            padding: '6px 12px',
            fontSize: '13px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            cursor: currentProjectId && currentDiagramDbId ? 'pointer' : 'not-allowed',
            backgroundColor: '#FFFFFF',
            color: currentProjectId && currentDiagramDbId ? '#374151' : '#D1D5DB',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (currentProjectId && currentDiagramDbId) {
              e.currentTarget.style.backgroundColor = '#F3F4F6';
              e.currentTarget.style.borderColor = '#9CA3AF';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FFFFFF';
            e.currentTarget.style.borderColor = '#D1D5DB';
          }}
        >
          <span>📜</span>
          <span>{t('header.history')}</span>
        </button>

        {/* グリッドスナップトグル */}
        <button
          onClick={toggleGridSnap}
          title={gridSnapEnabled ? 'グリッドスナップOFF' : 'グリッドスナップON'}
          style={{
            width: '30px',
            height: '30px',
            fontSize: '16px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            cursor: 'pointer',
            backgroundColor: gridSnapEnabled ? '#3B82F6' : '#FFFFFF',
            color: gridSnapEnabled ? '#FFFFFF' : '#374151',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!gridSnapEnabled) {
              e.currentTarget.style.backgroundColor = '#F3F4F6';
              e.currentTarget.style.borderColor = '#9CA3AF';
            }
          }}
          onMouseLeave={(e) => {
            if (!gridSnapEnabled) {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
              e.currentTarget.style.borderColor = '#D1D5DB';
            }
          }}
        >
          ⊞
        </button>

        {/* 自動レイアウトボタン */}
        <button
          onClick={applyAutoLayout}
          title="自動レイアウト"
          disabled={!canEdit}
          style={{
            width: '30px',
            height: '30px',
            fontSize: '16px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            cursor: canEdit ? 'pointer' : 'not-allowed',
            backgroundColor: '#FFFFFF',
            color: canEdit ? '#374151' : '#D1D5DB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (canEdit) {
              e.currentTarget.style.backgroundColor = '#F3F4F6';
              e.currentTarget.style.borderColor = '#9CA3AF';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FFFFFF';
            e.currentTarget.style.borderColor = '#D1D5DB';
          }}
        >
          ⚡
        </button>

        {/* パターンライブラリボタン */}
        <button
          onClick={() => setShowPatternLibrary(true)}
          title="パターンライブラリ"
          disabled={!canEdit}
          style={{
            height: '30px',
            padding: '0 10px',
            fontSize: '12px',
            border: '1px solid #059669',
            borderRadius: '6px',
            cursor: canEdit ? 'pointer' : 'not-allowed',
            backgroundColor: '#ECFDF5',
            color: canEdit ? '#059669' : '#9CA3AF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            transition: 'all 0.2s',
            fontWeight: '500',
            opacity: canEdit ? 1 : 0.6,
          }}
          onMouseEnter={(e) => {
            if (canEdit) {
              e.currentTarget.style.backgroundColor = '#D1FAE5';
              e.currentTarget.style.borderColor = '#047857';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#ECFDF5';
            e.currentTarget.style.borderColor = '#059669';
          }}
        >
          📋 {t('patterns.title')}
        </button>

        {/* 検証ボタン */}
        <button
          onClick={handleValidate}
          title="GSN検証"
          style={{
            width: '30px',
            height: '30px',
            fontSize: '14px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            cursor: 'pointer',
            backgroundColor: '#FFFFFF',
            color: '#374151',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
          ✓
        </button>

        {/* フィット・リセットボタン */}
        <button
          onClick={fitToScreen}
          title="全体表示 (Fit to Screen)"
          style={{
            width: '30px',
            height: '30px',
            fontSize: '14px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            cursor: 'pointer',
            backgroundColor: '#FFFFFF',
            color: '#374151',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
          ⊡
        </button>

        <span
          onClick={resetZoom}
          title="100%にリセット"
          style={{
            fontSize: '12px',
            color: '#6B7280',
            fontWeight: '500',
            cursor: 'pointer',
            padding: '2px 6px',
            borderRadius: '4px',
            transition: 'background-color 0.2s',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F3F4F6')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          {Math.round(viewport.scale * 100)}%
        </span>
        <button
          onClick={handleZoomOut}
          style={{
            width: '30px',
            height: '30px',
            fontSize: '16px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            cursor: 'pointer',
            backgroundColor: '#FFFFFF',
            color: '#374151',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
          −
        </button>
        <button
          onClick={handleZoomIn}
          style={{
            width: '30px',
            height: '30px',
            fontSize: '16px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            cursor: 'pointer',
            backgroundColor: '#FFFFFF',
            color: '#374151',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
          ＋
        </button>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto', alignItems: 'center', flexShrink: 0 }}>
        {/* 接続ステータス */}
        {!isWebSocketConnected && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 8px',
            backgroundColor: isReconnecting ? '#FEF3C7' : '#FEE2E2',
            border: `1px solid ${isReconnecting ? '#FCD34D' : '#FCA5A5'}`,
            borderRadius: '6px',
            fontSize: '11px',
            color: isReconnecting ? '#92400E' : '#991B1B',
            fontWeight: 500,
          }}>
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: isReconnecting ? '#F59E0B' : '#DC2626',
              }}
            />
            {isReconnecting ? (
              <span>{t('common.reconnecting')} ({reconnectAttempts})</span>
            ) : (
              <span>{t('common.disconnected')}</span>
            )}
          </div>
        )}

        {/* オンラインユーザー表示 */}
        {isWebSocketConnected && onlineUsers.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 8px',
            backgroundColor: '#F0FDF4',
            border: '1px solid #86EFAC',
            borderRadius: '6px',
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#22C55E',
            }} />
            <span style={{
              fontSize: '11px',
              color: '#16A34A',
              fontWeight: '500',
            }}>
              {t('header.onlineUsers', { count: onlineUsers.length })}
            </span>
          </div>
        )}

        {remoteOutOfSync && currentProjectId && currentDiagramDbId && (
          <button
            onClick={() => reloadDiagramFromDB(currentProjectId, currentDiagramDbId)}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: '600',
              border: '1px solid #F59E0B',
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: '#FFFBEB',
              color: '#92400E',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title={hasLocalChanges ? '未保存の変更があるため自動同期を停止しています' : '最新状態に再読み込み'}
          >
            <span>{t('common.syncDiff')}</span>
            <span>{t('common.reload')}</span>
          </button>
        )}

        {/* ユーザー情報 */}
        {user && onLogout && (
          <>
            {roleLabel && (
              <span style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '10px',
                backgroundColor: projectRole === 'viewer' ? '#FEF3C7' : '#E0F2FE',
                color: projectRole === 'viewer' ? '#92400E' : '#0369A1',
                fontWeight: '600',
                textTransform: 'uppercase',
              }}>
                {roleLabel}
              </span>
            )}
            <span style={{
              fontSize: '11px',
              color: '#6B7280',
              fontWeight: '500',
              maxWidth: '120px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {user.firstName || user.lastName
                ? `${user.lastName || ''} ${user.firstName || ''}`.trim()
                : user.email}
            </span>
            <button
              onClick={onLogout}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: '500',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: '#FFFFFF',
                color: '#EF4444',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#FEF2F2';
                e.currentTarget.style.borderColor = '#EF4444';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#FFFFFF';
                e.currentTarget.style.borderColor = '#D1D5DB';
              }}
            >
              {t('auth.logout')}
            </button>
          </>
        )}

        {/* 言語切り替え */}
        <LanguageSwitcher />

        {/* エクスポートドロップダウン */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowExportMenu(!showExportMenu);
            }}
            style={{
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: '500',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: '#3B82F6',
              color: '#FFFFFF',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2563EB')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#3B82F6')}
          >
            Export ▾
          </button>

          {showExportMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '4px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                zIndex: 1000,
                minWidth: '160px',
              }}
            >
              <button
                onClick={() => {
                  handleExport();
                  setShowExportMenu(false);
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#374151',
                  borderRadius: '8px 8px 0 0',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F3F4F6')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                JSON（現在のダイアグラム）
              </button>
              <button
                onClick={handleExportProject}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#059669',
                  fontWeight: '600',
                  borderBottom: '1px solid #E5E7EB',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ECFDF5')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                プロジェクト全体（全モジュール）
              </button>
              <button
                onClick={() => {
                  exportAsImage('png');
                  setShowExportMenu(false);
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#374151',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F3F4F6')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                PNG画像
              </button>
              <button
                onClick={() => {
                  exportAsImage('svg');
                  setShowExportMenu(false);
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#374151',
                  borderRadius: '0 0 8px 8px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F3F4F6')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                SVG画像
              </button>
            </div>
          )}
        </div>
        <button
          onClick={handleImport}
          disabled={!canEdit}
          style={{
            padding: '5px 10px',
            fontSize: '11px',
            fontWeight: '500',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            cursor: canEdit ? 'pointer' : 'not-allowed',
            backgroundColor: '#FFFFFF',
            color: canEdit ? '#374151' : '#D1D5DB',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (canEdit) {
              e.currentTarget.style.backgroundColor = '#F3F4F6';
              e.currentTarget.style.borderColor = '#9CA3AF';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FFFFFF';
            e.currentTarget.style.borderColor = '#D1D5DB';
          }}
        >
          Import
        </button>
        <button
          onClick={handleReset}
          disabled={!canEdit}
          style={{
            padding: '5px 10px',
            fontSize: '11px',
            fontWeight: '500',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            cursor: canEdit ? 'pointer' : 'not-allowed',
            backgroundColor: '#FFFFFF',
            color: canEdit ? '#EF4444' : '#D1D5DB',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (canEdit) {
              e.currentTarget.style.backgroundColor = '#FEF2F2';
              e.currentTarget.style.borderColor = '#EF4444';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FFFFFF';
            e.currentTarget.style.borderColor = '#D1D5DB';
          }}
        >
          Reset
        </button>
      </div>

      {/* 検証結果モーダル */}
      {validationResult && (
        <ValidationModal
          result={validationResult}
          onClose={() => setValidationResult(null)}
        />
      )}

      {/* コミットモーダル */}
      <CommitModal
        isOpen={showCommitModal}
        onClose={() => setShowCommitModal(false)}
        onCommit={handleCommit}
      />

      {/* バージョン履歴モーダル */}
      <VersionHistoryModal
        isOpen={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
        projectId={currentProjectId || ''}
        diagramId={currentDiagramDbId || ''}
        onRestore={handleRestore}
      />
    </div>
  );
};
