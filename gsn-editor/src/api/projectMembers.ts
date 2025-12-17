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

// Types
export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  createdAt: string;
  user: User;
}

export interface InviteMemberRequest {
  email: string;
  role: 'editor' | 'viewer';
}

export interface UpdateMemberRoleRequest {
  role: 'editor' | 'viewer';
}

// API functions
export const projectMembersApi = {
  /**
   * Get all members of a project
   */
  async getMembers(projectId: string): Promise<{ owner: User; members: ProjectMember[] }> {
    const response = await apiClient.get(`/projects/${projectId}/members`);
    return {
      owner: response.data.owner,
      members: response.data.members,
    };
  },

  /**
   * Invite a user to the project
   */
  async inviteMember(projectId: string, request: InviteMemberRequest): Promise<ProjectMember> {
    const response = await apiClient.post(`/projects/${projectId}/members`, request);
    return response.data.member;
  },

  /**
   * Update a member's role
   */
  async updateMemberRole(
    projectId: string,
    memberId: string,
    request: UpdateMemberRoleRequest
  ): Promise<ProjectMember> {
    const response = await apiClient.put(`/projects/${projectId}/members/${memberId}`, request);
    return response.data.member;
  },

  /**
   * Remove a member from the project
   */
  async removeMember(projectId: string, memberId: string): Promise<void> {
    await apiClient.delete(`/projects/${projectId}/members/${memberId}`);
  },
};
