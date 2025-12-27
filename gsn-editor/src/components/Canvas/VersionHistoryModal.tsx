import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { versionsApi } from '../../api/versions';
import type { DiagramVersion } from '../../api/versions';
import { LoadingState } from '../Status/LoadingState';
import { ErrorState } from '../Status/ErrorState';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  diagramId: string;
  onRestore: (versionId: string) => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  onClose,
  projectId,
  diagramId,
  onRestore,
}) => {
  const { t, i18n } = useTranslation();
  const [versions, setVersions] = useState<DiagramVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await versionsApi.getAll(projectId, diagramId);
      setVersions(data);
    } catch (err: unknown) {
      console.error('Failed to load versions:', err);
      const message =
        typeof (err as { response?: { data?: { error?: string } } })?.response?.data?.error === 'string'
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : err instanceof Error
            ? err.message
            : t('version.loadError');
      setError(message ?? t('version.loadError'));
    } finally {
      setLoading(false);
    }
  }, [projectId, diagramId]);

  // バージョン一覧取得
  useEffect(() => {
    if (isOpen && projectId && diagramId) {
      loadVersions();
    }
  }, [isOpen, projectId, diagramId, loadVersions]);

  // ロールバック
  const handleRestore = async (versionId: string) => {
    if (!confirm(t('version.restoreConfirmWithWarning'))) {
      return;
    }
    onRestore(versionId);
    onClose();
  };

  // 日時フォーマット
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const locale = i18n.language === 'ja' ? 'ja-JP' : 'en-US';
    return date.toLocaleString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

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
          width: '700px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
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
            📜 {t('version.history')}
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
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {loading && <LoadingState />}

          {error && <ErrorState message={error} />}

          {!loading && versions.length === 0 && (
            <div style={{ textAlign: 'center', color: '#6B7280', padding: '40px' }}>
              {t('version.noVersions')}
              <br />
              {t('version.createFirstVersion')}
            </div>
          )}

          {!loading && versions.length > 0 && (
            <div>
              {/* タイムライン */}
              {versions.map((version, index) => (
                <div
                  key={version.id}
                  style={{
                    display: 'flex',
                    marginBottom: index < versions.length - 1 ? '24px' : 0,
                    position: 'relative',
                  }}
                >
                  {/* タイムライン線 */}
                  {index < versions.length - 1 && (
                    <div
                      style={{
                        position: 'absolute',
                        left: '19px',
                        top: '40px',
                        bottom: '-24px',
                        width: '2px',
                        backgroundColor: '#E5E7EB',
                      }}
                    />
                  )}

                  {/* バージョン番号アイコン */}
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: index === 0 ? '#3B82F6' : '#9CA3AF',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      flexShrink: 0,
                      marginRight: '16px',
                    }}
                  >
                    v{version.versionNumber}
                  </div>

                  {/* バージョン情報 */}
                  <div
                    style={{
                      flex: 1,
                      backgroundColor: index === 0 ? '#EFF6FF' : '#F9FAFB',
                      borderRadius: '8px',
                      padding: '16px',
                      border: index === 0 ? '2px solid #3B82F6' : '1px solid #E5E7EB',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '8px',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '4px' }}>
                          {version.commitMessage || t('version.noCommitMessage')}
                        </div>
                        <div style={{ fontSize: '13px', color: '#6B7280' }}>
                          {formatDate(version.createdAt)}
                          {index === 0 && (
                            <span
                              style={{
                                marginLeft: '8px',
                                padding: '2px 8px',
                                backgroundColor: '#3B82F6',
                                color: 'white',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                              }}
                            >
                              {t('version.latest')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {index !== 0 && (
                          <button
                            onClick={() => handleRestore(version.id)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#10B981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: '500',
                            }}
                          >
                            {t('version.restore')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* フッター */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #E5E7EB',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
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
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
