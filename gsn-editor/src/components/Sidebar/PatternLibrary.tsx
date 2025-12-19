import React, { useState, useEffect } from 'react';
import { patternsApi } from '../../api/patterns';
import type { Pattern, PatternData } from '../../api/patterns';
import { useAuthStore } from '../../stores/authStore';

interface PatternLibraryProps {
  onApplyPattern: (patternData: PatternData) => void;
  onClose: () => void;
}

export const PatternLibrary: React.FC<PatternLibraryProps> = ({
  onApplyPattern,
  onClose,
}) => {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'mine' | 'public'>('mine');
  const [selectedPattern, setSelectedPattern] = useState<Pattern | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { user } = useAuthStore();

  // パターン一覧を取得
  const fetchPatterns = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await patternsApi.getAll();
      setPatterns(data);
    } catch (err) {
      console.error('Failed to fetch patterns:', err);
      setError('パターンの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatterns();
  }, []);

  // タブでフィルターしたパターン
  const filteredPatterns = patterns.filter((pattern) => {
    if (activeTab === 'mine') {
      return pattern.authorId === user?.id;
    } else {
      return pattern.isPublic && pattern.authorId !== user?.id;
    }
  });

  // パターン削除
  const handleDelete = async (patternId: string) => {
    try {
      await patternsApi.delete(patternId);
      setPatterns((prev) => prev.filter((p) => p.id !== patternId));
      setDeleteConfirm(null);
      if (selectedPattern?.id === patternId) {
        setSelectedPattern(null);
      }
    } catch (err) {
      console.error('Failed to delete pattern:', err);
      setError('パターンの削除に失敗しました');
    }
  };

  // 作成者名を取得
  const getAuthorName = (pattern: Pattern) => {
    if (pattern.author.firstName && pattern.author.lastName) {
      return `${pattern.author.firstName} ${pattern.author.lastName}`;
    }
    return pattern.author.email.split('@')[0];
  };

  // 日時フォーマット
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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
            padding: '16px 20px',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
            パターンライブラリ
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

        {/* タブ */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #E5E7EB',
            padding: '0 20px',
          }}
        >
          <button
            onClick={() => setActiveTab('mine')}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === 'mine' ? 600 : 400,
              color: activeTab === 'mine' ? '#2563EB' : '#6B7280',
              borderBottom: activeTab === 'mine' ? '2px solid #2563EB' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            自分のパターン
          </button>
          <button
            onClick={() => setActiveTab('public')}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === 'public' ? 600 : 400,
              color: activeTab === 'public' ? '#2563EB' : '#6B7280',
              borderBottom: activeTab === 'public' ? '2px solid #2563EB' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            公開パターン
          </button>
        </div>

        {/* コンテンツ */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* パターンリスト */}
          <div
            style={{
              width: '280px',
              borderRight: '1px solid #E5E7EB',
              overflowY: 'auto',
            }}
          >
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280' }}>
                読み込み中...
              </div>
            ) : error ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#EF4444' }}>
                {error}
              </div>
            ) : filteredPatterns.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280' }}>
                {activeTab === 'mine'
                  ? 'パターンがありません。GSNを選択して右クリック→「パターンとして保存」で作成できます。'
                  : '公開パターンがありません。'}
              </div>
            ) : (
              filteredPatterns.map((pattern) => (
                <div
                  key={pattern.id}
                  onClick={() => setSelectedPattern(pattern)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #F3F4F6',
                    cursor: 'pointer',
                    backgroundColor:
                      selectedPattern?.id === pattern.id ? '#EFF6FF' : 'transparent',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 500,
                      fontSize: '14px',
                      marginBottom: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {pattern.name}
                    {pattern.isPublic && (
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          backgroundColor: '#DBEAFE',
                          color: '#1D4ED8',
                          borderRadius: '4px',
                        }}
                      >
                        公開
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>
                    {pattern.data.nodes.length}ノード・{pattern.data.links.length}リンク
                  </div>
                </div>
              ))
            )}
          </div>

          {/* パターン詳細 */}
          <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
            {selectedPattern ? (
              <>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>
                  {selectedPattern.name}
                </h3>
                {selectedPattern.description && (
                  <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#6B7280' }}>
                    {selectedPattern.description}
                  </p>
                )}
                <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px' }}>
                  <div>作成者: {getAuthorName(selectedPattern)}</div>
                  <div>作成日: {formatDate(selectedPattern.createdAt)}</div>
                  <div>
                    構成: {selectedPattern.data.nodes.length}ノード・
                    {selectedPattern.data.links.length}リンク
                  </div>
                </div>

                {/* ノード一覧プレビュー */}
                <div
                  style={{
                    backgroundColor: '#F9FAFB',
                    borderRadius: '6px',
                    padding: '12px',
                    marginBottom: '16px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '8px' }}>
                    ノード一覧
                  </div>
                  {selectedPattern.data.nodes.map((node, index) => (
                    <div
                      key={index}
                      style={{
                        fontSize: '12px',
                        padding: '4px 0',
                        borderBottom: index < selectedPattern.data.nodes.length - 1 ? '1px solid #E5E7EB' : 'none',
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{node.label || node.type}</span>
                      {node.content && (
                        <span style={{ color: '#6B7280', marginLeft: '8px' }}>
                          {node.content.replace(/<[^>]*>/g, '').substring(0, 30)}
                          {node.content.length > 30 ? '...' : ''}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* アクションボタン */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => onApplyPattern(selectedPattern.data)}
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
                    貼り付け
                  </button>
                  {selectedPattern.authorId === user?.id && (
                    <>
                      {deleteConfirm === selectedPattern.id ? (
                        <>
                          <button
                            onClick={() => handleDelete(selectedPattern.id)}
                            style={{
                              padding: '10px 16px',
                              backgroundColor: '#EF4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '14px',
                            }}
                          >
                            削除する
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            style={{
                              padding: '10px 16px',
                              backgroundColor: '#F3F4F6',
                              color: '#374151',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '14px',
                            }}
                          >
                            キャンセル
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(selectedPattern.id)}
                          style={{
                            padding: '10px 16px',
                            backgroundColor: '#FEE2E2',
                            color: '#DC2626',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                          }}
                        >
                          削除
                        </button>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#9CA3AF',
                  fontSize: '14px',
                }}
              >
                パターンを選択してください
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
