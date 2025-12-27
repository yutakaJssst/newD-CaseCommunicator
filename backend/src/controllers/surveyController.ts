import { Response } from 'express';
import crypto from 'crypto';
import type { AuthRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';

type SurveyQuestionInput = {
  nodeId: string;
  nodeType: string;
  questionText: string;
  order: number;
  audience?: 'general' | 'expert';
  scaleMin?: number;
  scaleMax?: number;
  scaleType?: 'likert_0_3' | 'continuous_0_1' | 'choice';
  contextInfo?: string; // コンテキストノードの情報（C1: 説明文, C2: 説明文 ...）
};

const DEFAULT_EXPERT_INTRO = `以下は現状のシステムの安全性を、厳密に測定するための質問です。議論の基盤になるGSNの末端のゴールノードと戦略ノードについて専門家の立場から回答をお願いいたします。

それぞれの質問では0から1点の値(確信値)を入力していただきます。以下の基準で回答してください。0と1は使用しないでください。
0.98 ほぼ標準・教科書どおり。抜けや疑問点はほとんどない
0.90 概ね妥当。多少気になる点はあるが実務上は許容
0.80 妥当だが弱点あり。前提依存・カバレッジ不足が気になる
0.70  かなり弱い。重要な前提の抜けや想定外シナリオの懸念
0.40. 根本的に疑問。議論・エビデンスの組み直しレベル
またその採点の理由もできるだけ詳細に記入をお願いいたします。`;

const ROLE_QUESTION_NODE_ID = 'meta_role';
const ROLE_QUESTION_NODE_TYPE = 'Meta';
const ROLE_QUESTION_TEXT = 'あなたの役職(所属)を教えて下さい。';
const ROLE_QUESTION_OPTIONS = [
  'アーキテクト',
  'フェロー',
  '事業本部',
  'プロダクト本部',
  'R&Dユニット',
  '経営層（CxO）',
  'その他',
];

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

// HTMLタグを除去してプレーンテキストに変換
const stripHtml = (html?: string): string => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
};

// HTMLからURLリンクを抽出して保持しつつ、テキストを読みやすくする
const extractTextWithLinks = (html?: string): string => {
  if (!html) return '';
  // aタグをMarkdown風のリンク形式に変換: <a href="url">text</a> → text (url)
  let result = html.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi, '$2 ($1)');
  // 残りのHTMLタグを除去
  result = result.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return result;
};

// ノードに接続されている関連ノード（Module以外）の情報を取得
const getContextNodesForNode = (nodeId: string, nodes: any[], links: any[]): string[] => {
  const nodeMap = new Map(nodes.map((node) => [String(node.id), node]));
  // Module以外の全てのノードタイプを含める
  const excludeTypes = new Set(['Module']);

  // このノードをソースとするリンクのターゲットを取得
  const contextNodes: string[] = [];
  links.forEach((link) => {
    if (!link) return;
    const source = String(link.source);
    const target = String(link.target);
    if (source !== nodeId) return;

    const targetNode = nodeMap.get(target);
    if (!targetNode || excludeTypes.has(targetNode.type)) return;

    const label = targetNode.label || target;
    // URLリンクを保持したテキストを取得
    const content = extractTextWithLinks(targetNode.content);
    contextNodes.push(`${label}: ${content || '(説明なし)'}`);
  });

  return contextNodes;
};

