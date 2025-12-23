import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if it exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors (logout on authentication failure)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthResponse {
  result: string;
  token: string;
  user: User;
}

export interface UserResponse {
  result: string;
  user: User;
}

export interface Project {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  owner: User;
  members?: Array<{
    id: string;
    role: string;
    user: User;
  }>;
  _count?: {
    diagrams: number;
  };
}

export interface CreateProjectRequest {
  title: string;
  description?: string;
}

export interface UpdateProjectRequest {
  title?: string;
  description?: string;
}

export interface ProjectsResponse {
  result: string;
  projects: Project[];
}

export interface ProjectResponse {
  result: string;
  project: Project;
}

export const authAPI = {
  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  getMe: async (): Promise<UserResponse> => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

export const projectAPI = {
  getAll: async (): Promise<ProjectsResponse> => {
    const response = await api.get('/projects');
    return response.data;
  },

  getById: async (projectId: string): Promise<ProjectResponse> => {
    const response = await api.get(`/projects/${projectId}`);
    return response.data;
  },

  create: async (data: CreateProjectRequest): Promise<ProjectResponse> => {
    const response = await api.post('/projects', data);
    return response.data;
  },

  update: async (projectId: string, data: UpdateProjectRequest): Promise<ProjectResponse> => {
    const response = await api.put(`/projects/${projectId}`, data);
    return response.data;
  },

  delete: async (projectId: string): Promise<void> => {
    await api.delete(`/projects/${projectId}`);
  },
};
