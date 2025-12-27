import { api } from '../services/api';
import type { DiagramData } from '../types/diagram';

// Version management API - Diagram version interface
export interface DiagramVersion {
  id: string;
  diagramId: string;
  versionNumber: number;
  title: string;
  data?: DiagramData; // Full diagram data (only in getVersion response)
  commitMessage: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface CreateVersionRequest {
  commitMessage: string;
}

export const versionsApi = {
  // バージョン一覧取得
  getAll: async (projectId: string, diagramId: string): Promise<DiagramVersion[]> => {
    const response = await api.get(`/projects/${projectId}/diagrams/${diagramId}/versions`);
    return response.data;
  },

  // 特定バージョン取得
  getById: async (projectId: string, diagramId: string, versionId: string): Promise<DiagramVersion> => {
    const response = await api.get(`/projects/${projectId}/diagrams/${diagramId}/versions/${versionId}`);
    return response.data;
  },

  // バージョン作成（コミット）
  create: async (projectId: string, diagramId: string, data: CreateVersionRequest): Promise<DiagramVersion> => {
    const response = await api.post(`/projects/${projectId}/diagrams/${diagramId}/versions`, data);
    return response.data;
  },

  // バージョンへのロールバック
  restore: async (projectId: string, diagramId: string, versionId: string): Promise<void> => {
    await api.post(`/projects/${projectId}/diagrams/${diagramId}/versions/${versionId}/restore`);
  },

  // バージョン削除
  delete: async (projectId: string, diagramId: string, versionId: string): Promise<void> => {
    await api.delete(`/projects/${projectId}/diagrams/${diagramId}/versions/${versionId}`);
  },
};
