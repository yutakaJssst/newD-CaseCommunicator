import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { emitSurveyResponseCreated } from '../websocket/emitter';

export const getPublicSurvey = async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params;

  const survey = await prisma.survey.findFirst({
    where: { publicToken: token },
    include: { questions: { orderBy: { order: 'asc' } } },
  });

  if (!survey || survey.status !== 'published') {
    res.status(404).json({ error: 'アンケートが見つかりません' });
    return;
  }

  res.json({
    survey: {
      id: survey.id,
      title: survey.title,
      description: survey.description,
      status: survey.status,
      publicImageUrl: survey.publicImageUrl,
      audience: survey.audience,
      gsnSnapshot: survey.gsnSnapshot,
      questions: survey.questions,
    },
  });
};

export const submitPublicResponse = async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params;
  const { answers, respondentHash } = req.body;

  if (!Array.isArray(answers) || answers.length === 0) {
    res.status(400).json({ error: '回答が必要です' });
    return;
  }

  const survey = await prisma.survey.findFirst({
    where: { publicToken: token },
    include: { questions: true },
  });

  if (!survey || survey.status !== 'published') {
    res.status(404).json({ error: 'アンケートが見つかりません' });
    return;
  }

  const questionMap = new Map(survey.questions.map((q) => [q.id, q]));
  const normalizedAnswers = new Map<
    string,
    { questionId: string; score: number; comment: string | null }
  >();

  for (const answer of answers) {
    if (!answer || typeof answer !== 'object') {
      res.status(400).json({ error: '回答が不正です' });
      return;
    }
    const question = questionMap.get(answer.questionId);
    if (!question) {
      res.status(400).json({ error: '回答が不正です' });
      return;
    }
    if (normalizedAnswers.has(answer.questionId)) {
      res.status(400).json({ error: '回答が重複しています' });
      return;
    }
    const score = answer.score;
    if (typeof score !== 'number' || Number.isNaN(score)) {
      res.status(400).json({ error: 'スコアが不正です' });
      return;
    }
    const scaleType = question.scaleType || 'likert_0_3';
    const min = typeof question.scaleMin === 'number' ? question.scaleMin : 0;
    const max = typeof question.scaleMax === 'number' ? question.scaleMax : 3;
    if (scaleType === 'continuous_0_1') {
      if (score < min || score > max) {
        res.status(400).json({ error: '0〜1の範囲で回答してください' });
        return;
      }
    } else {
      if (!Number.isInteger(score) || score < min || score > max) {
        res.status(400).json({ error: '0〜3点で回答してください' });
        return;
      }
    }
    normalizedAnswers.set(answer.questionId, {
      questionId: answer.questionId,
      score,
      comment: answer.comment ? String(answer.comment) : null,
    });
  }

  if (normalizedAnswers.size !== survey.questions.length) {
    res.status(400).json({ error: 'すべての質問に回答してください' });
    return;
  }

  const sanitizedAnswers: Array<{ questionId: string; score: number; comment: string | null }> = [];
  for (const question of survey.questions) {
    const answer = normalizedAnswers.get(question.id);
    if (!answer) {
      res.status(400).json({ error: 'すべての質問に回答してください' });
      return;
    }
    sanitizedAnswers.push(answer);
  }

  await prisma.surveyResponse.create({
    data: {
      surveyId: survey.id,
      respondentHash: respondentHash || null,
      answers: {
        create: sanitizedAnswers,
      },
    },
  });

  emitSurveyResponseCreated(survey.projectId, survey.id);

  res.status(201).json({ result: 'OK' });
};