// Moduleノードから参照されているダイアグラムのトップゴールIDを取得
const findModuleTopGoalIds = (gsnSnapshot: any): Set<string> => {
  const topGoalIds = new Set<string>();

  // ProjectData形式の場合、modulesから各ダイアグラムのトップゴールを取得
  if (gsnSnapshot?.modules && typeof gsnSnapshot.modules === 'object') {
    const modules = gsnSnapshot.modules as Record<string, any>;

    // ルートモジュール内のModuleノードを探す
    Object.values(modules).forEach((moduleData: any) => {
      if (!moduleData?.nodes) return;

      moduleData.nodes.forEach((node: any) => {
        if (node?.type === 'Module' && node?.moduleId) {
          // このModuleノードが参照しているダイアグラムのノードを取得
          const targetModule = modules[node.moduleId];
          if (targetModule?.nodes) {
            // そのモジュール内のGoalノードのうち、親を持たないものがトップゴール
            const targetNodes = targetModule.nodes;
            const targetLinks = targetModule.links || [];
            const hasParent = new Set<string>();

            targetLinks.forEach((link: any) => {
              if (link?.target) {
                hasParent.add(String(link.target));
              }
            });

            targetNodes.forEach((targetNode: any) => {
              if (targetNode?.type === 'Goal' && !hasParent.has(String(targetNode.id))) {
                topGoalIds.add(String(targetNode.id));
              }
            });
          }
        }
      });
    });
  }

  return topGoalIds;
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

  // Moduleノードから参照されているトップゴールを除外
  const moduleTopGoals = findModuleTopGoalIds(gsnSnapshot);
  const filtered = nodes.filter((node: any) => {
    if (!targetTypes.has(node.type)) return false;
    // モジュール内のトップゴールは除外
    if (moduleTopGoals.has(String(node.id))) return false;
    return true;
  });

  const leafGoals = findLeafGoalIds(nodes, links);

  const roleQuestions: SurveyQuestionInput[] = [];
  if (audience === 'general') {
    roleQuestions.push({
      nodeId: ROLE_QUESTION_NODE_ID,
      nodeType: ROLE_QUESTION_NODE_TYPE,
      questionText: ROLE_QUESTION_TEXT,
      order: 0,
      audience,
      scaleMin: 0,
      scaleMax: ROLE_QUESTION_OPTIONS.length - 1,
      scaleType: 'choice',
    });
  }

  const nodeQuestions = filtered.map((node: any, index: number) => {
    const nodeId = String(node.id);
    const nodeType = String(node.type);
    const isLeafGoal = nodeType === 'Goal' && leafGoals.has(nodeId);
    const isStrategy = nodeType === 'Strategy';
    const useConfidenceScale = audience === 'expert' && (isLeafGoal || isStrategy);

    // ノードのラベルとコンテンツを取得
    const nodeLabel = node.label || nodeId;
    const nodeContent = stripHtml(node.content) || '(説明なし)';

    // 接続されているコンテキストノードの情報を取得
    const contextNodes = getContextNodesForNode(nodeId, nodes, links);
    const contextInfo = contextNodes.length > 0 ? contextNodes.join('\n') : '';

    // 質問文を生成
    // ゴールノード: 「以下の主張に...」
    // 戦略ノード: 「以下の議論戦略に...」
    // 専門家向け: 「確信が持てますか。」
    // 一般向け: 「合意できますか。」
    const subjectPrefix = isStrategy ? '以下の議論戦略に' : '以下の主張に';
    const verbSuffix = useConfidenceScale ? '確信が持てますか。' : '合意できますか。';
    const questionText = `${subjectPrefix}${verbSuffix}\n${nodeContent}（${nodeLabel}）`;

    return {
      nodeId,
      nodeType,
      questionText,
      order: index + 1,
      audience,
      scaleMin: useConfidenceScale ? 0 : 0,
      scaleMax: useConfidenceScale ? 1 : 3,
      scaleType: useConfidenceScale ? 'continuous_0_1' : 'likert_0_3',
      contextInfo: contextInfo || undefined,
    };
  });

  return [...roleQuestions, ...nodeQuestions];
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
      expertIntro: true,
      publicImageUrl: true,
      mode: true,
      audience: true,
      status: true,
      publicToken: true,
      publicTokenExpert: true,
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
  const { title, description, diagramId, gsnSnapshot, questions, audience, mode, expertIntro } = req.body;

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
  const surveyMode = mode === 'combined' ? 'combined' : 'single';
  const shouldIncludeExpertIntro = surveyMode === 'combined' || surveyAudience === 'expert';
  let resolvedExpertIntro: string | null = null;
  if (typeof expertIntro === 'string') {
    resolvedExpertIntro = expertIntro.trim() || null;
  } else if (expertIntro === null) {
    resolvedExpertIntro = null;
  } else if (shouldIncludeExpertIntro) {
    resolvedExpertIntro = DEFAULT_EXPERT_INTRO;
  }
  let questionList: SurveyQuestionInput[] = [];
  if (Array.isArray(questions) && questions.length > 0) {
    questionList = questions;
  } else if (surveyMode === 'combined') {
    questionList = [
      ...buildDefaultQuestions(gsnSnapshot, 'general'),
      ...buildDefaultQuestions(gsnSnapshot, 'expert'),
    ];
  } else {
    questionList = buildDefaultQuestions(gsnSnapshot, surveyAudience);
  }

  const survey = await prisma.survey.create({
    data: {
      projectId,
      diagramId: diagramId || null,
      title,
      description: typeof description === 'string' ? description.trim() || null : null,
      expertIntro: resolvedExpertIntro,
      audience: surveyAudience,
      mode: surveyMode,
      gsnSnapshot,
      createdById: userId,
      questions: {
        create: questionList.map((question) => ({
          nodeId: question.nodeId,
          nodeType: question.nodeType,
          questionText: question.questionText,
          contextInfo: question.contextInfo || null,
          order: question.order,
          audience: question.audience || surveyAudience,
          scaleMin: question.scaleMin ?? 0,
          scaleMax: question.scaleMax ?? 3,
          scaleType: question.scaleType ?? 'likert_0_3',
        })),
      },
    },
    include: {
      questions: { orderBy: [{ audience: 'asc' }, { order: 'asc' }] },
    },
  });

  res.status(201).json({ survey });
};

export const updateSurvey = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { surveyId } = req.params;
  const { description, publicImageUrl, expertIntro } = req.body;

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

  const data: { description?: string | null; publicImageUrl?: string | null; expertIntro?: string | null } = {};
  if (typeof description === 'string' || description === null) {
    data.description = typeof description === 'string' ? description.trim() || null : null;
  }
  if (typeof publicImageUrl === 'string' || publicImageUrl === null) {
    data.publicImageUrl =
      typeof publicImageUrl === 'string' ? publicImageUrl.trim() || null : null;
  }
  if (typeof expertIntro === 'string' || expertIntro === null) {
    data.expertIntro = typeof expertIntro === 'string' ? expertIntro.trim() || null : null;
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
      questions: { orderBy: [{ audience: 'asc' }, { order: 'asc' }] },
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
  let publicTokenExpert = survey.publicTokenExpert;
  if (survey.mode === 'combined') {
    publicTokenExpert = publicTokenExpert || crypto.randomUUID();
    while (publicTokenExpert === publicToken) {
      publicTokenExpert = crypto.randomUUID();
    }
  }
  const updated = await prisma.survey.update({
    where: { id: surveyId },
    data: {
      status: 'published',
      publicToken,
      publicTokenExpert:
        survey.mode === 'combined'
          ? publicTokenExpert
          : survey.publicTokenExpert,
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
      questions: { orderBy: [{ audience: 'asc' }, { order: 'asc' }] },
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
      audience: question.audience,
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
      questions: { orderBy: [{ audience: 'asc' }, { order: 'asc' }] },
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
