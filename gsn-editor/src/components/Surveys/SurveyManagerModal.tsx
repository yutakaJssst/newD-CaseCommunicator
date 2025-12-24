import React, { useEffect, useMemo, useState } from 'react';
import {
  surveysApi,
  type Survey,
  type SurveyAnalytics,
  type SurveyQuestion,
  type SurveyResponsesResponse,
  type SurveyAudience,
} from '../../api/surveys';
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
  const [audience, setAudience] = useState<SurveyAudience>('general');
  const [isCreating, setIsCreating] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [consensusScore, setConsensusScore] = useState<number | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<{ mean: number; variance: number } | null>(null);
  const [isConsensusLoading, setIsConsensusLoading] = useState(false);

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

  const diagramData = useMemo(() => {
    const snapshot = selectedSurvey?.gsnSnapshot as any;
    if (!snapshot || typeof snapshot !== 'object') return null;
    const currentId = snapshot.currentDiagramId || 'root';
    const modules = snapshot.modules && typeof snapshot.modules === 'object'
      ? snapshot.modules
      : { root: snapshot };
    const moduleData = modules[currentId] || modules.root || null;
    if (!moduleData) return null;
    return {
      nodes: Array.isArray(moduleData.nodes) ? moduleData.nodes : [],
      links: Array.isArray(moduleData.links) ? moduleData.links : [],
    };
  }, [selectedSurvey?.gsnSnapshot]);

  const stripHtml = (html?: string) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
  };

  const calculateSampleVariance = (values: number[]) => {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  };

  const computeConsensusAndConfidence = async (
    generalSurveyId: string | null,
    expertSurveyId: string | null
  ) => {
    if (!diagramData) {
      setConsensusScore(null);
      setConfidenceScore(null);
      return;
    }

    setIsConsensusLoading(true);
    try {
      const responsesList: SurveyResponsesResponse[] = [];
      const expertResponsesList: SurveyResponsesResponse[] = [];
      if (generalSurveyId) {
        responsesList.push(await surveysApi.getSurveyResponses(generalSurveyId));
      }
      if (expertSurveyId) {
        const expertResponses = await surveysApi.getSurveyResponses(expertSurveyId);
        responsesList.push(expertResponses);
        expertResponsesList.push(expertResponses);
      }

      const nodesById = new Map<string, any>(
        diagramData.nodes.map((node: any) => [String(node.id), node])
      );
      const childrenById = new Map<string, string[]>();
      const incoming = new Set<string>();
      diagramData.links.forEach((link: any) => {
        const source = String(link.source);
        const target = String(link.target);
        const list = childrenById.get(source) || [];
        list.push(target);
        childrenById.set(source, list);
        incoming.add(target);
      });

      const likertScores = new Map<string, number[]>();
      responsesList.forEach((responses) => {
        const questionMap = new Map(responses.questions.map((question) => [question.id, question]));
        responses.responses.forEach((response) => {
          response.answers.forEach((answer) => {
            const question = questionMap.get(answer.questionId);
            if (!question || (question.scaleType || 'likert_0_3') !== 'likert_0_3') return;
            const nodeId = String(question.nodeId);
            const list = likertScores.get(nodeId) || [];
            list.push(answer.score);
            likertScores.set(nodeId, list);
          });
        });
      });

      const avgRatings = new Map<string, number>();
      likertScores.forEach((scores, nodeId) => {
        const total = scores.reduce((sum, score) => sum + score, 0);
        avgRatings.set(nodeId, total / scores.length);
      });

      const consensusMemo = new Map<string, number | null>();
      const calcGoalConsensus = (goalId: string, trail: Set<string>): number | null => {
        if (consensusMemo.has(goalId)) return consensusMemo.get(goalId) ?? null;
        if (trail.has(goalId)) return null;
        const node = nodesById.get(goalId);
        if (!node || node.type !== 'Goal') return null;
        const avg = avgRatings.get(goalId);
        if (typeof avg !== 'number') return null;
        const nextTrail = new Set(trail);
        nextTrail.add(goalId);

        const A = avg / 3;
        const strategyIds = (childrenById.get(goalId) || [])
          .filter((childId) => nodesById.get(childId)?.type === 'Strategy');
        if (strategyIds.length === 0) {
          consensusMemo.set(goalId, A);
          return A;
        }

        const bottomValues: number[] = [];
        strategyIds.forEach((strategyId) => {
          if (nextTrail.has(strategyId)) return;
          const strategyAvg = avgRatings.get(strategyId);
          if (typeof strategyAvg !== 'number') return;
          const B = strategyAvg / 3;
          const subGoals = (childrenById.get(strategyId) || [])
            .filter((childId) => nodesById.get(childId)?.type === 'Goal');
          const subScores = subGoals
            .map((subId) => calcGoalConsensus(subId, new Set([...nextTrail, strategyId])))
            .filter((score): score is number => typeof score === 'number');
          if (subScores.length === 0) return;
          const C = subScores.reduce((sum, value) => sum + value, 0) / subScores.length;
          bottomValues.push(B * C);
        });

        if (bottomValues.length === 0) {
          consensusMemo.set(goalId, A);
          return A;
        }
        const bottom = bottomValues.reduce((sum, value) => sum + value, 0) / bottomValues.length;
        const score = (A + bottom) / 2;
        consensusMemo.set(goalId, score);
        return score;
      };

      const rootGoals: string[] = diagramData.nodes
        .filter((node: any) => node?.type === 'Goal')
        .map((node: any) => String(node.id))
        .filter((nodeId: string) => !incoming.has(nodeId));

      const consensusScores = rootGoals
        .map((goalId: string) => calcGoalConsensus(goalId, new Set()))
        .filter((score): score is number => typeof score === 'number');
      if (consensusScores.length === 0) {
        setConsensusScore(null);
      } else {
        const consensusAvg =
          consensusScores.reduce((sum: number, value: number) => sum + value, 0) / consensusScores.length;
        setConsensusScore(consensusAvg);
      }

      const expertScores = new Map<string, number[]>();
      expertResponsesList.forEach((responses) => {
        const questionMap = new Map(responses.questions.map((question) => [question.id, question]));
        responses.responses.forEach((response) => {
          response.answers.forEach((answer) => {
            const question = questionMap.get(answer.questionId);
            if (!question || (question.scaleType || 'likert_0_3') !== 'continuous_0_1') return;
            const nodeId = String(question.nodeId);
            const list = expertScores.get(nodeId) || [];
            list.push(answer.score);
            expertScores.set(nodeId, list);
          });
        });
      });

      const epsilon = 1e-6;
      const expertStats = new Map<string, { mean: number; variance: number }>();
      expertScores.forEach((scores, nodeId) => {
        const mean = scores.reduce((sum, value) => sum + value, 0) / scores.length;
        const variance = calculateSampleVariance(scores);
        expertStats.set(nodeId, { mean, variance: variance + epsilon });
      });

      const confidenceMemo = new Map<string, { mean: number; variance: number } | null>();
      const calcGoalConfidence = (goalId: string, trail: Set<string>): { mean: number; variance: number } | null => {
        if (confidenceMemo.has(goalId)) return confidenceMemo.get(goalId) ?? null;
        if (trail.has(goalId)) return null;
        const node = nodesById.get(goalId);
        if (!node || node.type !== 'Goal') return null;
        const direct = expertStats.get(goalId);
        const nextTrail = new Set(trail);
        nextTrail.add(goalId);

        const strategyIds = (childrenById.get(goalId) || [])
          .filter((childId) => nodesById.get(childId)?.type === 'Strategy');
        if (strategyIds.length === 0) {
          confidenceMemo.set(goalId, direct ?? null);
          return direct ?? null;
        }

        const candidates: Array<{ mean: number; variance: number }> = [];
        strategyIds.forEach((strategyId) => {
          if (nextTrail.has(strategyId)) return;
          const strategyStats = expertStats.get(strategyId);
          if (!strategyStats) return;
          const subGoals = (childrenById.get(strategyId) || [])
            .filter((childId) => nodesById.get(childId)?.type === 'Goal');
          const subStats = subGoals
            .map((subId) => calcGoalConfidence(subId, new Set([...nextTrail, strategyId])))
            .filter((stats): stats is { mean: number; variance: number } => stats !== null);
          if (subStats.length === 0) return;
          const weightSum = subStats.reduce((sum, stats) => sum + (1 / stats.variance), 0);
          if (weightSum === 0) return;
          const meanE = subStats.reduce((sum, stats) => sum + (1 / stats.variance) * stats.mean, 0) / weightSum;
          const varianceE = 1 / weightSum;
          const meanG = meanE * strategyStats.mean;
          const varianceG =
            meanE ** 2 * strategyStats.variance +
            strategyStats.mean ** 2 * varianceE +
            varianceE * strategyStats.variance;
          candidates.push({ mean: meanG, variance: varianceG });
        });

        if (candidates.length === 0) {
          confidenceMemo.set(goalId, direct ?? null);
          return direct ?? null;
        }
        const mean = candidates.reduce((sum, stats) => sum + stats.mean, 0) / candidates.length;
        const variance = candidates.reduce((sum, stats) => sum + stats.variance, 0) / candidates.length;
        confidenceMemo.set(goalId, { mean, variance });
        return { mean, variance };
      };

      const confidenceScores = rootGoals
        .map((goalId: string) => calcGoalConfidence(goalId, new Set()))
        .filter((stats): stats is { mean: number; variance: number } => stats !== null);

      if (confidenceScores.length === 0) {
        setConfidenceScore(null);
      } else {
        const mean =
          confidenceScores.reduce((sum: number, stats) => sum + stats.mean, 0) / confidenceScores.length;
        const variance =
          confidenceScores.reduce((sum: number, stats) => sum + stats.variance, 0) / confidenceScores.length;
        setConfidenceScore({ mean, variance });
      }
    } finally {
      setIsConsensusLoading(false);
    }
  };

  const escapeCsv = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? '' : String(value);
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
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
    if (!isOpen || !selectedSurvey || !diagramData) {
      setConsensusScore(null);
      setConfidenceScore(null);
      setIsConsensusLoading(false);
      return;
    }

    const targetDiagramId = selectedSurvey.diagramId ?? null;
    const generalSurvey = selectedSurvey.audience === 'expert'
      ? surveys.find(
          (survey) => survey.audience !== 'expert' && (survey.diagramId ?? null) === targetDiagramId
        )
      : selectedSurvey;
    const expertSurvey = selectedSurvey.audience === 'expert'
      ? selectedSurvey
      : surveys.find(
          (survey) => survey.audience === 'expert' && (survey.diagramId ?? null) === targetDiagramId
        );

    if (!generalSurvey && !expertSurvey) {
      setConsensusScore(null);
      setConfidenceScore(null);
      setIsConsensusLoading(false);
      return;
    }

    let canceled = false;
    const run = async () => {
      try {
        await computeConsensusAndConfidence(generalSurvey?.id || null, expertSurvey?.id || null);
      } catch (err: any) {
        if (!canceled) {
          setError(err.response?.data?.error || '合意形成点の計算に失敗しました');
          setConsensusScore(null);
          setConfidenceScore(null);
          setIsConsensusLoading(false);
        }
      }
    };
    run();

    return () => {
      canceled = true;
    };
  }, [
    isOpen,
    selectedSurvey?.id,
    selectedSurvey?.diagramId,
    diagramData,
    surveys,
    surveyResponseEvent?.receivedAt,
  ]);

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
        audience,
      });
      setShowCreate(false);
      setTitle('');
      setDescription('');
      setAudience('general');
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
    if (file.size > 10 * 1024 * 1024) {
      setError('画像は10MBまでです');
      event.target.value = '';
      return;
    }
    readImageFile(file, (dataUrl) => setEditImageUrl(dataUrl));
    event.target.value = '';
  };

  const handleExportCsv = async () => {
    if (!selectedSurvey) return;
    setIsExporting(true);
    setError(null);
    try {
      const response = await surveysApi.getSurveyResponses(selectedSurvey.id);
      const questionMap = new Map<string, SurveyQuestion>(
        response.questions.map((question) => [question.id, question])
      );

      const rows: string[][] = [
        [
          'responseId',
          'submittedAt',
          'respondentHash',
          'questionOrder',
          'questionId',
          'nodeId',
          'nodeType',
          'nodeLabel',
          'nodeText',
          'questionText',
          'score',
          'comment',
        ],
      ];

      response.responses.forEach((responseEntry) => {
        responseEntry.answers.forEach((answer) => {
          const question = questionMap.get(answer.questionId);
          const node = question ? nodeMap.get(question.nodeId) : undefined;
          const nodeLabel = node?.label || question?.nodeId || '';
          const nodeText = stripHtml(node?.content) || '';
          rows.push([
            responseEntry.id,
            responseEntry.submittedAt,
            responseEntry.respondentHash || '',
            question?.order ?? '',
            answer.questionId,
            question?.nodeId ?? '',
            question?.nodeType ?? '',
            nodeLabel,
            nodeText,
            question?.questionText ?? '',
            answer.score,
            answer.comment ?? '',
          ]);
        });
      });

      const csvBody = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
      const csv = `\uFEFF${csvBody}`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeTitle = (selectedSurvey.title || 'survey').replace(/[\\/:*?"<>|]/g, '_');
      link.href = url;
      link.download = `${safeTitle}-results.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error || 'CSVの出力に失敗しました');
    } finally {
      setIsExporting(false);
    }
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
                    {survey.status} · {survey.audience === 'expert' ? '専門家' : '非専門家'} · 回答 {survey.responseCount ?? 0} 件
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
                      状態: {selectedSurvey.status} ・ 対象: {selectedSurvey.audience === 'expert' ? '専門家' : '非専門家'}
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
                  <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>
                    画像は10MBまで
                  </div>
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
                            ID: {nodeLabel} / {question.nodeType}
                          </div>
                          <div style={{ fontSize: '12px', color: '#374151', marginTop: '4px' }}>
                            文: {descriptionText}
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
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                    }}
                  >
                    <h4 style={{ margin: 0 }}>集計結果</h4>
                    <button
                      type="button"
                      onClick={handleExportCsv}
                      disabled={isExporting || !selectedSurvey}
                      style={{
                        padding: '4px 10px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        backgroundColor: isExporting ? '#E5E7EB' : '#FFFFFF',
                        cursor: isExporting ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      {isExporting ? '出力中...' : 'CSV出力'}
                    </button>
                  </div>
                  {!analytics ? (
                    <LoadingState />
                  ) : (
                    <>
                      <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>
                        回答数: {analytics.responseCount}
                      </div>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <div
                          style={{
                            padding: '12px',
                            borderRadius: '10px',
                            border: '1px solid #E5E7EB',
                            backgroundColor: '#F8FAFC',
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: '12px',
                            minWidth: '240px',
                          }}
                        >
                          <div style={{ fontSize: '12px', color: '#6B7280', fontWeight: 600 }}>
                            合意形成点
                          </div>
                          <div style={{ fontSize: '28px', fontWeight: 700, color: '#111827' }}>
                            {isConsensusLoading
                              ? '...'
                              : consensusScore === null
                                ? '-'
                                : `${Math.round(consensusScore * 100)}%`}
                          </div>
                        </div>
                        <div
                          style={{
                            padding: '12px',
                            borderRadius: '10px',
                            border: '1px solid #E5E7EB',
                            backgroundColor: '#F8FAFC',
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: '12px',
                            minWidth: '240px',
                          }}
                        >
                          <div style={{ fontSize: '12px', color: '#6B7280', fontWeight: 600 }}>
                            技術的信頼度
                          </div>
                          <div style={{ fontSize: '28px', fontWeight: 700, color: '#111827' }}>
                            {isConsensusLoading
                              ? '...'
                              : confidenceScore === null
                                ? '-'
                                : `${Math.round(confidenceScore.mean * 100)}%`}
                          </div>
                          {confidenceScore && !isConsensusLoading && (
                            <div style={{ fontSize: '11px', color: '#6B7280' }}>
                              σ²={confidenceScore.variance.toFixed(4)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {analytics.stats.map((stat) => {
                          const node = nodeMap.get(stat.nodeId);
                          const nodeLabel = node?.label || stat.nodeId;
                          return (
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
                                {stat.nodeType}/{nodeLabel}
                              </div>
                              <div style={{ fontSize: '12px', color: '#111827' }}>
                                平均: {stat.averageScore ?? '-'} ({stat.count}件)
                              </div>
                            </div>
                          );
                        })}
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
                  対象
                </label>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as SurveyAudience)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                  }}
                >
                  <option value="general">非専門家（合意形成）</option>
                  <option value="expert">専門家（Confidence）</option>
                </select>
                <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>
                  専門家向けは Strategy/Leaf Goal が0〜1、その他のGoalは0〜3で回答します。
                </div>
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
