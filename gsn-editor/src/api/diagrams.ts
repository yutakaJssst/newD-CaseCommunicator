import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

// Get auth token from localStorage
const getAuthToken = () => {
  const authStore = localStorage.getItem('auth-storage');
  if (!authStore) return null;

  try {
    const parsed = JSON.parse(authStore);
    return parsed.state?.token || null;
  } catch {
    return null;
  }
};

// Axios instance with auth header
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Diagram types
export interface DiagramMetadata {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiagramData {
  id: string;
  projectId: string;
  title: string;
  data: unknown; // JSON data (nodes, links, modules, etc.)
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDiagramRequest {
  title: string;
  data?: unknown;
}

export interface UpdateDiagramRequest {
  title?: string;
  data?: unknown;
}

// API functions
export const diagramsApi = {
  /**
   * Get all diagrams for a project
   */
  async getDiagrams(projectId: string): Promise<DiagramMetadata[]> {
    const response = await apiClient.get(`/projects/${projectId}/diagrams`);
    return response.data.diagrams;
  },

  /**
   * Get a specific diagram
   */
  async getDiagram(projectId: string, diagramId: string): Promise<DiagramData> {
    const response = await apiClient.get(`/projects/${projectId}/diagrams/${diagramId}`);
    return response.data.diagram;
  },

  /**
   * Create a new diagram
   */
  async createDiagram(projectId: string, request: CreateDiagramRequest): Promise<DiagramData> {
    const response = await apiClient.post(`/projects/${projectId}/diagrams`, request);
    return response.data.diagram;
  },

  /**
   * Update a diagram
   */
  async updateDiagram(
    projectId: string,
    diagramId: string,
    request: UpdateDiagramRequest
  ): Promise<DiagramData> {
    const response = await apiClient.put(`/projects/${projectId}/diagrams/${diagramId}`, request);
    return response.data.diagram;
  },

  /**
   * Delete a diagram
   */
  async deleteDiagram(projectId: string, diagramId: string): Promise<void> {
    await apiClient.delete(`/projects/${projectId}/diagrams/${diagramId}`);
  },
};
