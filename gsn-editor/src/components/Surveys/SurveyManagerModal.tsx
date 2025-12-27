import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  surveysApi,
  type Survey,
  type SurveyAnalytics,
  type SurveyQuestion,
  type SurveyResponsesResponse,
  type SurveyAudience,
  type SurveyMode,
} from '../../api/surveys';
import type { DiagramData, ProjectData, Node as DiagramNode, Link as DiagramLink } from '../../types/diagram';
import { LoadingState } from '../Status/LoadingState';
import { ErrorState } from '../Status/ErrorState';
import { useDiagramStore } from '../../stores/diagramStore';

interface SurveyManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

const DEFAULT_EXPERT_INTRO = `現状のシステムの安全性を、厳密に測定するための質問です。議論の基盤になるGSNの末端のゴールノードと戦略ノードについて専門家の立場から回答をお願いいたします。

それぞれの質問では0から1点の値(確信値)を入力していただきます。以下の基準で回答してください。0と1は使用しないでください。
0.98 ほぼ標準・教科書どおり。抜けや疑問点はほとんどない
0.90 概ね妥当。多少気になる点はあるが実務上は許容
0.80 妥当だが弱点あり。前提依存・カバレッジ不足が気になる
0.70  かなり弱い。重要な前提の抜けや想定外シナリオの懸念
0.40. 根本的に疑問。議論・エビデンスの組み直しレベル
またその採点の理由もできるだけ詳細に記入をお願いいたします。`;

const ROLE_OPTIONS = [
  'アーキテクト',
  'フェロー',
  '事業本部',
  'プロダクト本部',
  'R&Dユニット',
  '経営層（CxO）',
  'その他',
];

const isRoleQuestion = (question: SurveyQuestion) =>
  question.nodeId === 'meta_role' && question.nodeType === 'Meta';

type GsnSnapshot = ProjectData | DiagramData;
type DiagramSnapshot = Pick<DiagramData, 'nodes' | 'links'>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isDiagramData = (value: unknown): value is DiagramData =>
  isRecord(value) && Array.isArray(value.nodes) && Array.isArray(value.links);

const isProjectData = (value: unknown): value is ProjectData =>
  isRecord(value) && isRecord(value.modules);

const normalizeSnapshot = (value: unknown): GsnSnapshot | null => {
  if (isProjectData(value)) return value;
  if (isDiagramData(value)) return value;
  return null;
};

const getApiErrorMessage = (err: unknown, fallback: string) => {
  if (err && typeof err === 'object') {
    const response = (err as { response?: { data?: { error?: string } } }).response;
    if (typeof response?.data?.error === 'string') {
      return response.data.error;
    }
  }
  if (err instanceof Error) return err.message;
  return fallback;
};

