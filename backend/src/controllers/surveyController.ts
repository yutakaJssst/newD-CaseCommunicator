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

const buildDefaultQuestions = (gsnSnapshot: any): SurveyQuestionInput[] => {
  const nodes = extractNodesFromSnapshot(gsnSnapshot);
  const targetTypes = new Set(['Goal', 'Strategy']);
  const filtered = nodes.filter((node: any) => targetTypes.has(node.type));

  return filtered.map((node: any, index: number) => ({
    nodeId: String(node.id),
    nodeType: String(node.type),
    questionText: `この${node.type}の主張に同意しますか？`,
    order: index + 1,
    scaleMin: 0,
    scaleMax: 3,
  }));
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
  const { title, description, diagramId, gsnSnapshot, questions } = req.body;

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

  const questionList: SurveyQuestionInput[] = Array.isArray(questions) && questions.length > 0
    ? questions
    : buildDefaultQuestions(gsnSnapshot);

  const survey = await prisma.survey.create({
    data: {
      projectId,
      diagramId: diagramId || null,
      title,
      description: description || null,
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
