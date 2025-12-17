import React, { useEffect, useState } from 'react';
import { useDiagramStore } from '../../stores/diagramStore';
import type { User } from '../../services/api';

interface HeaderProps {
  user?: User | null;
  onLogout?: () => void;
  onBackToProjects?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout, onBackToProjects }) => {
  const [showExportMenu, setShowExportMenu] = useState(false);

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
  } = useDiagramStore();
  const { viewport, gridSnapEnabled } = canvasState;

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
    if (confirm('すべてのデータをリセットしますか？')) {
      reset();
    }
  };

  return (
    <div
      style={{
        height: '64px',
        borderBottom: '1px solid #E5E7EB',
        backgroundColor: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: '24px',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* プロジェクト一覧に戻るボタン */}
      {onBackToProjects && (
        <>
          <button
            onClick={onBackToProjects}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '500',
              border: '1px solid #D1D5DB',
              borderRadius: '8px',
              cursor: 'pointer',
              backgroundColor: '#FFFFFF',
              color: '#374151',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
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
            <span>←</span>
            <span>プロジェクト一覧</span>
          </button>
          <div style={{ width: '1px', height: '24px', backgroundColor: '#E5E7EB', margin: '0 4px' }} />
        </>
      )}

      {/* パンくずリスト */}
      {breadcrumbs.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.id}>
              {index > 0 && <span style={{ color: '#9CA3AF' }}>›</span>}
              {index === breadcrumbs.length - 1 ? (
                <span style={{ color: '#374151', fontWeight: '500' }}>{crumb.title}</span>
              ) : (
                <button
                  onClick={() => switchToDiagram(crumb.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#3B82F6',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '14px',
                    transition: 'background-color 0.2s',
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
          width: '200px',
          padding: '10px 14px',
          fontSize: '15px',
          border: '1px solid #D1D5DB',
          borderRadius: '8px',
          backgroundColor: '#FFFFFF',
          outline: 'none',
          transition: 'border-color 0.2s',
        }}
        onFocus={(e) => (e.target.style.borderColor = '#3B82F6')}
        onBlur={(e) => (e.target.style.borderColor = '#D1D5DB')}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Undo/Redoボタン */}
        <button
          onClick={undo}
          disabled={!canUndo()}
          title="元に戻す (Ctrl+Z)"
          style={{
            width: '36px',
            height: '36px',
            fontSize: '18px',
            border: '1px solid #D1D5DB',
            borderRadius: '8px',
            cursor: canUndo() ? 'pointer' : 'not-allowed',
            backgroundColor: '#FFFFFF',
            color: canUndo() ? '#374151' : '#D1D5DB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (canUndo()) {
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
          disabled={!canRedo()}
          title="やり直す (Ctrl+Y)"
          style={{
            width: '36px',
            height: '36px',
            fontSize: '18px',
            border: '1px solid #D1D5DB',
            borderRadius: '8px',
            cursor: canRedo() ? 'pointer' : 'not-allowed',
            backgroundColor: '#FFFFFF',
            color: canRedo() ? '#374151' : '#D1D5DB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (canRedo()) {
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

        <div style={{ width: '1px', height: '24px', backgroundColor: '#E5E7EB', margin: '0 4px' }} />

        {/* グリッドスナップトグル */}
        <button
          onClick={toggleGridSnap}
          title={gridSnapEnabled ? 'グリッドスナップOFF' : 'グリッドスナップON'}
          style={{
            width: '36px',
            height: '36px',
            fontSize: '18px',
            border: '1px solid #D1D5DB',
            borderRadius: '8px',
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
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '500',
            border: '1px solid #D1D5DB',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: '#FFFFFF',
            color: '#374151',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
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
          <span style={{ fontSize: '16px' }}>⚡</span>
          <span>整列</span>
        </button>

        <div style={{ width: '1px', height: '24px', backgroundColor: '#E5E7EB', margin: '0 4px' }} />

        {/* フィット・リセットボタン */}
        <button
          onClick={fitToScreen}
          title="全体表示 (Fit to Screen)"
          style={{
            width: '36px',
            height: '36px',
            fontSize: '16px',
            border: '1px solid #D1D5DB',
            borderRadius: '8px',
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
            fontSize: '14px',
            color: '#6B7280',
            fontWeight: '500',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '4px',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F3F4F6')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          {Math.round(viewport.scale * 100)}%
        </span>
        <button
          onClick={handleZoomOut}
          style={{
            width: '36px',
            height: '36px',
            fontSize: '18px',
            border: '1px solid #D1D5DB',
            borderRadius: '8px',
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
            width: '36px',
            height: '36px',
            fontSize: '18px',
            border: '1px solid #D1D5DB',
            borderRadius: '8px',
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

      <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', alignItems: 'center' }}>
        {/* ユーザー情報 */}
        {user && onLogout && (
          <>
            <span style={{
              fontSize: '13px',
              color: '#6B7280',
              fontWeight: '500',
              maxWidth: '150px',
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
                padding: '6px 12px',
                fontSize: '13px',
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
              ログアウト
            </button>
            <div style={{ width: '1px', height: '20px', backgroundColor: '#E5E7EB', margin: '0 2px' }} />
          </>
        )}

        {/* エクスポートドロップダウン */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowExportMenu(!showExportMenu);
            }}
            style={{
              padding: '7px 14px',
              fontSize: '13px',
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
            エクスポート ▾
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
          style={{
            padding: '7px 14px',
            fontSize: '13px',
            fontWeight: '500',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
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
          インポート
        </button>
        <button
          onClick={handleReset}
          style={{
            padding: '7px 14px',
            fontSize: '13px',
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
          リセット
        </button>
      </div>
    </div>
  );
};
