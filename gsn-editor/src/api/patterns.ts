import axios from 'axios';
import type { Node, Link } from '../types/diagram';

const API_BASE_URL = 'http://localhost:3001/api';

// パターンデータの型定義
export interface PatternData {
  nodes: Node[];
  links: Link[];
}

// 作成者情報の型定義
export interface PatternAuthor {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

// パターンの型定義
export interface Pattern {
  id: string;
  name: string;
  description: string | null;
  data: PatternData;
  isPublic: boolean;
  authorId: string;
  author: PatternAuthor;
  createdAt: string;
  updatedAt: string;
}

// パターン作成リクエストの型定義
export interface CreatePatternRequest {
  name: string;
  description?: string;
  data: PatternData;
  isPublic: boolean;
}

// パターン更新リクエストの型定義
export interface UpdatePatternRequest {
  name?: string;
  description?: string;
  data?: PatternData;
  isPublic?: boolean;
}

// 認証トークンを取得するヘルパー
const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  return {
    Authorization: `Bearer ${token}`,
  };
};

// パターンAPI
export const patternsApi = {
  // パターン一覧取得
  getAll: async (): Promise<Pattern[]> => {
    const response = await axios.get(`${API_BASE_URL}/patterns`, {
      headers: getAuthHeaders(),
    });
    return response.data.patterns;
  },

  // パターン詳細取得
  getById: async (id: string): Promise<Pattern> => {
    const response = await axios.get(`${API_BASE_URL}/patterns/${id}`, {
      headers: getAuthHeaders(),
    });
    return response.data.pattern;
  },

  // パターン作成
  create: async (data: CreatePatternRequest): Promise<Pattern> => {
    const response = await axios.post(`${API_BASE_URL}/patterns`, data, {
      headers: getAuthHeaders(),
    });
    return response.data.pattern;
  },

  // パターン更新
  update: async (id: string, data: UpdatePatternRequest): Promise<Pattern> => {
    const response = await axios.put(`${API_BASE_URL}/patterns/${id}`, data, {
      headers: getAuthHeaders(),
    });
    return response.data.pattern;
  },

  // パターン削除
  delete: async (id: string): Promise<void> => {
    await axios.delete(`${API_BASE_URL}/patterns/${id}`, {
      headers: getAuthHeaders(),
    });
  },
};
