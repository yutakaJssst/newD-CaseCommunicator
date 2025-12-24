import { Response } from 'express';
import crypto from 'crypto';
import type { AuthRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';

type SurveyQuestionInput = {
  nodeId: string;
  nodeType: string;
  questionText: string;
  order: number;
  scaleMin?: number;
  scaleMax?: number;
  scaleType?: 'likert_0_3' | 'continuous_0_1';
};

const extractNodesFromSnapshot = (snapshot: any) => {
  if (!snapshot || typeof snapshot !== 'object') return [];
  if (Array.isArray(snapshot.nodes)) {
    return snapshot.nodes;
  }
  if (snapshot.modules && typeof snapshot.modules === 'object') {
    const modules = Object.values(snapshot.modules) as any[];
    return modules.flatMap((module) => (Array.isArray(module?.nodes) ? module.nodes : []));
  }
  return [];
};

const extractLinksFromSnapshot = (snapshot: any) => {
  if (!snapshot || typeof snapshot !== 'object') return [];
  if (Array.isArray(snapshot.links)) {
    return snapshot.links;
  }
  if (snapshot.modules && typeof snapshot.modules === 'object') {
    const modules = Object.values(snapshot.modules) as any[];
    return modules.flatMap((module) => (Array.isArray(module?.links) ? module.links : []));
  }
  return [];
};

const findLeafGoalIds = (nodes: any[], links: any[]) => {
  const nodeMap = new Map(nodes.map((node) => [String(node.id), node]));
  const childrenById = new Map<string, string[]>();
  links.forEach((link) => {
    if (!link) return;
    const source = String(link.source);
    const target = String(link.target);
    const list = childrenById.get(source) || [];
    list.push(target);
    childrenById.set(source, list);
  });

  const goalHasSubgoal = new Set<string>();
  nodes.forEach((node) => {
    if (node?.type !== 'Goal') return;
    const strategyIds = (childrenById.get(String(node.id)) || [])
      .filter((childId) => nodeMap.get(childId)?.type === 'Strategy');
    for (const strategyId of strategyIds) {
      const subGoals = (childrenById.get(strategyId) || [])
        .filter((childId) => nodeMap.get(childId)?.type === 'Goal');
      if (subGoals.length > 0) {
        goalHasSubgoal.add(String(node.id));
        break;
      }
    }
  });

  return new Set(
    nodes
      .filter((node) => node?.type === 'Goal')
      .map((node) => String(node.id))
      .filter((id) => !goalHasSubgoal.has(id))
  );
};

const buildDefaultQuestions = (
  gsnSnapshot: any,
  audience: 'general' | 'expert'
): SurveyQuestionInput[] => {
  const nodes = extractNodesFromSnapshot(gsnSnapshot);
  const links = extractLinksFromSnapshot(gsnSnapshot);
  const targetTypes = new Set(['Goal', 'Strategy']);
  const filtered = nodes.filter((node: any) => targetTypes.has(node.type));
  const leafGoals = findLeafGoalIds(nodes, links);

  return filtered.map((node: any, index: number) => {
    const nodeId = String(node.id);
    const nodeType = String(node.type);
    const isLeafGoal = nodeType === 'Goal' && leafGoals.has(nodeId);
    const isStrategy = nodeType === 'Strategy';
    const useConfidenceScale = audience === 'expert' && (isLeafGoal || isStrategy);
    return {
      nodeId,
      nodeType,
      questionText: `この${node.type}の主張に同意しますか？`,
      order: index + 1,
      scaleMin: useConfidenceScale ? 0 : 0,
      scaleMax: useConfidenceScale ? 1 : 3,
      scaleType: useConfidenceScale ? 'continuous_0_1' : 'likert_0_3',
    };
  });
};

const getProjectForEditor = async (projectId: string, userId: string) => {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { ownerId: userId },
        { members: { some: { userId, role: { in: ['owner', 'editor'] } } } },
      ],
    },
  });
};

const getProjectForViewer = async (projectId: string, userId: string) => {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
      ],
    },
  });
};

export const listProjectSurveys = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { projectId } = req.params;

  if (!userId) {
    res.status(401).json({ error: '認証が必要です' });
    return;
  }

  const project = await getProjectForViewer(projectId, userId);
  if (!project) {
    res.status(404).json({ error: 'プロジェクトが見つからないか、アクセス権限がありません' });
    return;
  }

  const surveys = await prisma.survey.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      publicImageUrl: true,
      status: true,
      publicToken: true,
      createdAt: true,
      updatedAt: true,
      diagramId: true,
      createdById: true,
      _count: { select: { responses: true } },
    },
  });

  res.json({ surveys });
};

export const createSurvey = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { projectId } = req.params;
  const { title, description, diagramId, gsnSnapshot, questions, audience } = req.body;

  if (!userId) {
    res.status(401).json({ error: '認証が必要です' });
    return;
  }

  if (!title || !gsnSnapshot) {
    res.status(400).json({ error: 'title と gsnSnapshot が必要です' });
    return;
  }

  const project = await getProjectForEditor(projectId, userId);
  if (!project) {
    res.status(404).json({ error: 'プロジェクトが見つからないか、編集権限がありません' });
    return;
  }

  if (diagramId) {
    const diagram = await prisma.diagram.findUnique({ where: { id: diagramId } });
    if (!diagram || diagram.projectId !== projectId) {
      res.status(404).json({ error: 'ダイアグラムが見つかりません' });
      return;
    }
  }

  const surveyAudience = audience === 'expert' ? 'expert' : 'general';
  const questionList: SurveyQuestionInput[] = Array.isArray(questions) && questions.length > 0
    ? questions
    : buildDefaultQuestions(gsnSnapshot, surveyAudience);

  const survey = await prisma.survey.create({
    data: {
      projectId,
      diagramId: diagramId || null,
      title,
      description: typeof description === 'string' ? description.trim() || null : null,
      audience: surveyAudience,
      gsnSnapshot,
      createdById: userId,
      questions: {
        create: questionList.map((question) => ({
          nodeId: question.nodeId,
          nodeType: question.nodeType,
          questionText: question.questionText,
          order: question.order,
          scaleMin: question.scaleMin ?? 0,
          scaleMax: question.scaleMax ?? 3,
          scaleType: question.scaleType ?? 'likert_0_3',
        })),
      },
    },
    include: {
      questions: {
        orderBy: { order: 'asc' },
      },
    },
  });

  res.status(201).json({ survey });
};

