import React, { useState, useEffect } from 'react';
import { versionsApi } from '../../api/versions';
import type { DiagramVersion } from '../../api/versions';

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
  const [versions, setVersions] = useState<DiagramVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // バージョン一覧取得
  useEffect(() => {
    if (isOpen && projectId && diagramId) {
      loadVersions();
    }
  }, [isOpen, projectId, diagramId]);

  const loadVersions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await versionsApi.getAll(projectId, diagramId);
      setVersions(data);
    } catch (err: any) {
      console.error('Failed to load versions:', err);
      setError(err.response?.data?.error || 'バージョン一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // ロールバック
  const handleRestore = async (versionId: string) => {
    if (!confirm('このバージョンに復元しますか？\n現在の状態は失われます。')) {
      return;
    }
    onRestore(versionId);
    onClose();
  };

  // 日時フォーマット
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
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
            📜 バージョン履歴
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
          {loading && <div style={{ textAlign: 'center', color: '#6B7280' }}>読み込み中...</div>}

          {error && (
            <div
              style={{
                padding: '12px',
                backgroundColor: '#FEE2E2',
                color: '#991B1B',
                borderRadius: '6px',
                marginBottom: '16px',
              }}
            >
              {error}
            </div>
          )}

          {!loading && versions.length === 0 && (
            <div style={{ textAlign: 'center', color: '#6B7280', padding: '40px' }}>
              バージョン履歴がありません。
              <br />
              「コミット」ボタンから最初のバージョンを作成してください。
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
                          {version.commitMessage || '(コミットメッセージなし)'}
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
                              最新
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
                            復元
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
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
