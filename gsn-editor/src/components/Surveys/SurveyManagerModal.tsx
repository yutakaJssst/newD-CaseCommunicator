import React, { useEffect, useMemo, useState } from 'react';
import { surveysApi, type Survey, type SurveyAnalytics } from '../../api/surveys';
import { LoadingState } from '../Status/LoadingState';
import { ErrorState } from '../Status/ErrorState';
import { useDiagramStore } from '../../stores/diagramStore';

interface SurveyManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

export const SurveyManagerModal: React.FC<SurveyManagerModalProps> = ({
  isOpen,
  onClose,
  projectId,
}) => {
  const exportProjectData = useDiagramStore((state) => state.exportProjectData);
  const currentDiagramDbId = useDiagramStore((state) => state.currentDiagramDbId);
  const projectRole = useDiagramStore((state) => state.projectRole);
  const surveyResponseEvent = useDiagramStore((state) => state.surveyResponseEvent);
  const canEdit = projectRole !== 'viewer';

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [analytics, setAnalytics] = useState<SurveyAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const publicUrl = useMemo(() => {
    if (!selectedSurvey?.publicToken) return null;
    return `${window.location.origin}/survey/${selectedSurvey.publicToken}`;
  }, [selectedSurvey?.publicToken]);

  const introDirty = useMemo(() => {
    if (!selectedSurvey) return false;
    const currentDescription = selectedSurvey.description ?? '';
    const currentImage = selectedSurvey.publicImageUrl ?? '';
    return editDescription !== currentDescription || editImageUrl !== currentImage;
  }, [editDescription, editImageUrl, selectedSurvey?.description, selectedSurvey?.publicImageUrl]);

  const nodeMap = useMemo(() => {
    const snapshot = selectedSurvey?.gsnSnapshot as any;
    if (!snapshot || typeof snapshot !== 'object') return new Map<string, any>();
    const modules = snapshot.modules && typeof snapshot.modules === 'object'
      ? snapshot.modules
      : { root: snapshot };
    const allNodes = Object.values(modules)
      .flatMap((module: any) => (Array.isArray(module?.nodes) ? module.nodes : []));
    return new Map(allNodes.map((node: any) => [String(node.id), node]));
  }, [selectedSurvey?.gsnSnapshot]);

  const stripHtml = (html?: string) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
  };

  const readImageFile = (file: File, onLoad: (dataUrl: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (result) {
        onLoad(result);
      } else {
        setError('画像の読み込みに失敗しました');
      }
    };
    reader.onerror = () => setError('画像の読み込みに失敗しました');
    reader.readAsDataURL(file);
  };

  const loadSurveys = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await surveysApi.listProjectSurveys(projectId);
      const list = response.surveys.map((survey) => ({
        ...survey,
        responseCount: survey._count?.responses ?? 0,
      }));
      setSurveys(list);
      if (list.length > 0 && !selectedSurvey) {
        setSelectedSurvey(list[0]);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'アンケートの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const loadSurveyDetail = async (surveyId: string) => {
    try {
      const response = await surveysApi.getSurvey(surveyId);
      setSelectedSurvey(response.survey);
    } catch (err: any) {
      setError(err.response?.data?.error || 'アンケートの取得に失敗しました');
    }
  };

  const loadAnalytics = async (surveyId: string) => {
    try {
      const response = await surveysApi.getSurveyAnalytics(surveyId);
      setAnalytics(response);
    } catch (err: any) {
      setError(err.response?.data?.error || '集計の取得に失敗しました');
    }
  };

  useEffect(() => {
    if (isOpen && projectId) {
      loadSurveys();
    }
  }, [isOpen, projectId]);

  useEffect(() => {
    if (selectedSurvey?.id) {
      loadSurveyDetail(selectedSurvey.id);
      loadAnalytics(selectedSurvey.id);
    } else {
      setAnalytics(null);
    }
  }, [selectedSurvey?.id]);

  useEffect(() => {
    if (!selectedSurvey) {
      setEditDescription('');
      setEditImageUrl('');
      return;
    }
    setEditDescription(selectedSurvey.description ?? '');
    setEditImageUrl(selectedSurvey.publicImageUrl ?? '');
  }, [selectedSurvey?.id]);

  useEffect(() => {
    if (!isOpen || !surveyResponseEvent) return;
    if (surveyResponseEvent.projectId !== projectId) return;

    let matched = false;
    setSurveys((prev) =>
      prev.map((survey) => {
        if (survey.id !== surveyResponseEvent.surveyId) return survey;
        matched = true;
        const currentCount = survey.responseCount ?? 0;
        return {
          ...survey,
          responseCount: currentCount + 1,
        };
      })
    );
    if (!matched) {
      loadSurveys();
    }
    if (selectedSurvey?.id === surveyResponseEvent.surveyId) {
      loadAnalytics(selectedSurvey.id);
    }
  }, [surveyResponseEvent?.receivedAt, isOpen, projectId, selectedSurvey?.id]);

  useEffect(() => {
    if (!isOpen || !selectedSurvey?.id) return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await surveysApi.getSurveyAnalytics(selectedSurvey.id);
        if (active) {
          setAnalytics(response);
        }
      } catch (err: any) {
        if (active) {
          setError(err.response?.data?.error || '集計の取得に失敗しました');
        }
      }
    };

    const intervalId = window.setInterval(refresh, 5000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [isOpen, selectedSurvey?.id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!canEdit) return;

    setIsCreating(true);
    setError(null);
    try {
      const snapshot = exportProjectData();
      const response = await surveysApi.createSurvey(projectId, {
        title: title.trim(),
        description: description.trim() || undefined,
        diagramId: currentDiagramDbId || undefined,
        gsnSnapshot: snapshot,
      });
      setShowCreate(false);
      setTitle('');
      setDescription('');
      await loadSurveys();
      setSelectedSurvey(response.survey);
    } catch (err: any) {
      setError(err.response?.data?.error || 'アンケートの作成に失敗しました');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSaveIntro = async () => {
    if (!selectedSurvey || !canEdit) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await surveysApi.updateSurvey(selectedSurvey.id, {
        description: editDescription.trim() || null,
        publicImageUrl: editImageUrl.trim() || null,
      });
      setSelectedSurvey(response.survey);
      await loadSurveys();
    } catch (err: any) {
      setError(err.response?.data?.error || '説明の更新に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    readImageFile(file, (dataUrl) => setEditImageUrl(dataUrl));
    event.target.value = '';
  };

  const handlePublish = async () => {
    if (!selectedSurvey || !canEdit) return;
    try {
      const response = await surveysApi.publishSurvey(selectedSurvey.id);
      setSelectedSurvey(response.survey);
      await loadSurveys();
    } catch (err: any) {
      setError(err.response?.data?.error || '公開に失敗しました');
    }
  };

  const handleCloseSurvey = async () => {
    if (!selectedSurvey || !canEdit) return;
    try {
      const response = await surveysApi.closeSurvey(selectedSurvey.id);
      setSelectedSurvey(response.survey);
      await loadSurveys();
    } catch (err: any) {
      setError(err.response?.data?.error || '終了に失敗しました');
    }
  };

  const handleCopyUrl = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
    } catch (err) {
      setError('URLのコピーに失敗しました');
    }
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
          borderRadius: '10px',
          width: '900px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 6px 24px rgba(0, 0, 0, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
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
            アンケート管理
          </h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {canEdit && (
              <button
                onClick={() => setShowCreate(true)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  border: '1px solid #3B82F6',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: '#EFF6FF',
                  color: '#2563EB',
                }}
              >
                ＋ 新規作成
              </button>
            )}
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
        </div>

        {error && <div style={{ padding: '0 20px' }}><ErrorState message={error} /></div>}

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div
            style={{
              width: '320px',
              borderRight: '1px solid #E5E7EB',
              overflowY: 'auto',
            }}
          >
            {loading ? (
              <LoadingState />
            ) : surveys.length === 0 ? (
              <div style={{ padding: '16px', color: '#6B7280' }}>
                まだアンケートがありません。
              </div>
            ) : (
              surveys.map((survey) => (
                <div
                  key={survey.id}
                  onClick={() => setSelectedSurvey(survey)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #F3F4F6',
                    cursor: 'pointer',
                    backgroundColor:
                      selectedSurvey?.id === survey.id ? '#EFF6FF' : 'transparent',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{survey.title}</div>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                    {survey.status} · 回答 {survey.responseCount ?? 0} 件
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ flex: 1, padding: '16px 20px', overflowY: 'auto' }}>
            {!selectedSurvey ? (
              <div style={{ color: '#6B7280' }}>アンケートを選択してください。</div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{selectedSurvey.title}</h3>
                    {selectedSurvey.description && (
                      <p style={{ marginTop: '6px', color: '#6B7280' }}>
                        {selectedSurvey.description}
                      </p>
                    )}
                    <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '8px' }}>
                      状態: {selectedSurvey.status}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {canEdit && selectedSurvey.status !== 'published' && (
                      <button
                        onClick={handlePublish}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #3B82F6',
                          borderRadius: '6px',
                          backgroundColor: '#3B82F6',
                          color: '#FFFFFF',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        公開する
                      </button>
                    )}
                    {canEdit && selectedSurvey.status === 'published' && (
                      <button
                        onClick={handleCloseSurvey}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #D97706',
                          borderRadius: '6px',
                          backgroundColor: '#FEF3C7',
                          color: '#92400E',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        公開終了
                      </button>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '16px',
                    padding: '12px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    backgroundColor: '#F9FAFB',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                    回答者向けの説明・画像
                  </div>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={3}
                    placeholder="アンケートの目的や注意事項を記載できます"
                    disabled={!canEdit}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #D1D5DB',
                      borderRadius: '6px',
                      backgroundColor: canEdit ? '#FFFFFF' : '#F3F4F6',
                      marginBottom: '8px',
                    }}
                  />
                  <input
                    value={editImageUrl}
                    onChange={(e) => setEditImageUrl(e.target.value)}
                    placeholder="画像URL または data:image/..."
                    disabled={!canEdit}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #D1D5DB',
                      borderRadius: '6px',
                      backgroundColor: canEdit ? '#FFFFFF' : '#F3F4F6',
                      marginBottom: '8px',
                    }}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEditImageChange}
                    disabled={!canEdit}
                  />
                  {editImageUrl && (
                    <div style={{ marginTop: '8px' }}>
                      <img
                        src={editImageUrl}
                        alt="回答者向け画像"
                        style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '6px' }}
                      />
                    </div>
                  )}
                  {canEdit && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setEditImageUrl('')}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #D1D5DB',
                          borderRadius: '6px',
                          backgroundColor: '#FFFFFF',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        画像をクリア
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveIntro}
                        disabled={!introDirty || isSaving}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #3B82F6',
                          borderRadius: '6px',
                          backgroundColor: !introDirty || isSaving ? '#93C5FD' : '#3B82F6',
                          color: '#FFFFFF',
                          cursor: !introDirty || isSaving ? 'not-allowed' : 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        {isSaving ? '保存中...' : '保存'}
                      </button>
                    </div>
                  )}
                </div>

                {publicUrl && (
                  <div
                    style={{
                      marginTop: '16px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #E5E7EB',
                      backgroundColor: '#F9FAFB',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <span style={{ fontSize: '12px', color: '#374151', wordBreak: 'break-all' }}>
                      {publicUrl}
                    </span>
                    <button
                      onClick={handleCopyUrl}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        backgroundColor: '#FFFFFF',
                        cursor: 'pointer',
                      }}
                    >
                      コピー
                    </button>
                  </div>
                )}

                <div style={{ marginTop: '24px' }}>
                  <h4 style={{ margin: '0 0 8px 0' }}>質問一覧</h4>
                  {selectedSurvey.questions?.length ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedSurvey.questions.map((question) => {
                        const node = nodeMap.get(question.nodeId);
                        const descriptionText = stripHtml(node?.content) || '-';
                        const nodeLabel = node?.label || '-';
                        return (
                        <div
                          key={question.id}
                          style={{
                            padding: '10px 12px',
                            border: '1px solid #E5E7EB',
                            borderRadius: '6px',
                          }}
                        >
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>
                            {question.questionText}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6B7280' }}>
                            {question.nodeType} / {nodeLabel}
                          </div>
                          <div style={{ fontSize: '12px', color: '#374151', marginTop: '4px' }}>
                            説明: {descriptionText}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>
                      質問がありません。
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '24px' }}>
                  <h4 style={{ margin: '0 0 8px 0' }}>集計結果</h4>
                  {!analytics ? (
                    <LoadingState />
                  ) : (
                    <>
                      <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>
                        回答数: {analytics.responseCount}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {analytics.stats.map((stat) => (
                          <div
                            key={stat.questionId}
                            style={{
                              padding: '10px 12px',
                              border: '1px solid #E5E7EB',
                              borderRadius: '6px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div style={{ fontSize: '12px', color: '#374151' }}>
                              {stat.nodeType} / {stat.nodeId}
                            </div>
                            <div style={{ fontSize: '12px', color: '#111827' }}>
                              平均: {stat.averageScore ?? '-'} ({stat.count}件)
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showCreate && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
          }}
          onClick={() => setShowCreate(false)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              width: '420px',
              padding: '20px',
              boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>アンケート作成</h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                  タイトル
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                  }}
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                  説明（回答者向け）
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    backgroundColor: '#FFFFFF',
                    cursor: 'pointer',
                  }}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #3B82F6',
                    borderRadius: '6px',
                    backgroundColor: '#3B82F6',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                  }}
                >
                  {isCreating ? '作成中...' : '作成'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