export const updateSurvey = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { surveyId } = req.params;
  const { description, publicImageUrl } = req.body;

  if (!userId) {
    res.status(401).json({ error: '認証が必要です' });
    return;
  }

  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
  });

  if (!survey) {
    res.status(404).json({ error: 'アンケートが見つかりません' });
    return;
  }

  const project = await getProjectForEditor(survey.projectId, userId);
  if (!project) {
    res.status(403).json({ error: '編集権限がありません' });
    return;
  }

  const data: { description?: string | null; publicImageUrl?: string | null } = {};
  if (typeof description === 'string' || description === null) {
    data.description = typeof description === 'string' ? description.trim() || null : null;
  }
  if (typeof publicImageUrl === 'string' || publicImageUrl === null) {
    data.publicImageUrl =
      typeof publicImageUrl === 'string' ? publicImageUrl.trim() || null : null;
  }

  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: '更新内容がありません' });
    return;
  }

  const updated = await prisma.survey.update({
    where: { id: surveyId },
    data,
    include: {
      questions: { orderBy: { order: 'asc' } },
    },
  });

  res.json({ survey: updated });
};

export const getSurvey = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { surveyId } = req.params;

  if (!userId) {
    res.status(401).json({ error: '認証が必要です' });
    return;
  }

  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: {
      questions: { orderBy: { order: 'asc' } },
      project: { select: { id: true, ownerId: true } },
    },
  });

  if (!survey) {
    res.status(404).json({ error: 'アンケートが見つかりません' });
    return;
  }

  const project = await getProjectForViewer(survey.projectId, userId);
  if (!project) {
    res.status(403).json({ error: 'アクセス権限がありません' });
    return;
  }

  res.json({ survey });
};

export const publishSurvey = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { surveyId } = req.params;

  if (!userId) {
    res.status(401).json({ error: '認証が必要です' });
    return;
  }

  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
  });

  if (!survey) {
    res.status(404).json({ error: 'アンケートが見つかりません' });
    return;
  }

  const project = await getProjectForEditor(survey.projectId, userId);
  if (!project) {
    res.status(403).json({ error: '編集権限がありません' });
    return;
  }

  const publicToken = survey.publicToken || crypto.randomUUID();
  const updated = await prisma.survey.update({
    where: { id: surveyId },
    data: {
      status: 'published',
      publicToken,
    },
  });

  res.json({ survey: updated });
};

export const closeSurvey = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { surveyId } = req.params;

  if (!userId) {
    res.status(401).json({ error: '認証が必要です' });
    return;
  }

  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
  });

  if (!survey) {
    res.status(404).json({ error: 'アンケートが見つかりません' });
    return;
  }

  const project = await getProjectForEditor(survey.projectId, userId);
  if (!project) {
    res.status(403).json({ error: '編集権限がありません' });
    return;
  }

  const updated = await prisma.survey.update({
    where: { id: surveyId },
    data: { status: 'closed' },
  });

  res.json({ survey: updated });
};

export const getSurveyAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { surveyId } = req.params;

  if (!userId) {
    res.status(401).json({ error: '認証が必要です' });
    return;
  }

  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: {
      questions: { orderBy: { order: 'asc' } },
      project: { select: { id: true } },
    },
  });

  if (!survey) {
    res.status(404).json({ error: 'アンケートが見つかりません' });
    return;
  }

  const project = await getProjectForViewer(survey.projectId, userId);
  if (!project) {
    res.status(403).json({ error: 'アクセス権限がありません' });
    return;
  }

  const answers = await prisma.surveyAnswer.findMany({
    where: { question: { surveyId } },
    select: {
      score: true,
      questionId: true,
    },
  });

  const responseCount = await prisma.surveyResponse.count({ where: { surveyId } });

  const stats = survey.questions.map((question) => {
    const related = answers.filter((answer) => answer.questionId === question.id);
    const avg = related.length
      ? related.reduce((sum, answer) => sum + answer.score, 0) / related.length
      : null;
    return {
      questionId: question.id,
      nodeId: question.nodeId,
      nodeType: question.nodeType,
      averageScore: avg,
      count: related.length,
    };
  });

  res.json({
    responseCount,
    stats,
  });
};

export const getSurveyResponses = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { surveyId } = req.params;

  if (!userId) {
    res.status(401).json({ error: '認証が必要です' });
    return;
  }

  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: {
      questions: { orderBy: { order: 'asc' } },
      project: { select: { id: true } },
    },
  });

  if (!survey) {
    res.status(404).json({ error: 'アンケートが見つかりません' });
    return;
  }

  const project = await getProjectForViewer(survey.projectId, userId);
  if (!project) {
    res.status(403).json({ error: 'アクセス権限がありません' });
    return;
  }

  const responses = await prisma.surveyResponse.findMany({
    where: { surveyId },
    orderBy: { submittedAt: 'asc' },
    include: {
      answers: true,
    },
  });

  res.json({
    survey: {
      id: survey.id,
      title: survey.title,
      audience: survey.audience,
    },
    questions: survey.questions,
    responses,
  });
};