const calculateSampleVariance = (values: number[]) => {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
};

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
  const [mode, setMode] = useState<SurveyMode>('single');
  const [isCreating, setIsCreating] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editExpertIntro, setEditExpertIntro] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [consensusScore, setConsensusScore] = useState<number | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<{ mean: number; variance: number } | null>(null);
  const [isConsensusLoading, setIsConsensusLoading] = useState(false);
  const [consensusByNode, setConsensusByNode] = useState<Map<string, number | null>>(new Map());
  const [confidenceByNode, setConfidenceByNode] = useState<
    Map<string, { mean: number; variance: number } | null>
  >(new Map());
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const publicUrls = useMemo(() => {
    if (!selectedSurvey) {
      return { general: null, expert: null, single: null };
    }
    const origin = window.location.origin;
    const general = selectedSurvey.publicToken
      ? `${origin}/survey/${selectedSurvey.publicToken}`
      : null;
    const expert = selectedSurvey.publicTokenExpert
      ? `${origin}/survey/${selectedSurvey.publicTokenExpert}`
      : null;
    const single = selectedSurvey.mode === 'combined' ? null : general;
    return { general, expert, single };
  }, [selectedSurvey]);

  const introDirty = useMemo(() => {
    if (!selectedSurvey) return false;
    const currentDescription = selectedSurvey.description ?? '';
    const currentImage = selectedSurvey.publicImageUrl ?? '';
    const hasExpertIntro = selectedSurvey.mode === 'combined' || selectedSurvey.audience === 'expert';
    const currentExpertIntro = hasExpertIntro
      ? selectedSurvey.expertIntro ?? DEFAULT_EXPERT_INTRO
      : '';
    return (
      editDescription !== currentDescription ||
      editImageUrl !== currentImage ||
      editExpertIntro !== currentExpertIntro
    );
  }, [editDescription, editImageUrl, editExpertIntro, selectedSurvey]);

  const nodeMap = useMemo(() => {
    const snapshot = normalizeSnapshot(selectedSurvey?.gsnSnapshot);
    if (!snapshot) return new Map<string, DiagramNode>();
    const modules = isProjectData(snapshot) ? snapshot.modules : { root: snapshot };
    const allNodes = Object.values(modules)
      .flatMap((module) => (Array.isArray(module.nodes) ? module.nodes : []));
    return new Map(allNodes.map((node) => [String(node.id), node]));
  }, [selectedSurvey?.gsnSnapshot]);

  const diagramData = useMemo<DiagramSnapshot | null>(() => {
    const snapshot = normalizeSnapshot(selectedSurvey?.gsnSnapshot);
    if (!snapshot) return null;
    if (isProjectData(snapshot)) {
      const currentId = snapshot.currentDiagramId || 'root';
      const moduleData = snapshot.modules[currentId] || snapshot.modules.root || null;
      if (!moduleData) return null;
      return {
        nodes: Array.isArray(moduleData.nodes) ? moduleData.nodes : [],
        links: Array.isArray(moduleData.links) ? moduleData.links : [],
      };
    }
    return {
      nodes: Array.isArray(snapshot.nodes) ? snapshot.nodes : [],
      links: Array.isArray(snapshot.links) ? snapshot.links : [],
    };
  }, [selectedSurvey?.gsnSnapshot]);

  const consensusNodes = useMemo(() => {
    if (!diagramData) return [];
    return diagramData.nodes.filter((node) => node.type === 'Goal' || node.type === 'Strategy');
  }, [diagramData]);

  const stripHtml = (html?: string) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
  };

  const computeConsensusAndConfidence = useCallback(async (
    combinedSurveyId: string | null,
    generalSurveyId: string | null,
    expertSurveyId: string | null
  ) => {
    if (!diagramData) {
      setConsensusScore(null);
      setConfidenceScore(null);
      setConsensusByNode(new Map());
      setConfidenceByNode(new Map());
      return;
    }

    setIsConsensusLoading(true);
    try {
      const responsesList: SurveyResponsesResponse[] = [];
      const expertResponsesList: SurveyResponsesResponse[] = [];
      if (combinedSurveyId) {
        const combinedResponses = await surveysApi.getSurveyResponses(combinedSurveyId);
        responsesList.push(combinedResponses);
        expertResponsesList.push(combinedResponses);
      } else {
        if (generalSurveyId) {
          responsesList.push(await surveysApi.getSurveyResponses(generalSurveyId));
        }
        if (expertSurveyId) {
          const expertResponses = await surveysApi.getSurveyResponses(expertSurveyId);
          responsesList.push(expertResponses);
          expertResponsesList.push(expertResponses);
        }
      }

      const nodesById = new Map<string, DiagramNode>(
        diagramData.nodes.map((node) => [String(node.id), node])
      );
      const childrenById = new Map<string, string[]>();
      const incoming = new Set<string>();
      diagramData.links.forEach((link: DiagramLink) => {
        const source = String(link.source);
        const target = String(link.target);
        const list = childrenById.get(source) || [];
        list.push(target);
        childrenById.set(source, list);
        incoming.add(target);
      });

      const normalizedScores = new Map<string, number[]>();
      responsesList.forEach((responses) => {
        const questionMap = new Map(responses.questions.map((question) => [question.id, question]));
        responses.responses.forEach((response) => {
          response.answers.forEach((answer) => {
            const question = questionMap.get(answer.questionId);
            if (!question) return;
            const scaleType = question.scaleType || 'likert_0_3';
            const max =
              typeof question.scaleMax === 'number'
                ? question.scaleMax
                : scaleType === 'continuous_0_1'
                  ? 1
                  : 3;
            if (max === 0) return;
            const normalized =
              scaleType === 'continuous_0_1' ? answer.score : answer.score / max;
            const nodeId = String(question.nodeId);
            const list = normalizedScores.get(nodeId) || [];
            list.push(normalized);
            normalizedScores.set(nodeId, list);
          });
        });
      });

      const avgRatings = new Map<string, number>();
      normalizedScores.forEach((scores, nodeId) => {
        const total = scores.reduce((sum, score) => sum + score, 0);
        avgRatings.set(nodeId, total / scores.length);
      });

      const consensusMemo = new Map<string, number | null>();
      const consensusByNodeMap = new Map<string, number | null>();
      const calcGoalConsensus = (goalId: string, trail: Set<string>): number | null => {
        if (consensusMemo.has(goalId)) return consensusMemo.get(goalId) ?? null;
        if (trail.has(goalId)) return null;
        const node = nodesById.get(goalId);
        if (!node || node.type !== 'Goal') return null;
        const avg = avgRatings.get(goalId);
        if (typeof avg !== 'number') return null;
        const nextTrail = new Set(trail);
        nextTrail.add(goalId);

        const A = avg;
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
          const B = strategyAvg;
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

      nodesById.forEach((node, nodeId) => {
        if (node.type !== 'Strategy') return;
        consensusByNodeMap.set(nodeId, avgRatings.get(nodeId) ?? null);
      });

      const goalIds: string[] = diagramData.nodes
        .filter((node) => node.type === 'Goal')
        .map((node) => String(node.id));

      goalIds.forEach((goalId) => {
        consensusByNodeMap.set(goalId, calcGoalConsensus(goalId, new Set()));
      });

      const rootGoals: string[] = goalIds.filter((nodeId: string) => !incoming.has(nodeId));

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
      const confidenceByNodeMap = new Map<string, { mean: number; variance: number } | null>();
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

      nodesById.forEach((node, nodeId) => {
        if (node?.type !== 'Strategy') return;
        confidenceByNodeMap.set(nodeId, expertStats.get(nodeId) ?? null);
      });

      goalIds.forEach((goalId) => {
        confidenceByNodeMap.set(goalId, calcGoalConfidence(goalId, new Set()));
      });

      setConsensusByNode(consensusByNodeMap);
      setConfidenceByNode(confidenceByNodeMap);
    } finally {
      setIsConsensusLoading(false);
    }
  }, [diagramData]);

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

  const loadSurveys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await surveysApi.listProjectSurveys(projectId);
      const list = response.surveys.map((survey) => ({
        ...survey,
        responseCount: survey._count?.responses ?? 0,
      }));
      setSurveys(list);
      setSelectedSurvey((prev) => (prev ? prev : list[0] ?? null));
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'アンケートの読み込みに失敗しました'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadSurveyDetail = useCallback(async (surveyId: string) => {
    try {
      const response = await surveysApi.getSurvey(surveyId);
      setSelectedSurvey(response.survey);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'アンケートの取得に失敗しました'));
    }
  }, []);

  const loadAnalytics = useCallback(async (surveyId: string) => {
    try {
      const response = await surveysApi.getSurveyAnalytics(surveyId);
      setAnalytics(response);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '集計の取得に失敗しました'));
    }
  }, []);

  useEffect(() => {
    if (isOpen && projectId) {
      loadSurveys();
    }
  }, [isOpen, projectId, loadSurveys]);

  useEffect(() => {
    if (selectedSurvey?.id) {
      loadSurveyDetail(selectedSurvey.id);
      loadAnalytics(selectedSurvey.id);
    } else {
      setAnalytics(null);
    }
  }, [selectedSurvey?.id, loadSurveyDetail, loadAnalytics]);

  useEffect(() => {
    if (!selectedSurvey) {
      setEditDescription('');
      setEditImageUrl('');
      setEditExpertIntro('');
      return;
    }
    const hasExpertIntro = selectedSurvey.mode === 'combined' || selectedSurvey.audience === 'expert';
    setEditDescription(selectedSurvey.description ?? '');
    setEditImageUrl(selectedSurvey.publicImageUrl ?? '');
    setEditExpertIntro(hasExpertIntro ? selectedSurvey.expertIntro ?? DEFAULT_EXPERT_INTRO : '');
  }, [selectedSurvey]);

  useEffect(() => {
    if (!isOpen || !selectedSurvey || !diagramData) {
      setConsensusScore(null);
      setConfidenceScore(null);
      setConsensusByNode(new Map());
      setConfidenceByNode(new Map());
      setIsConsensusLoading(false);
      return;
    }

    const targetDiagramId = selectedSurvey.diagramId ?? null;
    const isCombined = selectedSurvey.mode === 'combined';
    const combinedSurveyId = isCombined ? selectedSurvey.id : null;
    const generalSurvey = isCombined
      ? null
      : selectedSurvey.audience === 'expert'
        ? surveys.find(
            (survey) => survey.audience !== 'expert' && (survey.diagramId ?? null) === targetDiagramId
          )
        : selectedSurvey;
    const expertSurvey = isCombined
      ? null
      : selectedSurvey.audience === 'expert'
        ? selectedSurvey
        : surveys.find(
            (survey) => survey.audience === 'expert' && (survey.diagramId ?? null) === targetDiagramId
          );

    if (!combinedSurveyId && !generalSurvey && !expertSurvey) {
      setConsensusScore(null);
      setConfidenceScore(null);
      setConsensusByNode(new Map());
      setConfidenceByNode(new Map());
      setIsConsensusLoading(false);
      return;
    }

    let canceled = false;
    const run = async () => {
      try {
        await computeConsensusAndConfidence(
          combinedSurveyId,
          generalSurvey?.id || null,
          expertSurvey?.id || null
        );
      } catch (err: unknown) {
        if (!canceled) {
          setError(getApiErrorMessage(err, '合意形成点の計算に失敗しました'));
          setConsensusScore(null);
          setConfidenceScore(null);
          setConsensusByNode(new Map());
          setConfidenceByNode(new Map());
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
    selectedSurvey,
    diagramData,
    surveys,
    surveyResponseEvent?.receivedAt,
    computeConsensusAndConfidence,
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
  }, [surveyResponseEvent, isOpen, projectId, selectedSurvey, loadSurveys, loadAnalytics]);

  useEffect(() => {
    if (!isOpen || !selectedSurvey?.id) return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await surveysApi.getSurveyAnalytics(selectedSurvey.id);
        if (active) {
          setAnalytics(response);
        }
      } catch (err: unknown) {
        if (active) {
          setError(getApiErrorMessage(err, '集計の取得に失敗しました'));
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
        mode,
      });
      setShowCreate(false);
      setTitle('');
      setDescription('');
      setAudience('general');
      setMode('single');
      await loadSurveys();
      setSelectedSurvey(response.survey);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'アンケートの作成に失敗しました'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleSaveIntro = async () => {
    if (!selectedSurvey || !canEdit) return;
    setIsSaving(true);
    setError(null);
    try {
      const hasExpertIntro = selectedSurvey.mode === 'combined' || selectedSurvey.audience === 'expert';
      const payload = {
        description: editDescription.trim() || null,
        publicImageUrl: editImageUrl.trim() || null,
        ...(hasExpertIntro ? { expertIntro: editExpertIntro.trim() || null } : {}),
      };
      const response = await surveysApi.updateSurvey(selectedSurvey.id, payload);
      setSelectedSurvey(response.survey);
      await loadSurveys();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '説明の更新に失敗しました'));
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
          'responseAudience',
          'questionOrder',
          'questionId',
          'questionAudience',
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
          const roleQuestion = question ? isRoleQuestion(question) : false;
          const node = question ? nodeMap.get(question.nodeId) : undefined;
          const nodeLabel = roleQuestion ? '役職(所属)' : node?.label || question?.nodeId || '';
          const nodeText = roleQuestion ? ROLE_OPTIONS.join(' / ') : stripHtml(node?.content) || '';
          rows.push([
            responseEntry.id,
            responseEntry.submittedAt,
            responseEntry.respondentHash || '',
            responseEntry.audience || '',
            question?.order ?? '',
            answer.questionId,
            question?.audience ?? '',
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
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'CSVの出力に失敗しました'));
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
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '公開に失敗しました'));
    }
  };

  const handleCloseSurvey = async () => {
    if (!selectedSurvey || !canEdit) return;
    try {
      const response = await surveysApi.closeSurvey(selectedSurvey.id);
      setSelectedSurvey(response.survey);
      await loadSurveys();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '終了に失敗しました'));
    }
  };

  const handleCopyUrl = async (url: string | null) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
    } catch {
      setError('URLのコピーに失敗しました');
    }
  };

  useEffect(() => {
    if (!copiedUrl) return;
    const timeoutId = window.setTimeout(() => {
      setCopiedUrl(null);
    }, 1500);
    return () => window.clearTimeout(timeoutId);
  }, [copiedUrl]);

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
                    {survey.status} · {survey.mode === 'combined'
                      ? '統合'
                      : survey.audience === 'expert'
                        ? '専門家'
                        : '非専門家'} · 回答 {survey.responseCount ?? 0} 件
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
                      状態: {selectedSurvey.status} ・ 対象: {selectedSurvey.mode === 'combined'
                        ? '統合'
                        : selectedSurvey.audience === 'expert'
                          ? '専門家'
                          : '非専門家'}
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
                  {(selectedSurvey.mode === 'combined' || selectedSurvey.audience === 'expert') && (
                    <>
                      <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                        専門家向け Confidence 説明
                      </div>
                      <textarea
                        value={editExpertIntro}
                        onChange={(e) => setEditExpertIntro(e.target.value)}
                        rows={8}
                        placeholder="専門家向けのConfidence説明文"
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
                      <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '8px' }}>
                        未入力の場合は既定の説明文が表示されます
                      </div>
                    </>
                  )}
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

                {publicUrls.single && (
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
                      {publicUrls.single}
                    </span>
                    <button
                      onClick={() => handleCopyUrl(publicUrls.single)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        border: copiedUrl === publicUrls.single ? '1px solid #16A34A' : '1px solid #D1D5DB',
                        borderRadius: '6px',
                        backgroundColor: copiedUrl === publicUrls.single ? '#DCFCE7' : '#FFFFFF',
                        color: copiedUrl === publicUrls.single ? '#166534' : '#111827',
                        cursor: 'pointer',
                      }}
                    >
                      {copiedUrl === publicUrls.single ? 'コピー済み' : 'コピー'}
                    </button>
                  </div>
                )}
                {selectedSurvey.mode === 'combined' &&
                  (publicUrls.general || publicUrls.expert) && (
                    <div
                      style={{
                        marginTop: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      {publicUrls.general && (
                        <div
                          style={{
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
                          <span
                            style={{
                              fontSize: '12px',
                              color: '#374151',
                              wordBreak: 'break-all',
                            }}
                          >
                            非専門家用: {publicUrls.general}
                          </span>
                          <button
                            onClick={() => handleCopyUrl(publicUrls.general)}
                            style={{
                              padding: '4px 8px',
                              fontSize: '12px',
                              border: copiedUrl === publicUrls.general ? '1px solid #16A34A' : '1px solid #D1D5DB',
                              borderRadius: '6px',
                              backgroundColor: copiedUrl === publicUrls.general ? '#DCFCE7' : '#FFFFFF',
                              color: copiedUrl === publicUrls.general ? '#166534' : '#111827',
                              cursor: 'pointer',
                            }}
                          >
                            {copiedUrl === publicUrls.general ? 'コピー済み' : 'コピー'}
                          </button>
                        </div>
                      )}
                      {publicUrls.expert && (
                        <div
                          style={{
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
                          <span
                            style={{
                              fontSize: '12px',
                              color: '#374151',
                              wordBreak: 'break-all',
                            }}
                          >
                            専門家用: {publicUrls.expert}
                          </span>
                          <button
                            onClick={() => handleCopyUrl(publicUrls.expert)}
                            style={{
                              padding: '4px 8px',
                              fontSize: '12px',
                              border: copiedUrl === publicUrls.expert ? '1px solid #16A34A' : '1px solid #D1D5DB',
                              borderRadius: '6px',
                              backgroundColor: copiedUrl === publicUrls.expert ? '#DCFCE7' : '#FFFFFF',
                              color: copiedUrl === publicUrls.expert ? '#166534' : '#111827',
                              cursor: 'pointer',
                            }}
                          >
                            {copiedUrl === publicUrls.expert ? 'コピー済み' : 'コピー'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                <div style={{ marginTop: '24px' }}>
                  <h4 style={{ margin: '0 0 8px 0' }}>質問一覧</h4>
                  {selectedSurvey.questions?.length ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedSurvey.questions.map((question) => {
                        const roleQuestion = isRoleQuestion(question);
                        const node = nodeMap.get(question.nodeId);
                        const descriptionText = stripHtml(node?.content) || '-';
                        const nodeLabel = node?.label || '-';
                        const audienceLabel =
                          question.audience === 'expert' ? '専門家' : '非専門家';
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
                          {roleQuestion ? (
                            <>
                              <div style={{ fontSize: '12px', color: '#6B7280' }}>
                                形式: 役職選択
                                {question.audience ? ` ・ ${audienceLabel}` : ''}
                              </div>
                              <div style={{ fontSize: '12px', color: '#374151', marginTop: '4px' }}>
                                選択肢: {ROLE_OPTIONS.join(' / ')}
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={{ fontSize: '12px', color: '#6B7280' }}>
                                ID: {nodeLabel} / {question.nodeType}
                                {question.audience ? ` ・ ${audienceLabel}` : ''}
                              </div>
                              <div style={{ fontSize: '12px', color: '#374151', marginTop: '4px' }}>
                                文: {descriptionText}
                              </div>
                            </>
                          )}
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
                      <div style={{ marginTop: '16px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                          ノード別 合意形成/Confidence
                        </div>
                        {consensusNodes.length === 0 ? (
                          <div style={{ fontSize: '12px', color: '#6B7280' }}>
                            表示できるノードがありません。
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {consensusNodes.map((node: DiagramNode) => {
                              const nodeId = String(node.id);
                              const nodeLabel = nodeMap.get(nodeId)?.label || nodeId;
                              const consensusValue = consensusByNode.get(nodeId);
                              const confidenceValue = confidenceByNode.get(nodeId);
                              const consensusText = isConsensusLoading
                                ? '...'
                                : consensusValue === null || consensusValue === undefined
                                  ? '-'
                                  : `${(consensusValue * 100).toFixed(2)}%`;
                              const confidenceText = isConsensusLoading
                                ? '...'
                                : confidenceValue
                                  ? `${(confidenceValue.mean * 100).toFixed(2)}%`
                                  : '-';
                              const varianceText =
                                !isConsensusLoading && confidenceValue
                                  ? `σ²=${confidenceValue.variance.toFixed(4)}`
                                  : '';
                              return (
                                <div
                                  key={`consensus-${nodeId}`}
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
                                    {node.type}/{nodeLabel}
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#111827' }}>
                                    合意形成: {consensusText} ・ Confidence: {confidenceText}
                                    {varianceText ? ` (${varianceText})` : ''}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {analytics.stats.map((stat) => {
                          const node = nodeMap.get(stat.nodeId);
                          const roleStat = stat.nodeId === 'meta_role' && stat.nodeType === 'Meta';
                          const nodeLabel = roleStat ? '役職(所属)' : node?.label || stat.nodeId;
                          const audienceLabel =
                            stat.audience === 'expert' ? '専門家' : '非専門家';
                          const averageText =
                            stat.averageScore === null ? '-' : stat.averageScore.toFixed(2);
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
                                {stat.audience ? ` ・ ${audienceLabel}` : ''}
                              </div>
                              <div style={{ fontSize: '12px', color: '#111827' }}>
                                {roleStat
                                  ? `回答: ${stat.count}件`
                                  : `平均: ${averageText} (${stat.count}件)`}
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
                  形式
                </label>
                <select
                  value={mode}
                  onChange={(e) => {
                    const nextMode = e.target.value as SurveyMode;
                    setMode(nextMode);
                    if (nextMode === 'combined') {
                      setAudience('general');
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                  }}
                >
                  <option value="single">単独（1つの対象）</option>
                  <option value="combined">統合（非専門家 + 専門家）</option>
                </select>
              </div>
              {mode === 'single' ? (
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
              ) : (
                <div style={{ marginBottom: '12px', fontSize: '11px', color: '#6B7280' }}>
                  統合アンケートは非専門家（0〜3）と専門家（0〜1/0〜3）の質問を同一IDに作成します。
                </div>
              )}
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
