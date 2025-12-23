import { Request, Response } from 'express';
import { prisma } from '../db/prisma';

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

  const questionIds = new Set(survey.questions.map((q) => q.id));
  const sanitizedAnswers = answers
    .filter((answer: any) => questionIds.has(answer.questionId))
    .map((answer: any) => ({
      questionId: answer.questionId,
      score: answer.score,
      comment: answer.comment || null,
    }));

  if (sanitizedAnswers.length === 0) {
    res.status(400).json({ error: '回答が不正です' });
    return;
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

  res.status(201).json({ result: 'OK' });
};
