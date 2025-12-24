import axios from 'axios';
import { api } from '../services/api';

export type SurveyStatus = 'draft' | 'published' | 'closed';
export type SurveyAudience = 'general' | 'expert';
export type SurveyScaleType = 'likert_0_3' | 'continuous_0_1';

export interface SurveyQuestion {
  id: string;
  surveyId: string;
  nodeId: string;
  nodeType: string;
  questionText: string;
  scaleMin: number;
  scaleMax: number;
  scaleType?: SurveyScaleType;
  order: number;
}

export interface Survey {
  id: string;
  projectId: string;
  diagramId: string | null;
  title: string;
  description: string | null;
  publicImageUrl?: string | null;
  audience?: SurveyAudience;
  status: SurveyStatus;
  publicToken: string | null;
  gsnSnapshot?: unknown;
  createdAt: string;
  updatedAt: string;
  questions?: SurveyQuestion[];
  responseCount?: number;
}

export interface CreateSurveyRequest {
  title: string;
  description?: string;
  diagramId?: string | null;
  gsnSnapshot: unknown;
  audience?: SurveyAudience;
}

export interface UpdateSurveyRequest {
  description?: string | null;
  publicImageUrl?: string | null;
}

export interface SurveyListResponse {
  surveys: Array<Survey & { _count?: { responses: number } }>;
}

export interface SurveyAnalytics {
  responseCount: number;
  stats: Array<{
    questionId: string;
    nodeId: string;
    nodeType: string;
    averageScore: number | null;
    count: number;
  }>;
}

export interface SurveyResponseAnswer {
  questionId: string;
  score: number;
  comment?: string | null;
}

export interface SurveyResponseEntry {
  id: string;
  respondentHash: string | null;
  submittedAt: string;
  answers: SurveyResponseAnswer[];
}

export interface SurveyResponsesResponse {
  survey: {
    id: string;
    title: string;
    audience?: SurveyAudience;
  };
  questions: SurveyQuestion[];
  responses: SurveyResponseEntry[];
}

export interface PublicSurveyResponse {
  survey: {
    id: string;
    title: string;
    description: string | null;
    status: SurveyStatus;
    audience?: SurveyAudience;
    publicImageUrl?: string | null;
    gsnSnapshot: unknown;
    questions: SurveyQuestion[];
  };
}

export interface PublicSurveyAnswer {
  questionId: string;
  score: number;
  comment?: string;
}

export const surveysApi = {
  async listProjectSurveys(projectId: string): Promise<SurveyListResponse> {
    const response = await api.get(`/projects/${projectId}/surveys`);
    return response.data;
  },

  async createSurvey(projectId: string, data: CreateSurveyRequest): Promise<{ survey: Survey }> {
    const response = await api.post(`/projects/${projectId}/surveys`, data);
    return response.data;
  },

  async getSurvey(surveyId: string): Promise<{ survey: Survey }> {
    const response = await api.get(`/surveys/${surveyId}`);
    return response.data;
  },

  async updateSurvey(surveyId: string, data: UpdateSurveyRequest): Promise<{ survey: Survey }> {
    const response = await api.patch(`/surveys/${surveyId}`, data);
    return response.data;
  },

  async publishSurvey(surveyId: string): Promise<{ survey: Survey }> {
    const response = await api.post(`/surveys/${surveyId}/publish`);
    return response.data;
  },

  async closeSurvey(surveyId: string): Promise<{ survey: Survey }> {
    const response = await api.post(`/surveys/${surveyId}/close`);
    return response.data;
  },

  async getSurveyAnalytics(surveyId: string): Promise<SurveyAnalytics> {
    const response = await api.get(`/surveys/${surveyId}/analytics`);
    return response.data;
  },

  async getSurveyResponses(surveyId: string): Promise<SurveyResponsesResponse> {
    const response = await api.get(`/surveys/${surveyId}/responses`);
    return response.data;
  },
};

const publicApi = axios.create({
  baseURL: 'http://localhost:3001/api',
  headers: { 'Content-Type': 'application/json' },
});

export const publicSurveysApi = {
  async getSurvey(token: string): Promise<PublicSurveyResponse> {
    const response = await publicApi.get(`/surveys/public/${token}`);
    return response.data;
  },

  async submitResponse(token: string, answers: PublicSurveyAnswer[]): Promise<void> {
    await publicApi.post(`/surveys/public/${token}/response`, { answers });
  },
};
