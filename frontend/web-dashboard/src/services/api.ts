import axios, { AxiosResponse } from 'axios';
import { io, Socket } from 'socket.io-client';

// API 기본 설정
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3500';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3500';
const TENANT_SLUG = 'default'; // import.meta.env.VITE_TENANT_SLUG || 'default';

// 디버깅용 로그
console.log('🔍 API 설정:', {
  API_BASE_URL,
  SOCKET_URL,
  TENANT_SLUG,
  env: import.meta.env
});

// Axios 인스턴스 생성
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'X-Tenant-Slug': TENANT_SLUG,
    'ngrok-skip-browser-warning': 'true', // ngrok free tier 확인 페이지 스킵
  },
});

// Request Interceptor - 모든 요청에 토큰 추가
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor - 401 응답 처리 (세션 만료)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API 에러 발생:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
      data: error.response?.data
    });
    
    // 로그인 관련 경로는 401 에러 처리 제외
    const isAuthPath = error.config?.url?.includes('/auth/') || 
                      error.config?.url?.includes('/login');
    
    if (error.response?.status === 401 && !isAuthPath) {
      console.log('401 에러 - 인증 실패로 처리');
      // 토큰 만료 또는 무효
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // 로그인 페이지로 리다이렉트 (현재 경로가 로그인이 아닌 경우)
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Socket.IO 클라이언트
let socket: Socket | null = null;

export const connectSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      query: { tenantSlug: TENANT_SLUG },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: parseInt(import.meta.env.VITE_SOCKET_RECONNECT_DELAY || '5000'),
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// 타입 정의
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  skills?: string[];
  availableHours?: number;
  experienceLevel?: string;
}

export interface Project {
  id: string;
  title: string;
  overview: string;
  content: any;
  notionPageUrl?: string;
  createdAt: string;
  tasks: Task[];
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  assigneeId?: string;
  assignee?: User;
  dueDate?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  complexity?: string;
  metadata?: TaskMetadata;
  children?: Task[];
}

export interface TaskMetadata {
  estimatedHours?: number;
  actualHours?: number;
  requiredSkills?: string[];
  taskType?: string;
  jiraIssueKey?: string;
}

export interface SlackInput {
  id: string;
  content: string;
  inputType: 'VOICE' | 'TEXT';
  status: 'RECEIVED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  projects: Project[];
}

export interface DashboardStats {
  totalMeetings: number;
  averageProcessingTime: number;
  accuracy: number;
  completedTasks: number;
  inProgressTasks: number;
  scheduledTasks: number;
}

// API 함수들
export const dashboardAPI = {
  // 대시보드 통계 조회
  getStats: async (): Promise<DashboardStats> => {
    try {
      // 개발 환경에서는 테스트 API 사용
      const response: AxiosResponse<DashboardStats> = await apiClient.get('/test/stats');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      // Fallback data
      return {
        totalMeetings: 12,
        averageProcessingTime: 20,
        accuracy: 95,
        completedTasks: 8,
        inProgressTasks: 15,
        scheduledTasks: 5,
      };
    }
  },

  // 최근 활동 조회
  getRecentActivities: async () => {
    try {
      const response = await apiClient.get('/api/dashboard/recent-activities');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch recent activities:', error);
      return [];
    }
  },
};

export const projectAPI = {
  // 프로젝트 목록 조회
  getProjects: async (): Promise<Project[]> => {
    try {
      const response: AxiosResponse<Project[]> = await apiClient.get('/api/projects');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      return [];
    }
  },

  // 프로젝트 상세 조회
  getProject: async (id: string): Promise<Project | null> => {
    try {
      const response: AxiosResponse<Project> = await apiClient.get(`/api/projects/${id}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch project:', error);
      return null;
    }
  },

  // 프로젝트 생성 (음성 파일 업로드)
  createFromAudio: async (file: File): Promise<{ success: boolean; message: string; projectId?: string }> => {
    try {
      const formData = new FormData();
      formData.append('audio', file);

      const response = await apiClient.post('/api/slack/process-audio', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data as { success: boolean; message: string; projectId?: string };
    } catch (error) {
      console.error('Failed to create project from audio:', error);
      return { success: false, message: '음성 처리 중 오류가 발생했습니다.' };
    }
  },
};

export const taskAPI = {
  // 업무 목록 조회
  getTasks: async (filters?: {
    status?: string;
    assigneeId?: string;
    priority?: string;
  }): Promise<Task[]> => {
    try {
      // React Query가 추가하는 메타데이터 제거
      const cleanFilters: any = {};
      if (filters) {
        Object.keys(filters).forEach(key => {
          // queryKey, signal 등 React Query 메타데이터 제외
          if (key !== 'queryKey' && key !== 'signal' && filters[key as keyof typeof filters] !== undefined) {
            cleanFilters[key] = filters[key as keyof typeof filters];
          }
        });
      }
      
      // 임시로 public endpoint 사용 (인증 없이 테스트)
      const response: AxiosResponse<Task[]> = await apiClient.get('/tasks', {
        params: Object.keys(cleanFilters).length > 0 ? cleanFilters : undefined,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      // Fallback: DB에 있는 샘플 데이터와 동일한 구조로 반환
      return [
        {
          id: 'task-001',
          title: '요구사항 정의서 작성',
          description: '상세 기능 명세서 작성 및 비즈니스 요구사항 분석',
          status: 'DONE',
          priority: 'HIGH',
          assigneeId: 'test-user-id-123',
          assignee: {
            id: 'test-user-id-123',
            name: '테스트 사용자',
            email: 'test@example.com',
            role: 'MEMBER'
          },
          dueDate: '2025-01-15',
          complexity: 'MEDIUM'
        },
        {
          id: 'task-002',
          title: 'UI/UX 디자인 시안 작성',
          description: '사용자 인터페이스 디자인 및 프로토타입 제작',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          assigneeId: 'test-user-id-123',
          assignee: {
            id: 'test-user-id-123',
            name: '테스트 사용자',
            email: 'test@example.com',
            role: 'MEMBER'
          },
          dueDate: '2025-01-18',
          complexity: 'HIGH'
        },
        {
          id: 'task-003',
          title: '데이터베이스 스키마 설계',
          description: 'ERD 작성 및 테이블 구조 정의',
          status: 'TODO',
          priority: 'MEDIUM',
          dueDate: '2025-01-20',
          complexity: 'MEDIUM'
        },
        {
          id: 'task-004',
          title: 'API 명세서 작성',
          description: 'RESTful API 엔드포인트 정의 및 문서화',
          status: 'TODO',
          priority: 'MEDIUM',
          dueDate: '2025-01-22',
          complexity: 'LOW'
        },
        {
          id: 'task-005',
          title: '백엔드 API 개발',
          description: 'Node.js/Express 서버 구현',
          status: 'TODO',
          priority: 'HIGH',
          dueDate: '2025-01-25',
          complexity: 'HIGH'
        }
      ] as Task[];
    }
  },

  // 업무 상세 조회
  getTask: async (id: string): Promise<Task | null> => {
    try {
      const response: AxiosResponse<Task> = await apiClient.get(`/api/tasks/${id}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch task:', error);
      return null;
    }
  },

  // 업무 상태 업데이트
  updateTaskStatus: async (id: string, status: Task['status']): Promise<boolean> => {
    try {
      await apiClient.patch(`/api/tasks/${id}/status`, { status });
      return true;
    } catch (error) {
      console.error('Failed to update task status:', error);
      return false;
    }
  },

  // 업무 배정
  assignTask: async (taskId: string, assigneeId: string): Promise<boolean> => {
    try {
      await apiClient.patch(`/api/tasks/${taskId}/assign`, { assigneeId });
      return true;
    } catch (error) {
      console.error('Failed to assign task:', error);
      return false;
    }
  },
  
  // 새 업무 생성
  createTask: async (taskData: {
    title: string;
    description?: string;
    status?: Task['status'];
    priority?: Task['priority'];
    dueDate?: string;
    assigneeId?: string;
    projectId?: string; // 선택사항으로 변경 (백엔드에서 자동 처리)
  }): Promise<Task> => {
    try {
      const response: AxiosResponse<Task> = await apiClient.post('/api/tasks', taskData);
      return response.data;
    } catch (error) {
      console.error('Failed to create task:', error);
      throw error;
    }
  },

  // 업무 수정
  updateTask: async (taskId: string, updates: {
    title?: string;
    description?: string;
    status?: Task['status'];
    priority?: Task['priority'];
    dueDate?: string;
    assigneeId?: string;
  }): Promise<Task> => {
    try {
      const response: AxiosResponse<Task> = await apiClient.patch(`/api/tasks/${taskId}`, updates);
      return response.data;
    } catch (error) {
      console.error('Failed to update task:', error);
      throw error;
    }
  },

  // 업무 삭제
  deleteTask: async (taskId: string): Promise<void> => {
    try {
      await apiClient.delete(`/api/tasks/${taskId}`);
    } catch (error) {
      console.error('Failed to delete task:', error);
      throw error;
    }
  },
};

export const userAPI = {
  // 사용자 목록 조회
  getUsers: async (): Promise<User[]> => {
    try {
      // 개발 환경에서는 테스트 API 사용
      const response: AxiosResponse<User[]> = await apiClient.get('/test/users');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch users:', error);
      return [];
    }
  },

  // 현재 사용자 정보 조회
  getCurrentUser: async (): Promise<User | null> => {
    try {
      const response: AxiosResponse<User> = await apiClient.get('/api/users/me');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      return null;
    }
  },

  // 사용자 생성
  createUser: async (userData: {
    name: string;
    email: string;
    role?: User['role'];
    skills?: string[];
    availableHours?: number;
    experienceLevel?: string;
  }): Promise<User> => {
    try {
      const response: AxiosResponse<User> = await apiClient.post('/api/users', userData);
      return response.data;
    } catch (error) {
      console.error('Failed to create user:', error);
      throw error;
    }
  },

  // 사용자 수정
  updateUser: async (userId: string, updates: {
    name?: string;
    email?: string;
    role?: User['role'];
    skills?: string[];
    availableHours?: number;
    experienceLevel?: string;
  }): Promise<User> => {
    try {
      const response: AxiosResponse<User> = await apiClient.patch(`/api/users/${userId}`, updates);
      return response.data;
    } catch (error) {
      console.error('Failed to update user:', error);
      throw error;
    }
  },

  // 사용자 삭제
  deleteUser: async (userId: string): Promise<void> => {
    try {
      await apiClient.delete(`/api/users/${userId}`);
    } catch (error) {
      console.error('Failed to delete user:', error);
      throw error;
    }
  },
};

export const slackAPI = {
  // Slack 입력 기록 조회
  getInputs: async (): Promise<SlackInput[]> => {
    try {
      const response: AxiosResponse<SlackInput[]> = await apiClient.get('/api/slack/inputs');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch slack inputs:', error);
      return [];
    }
  },
};

export const integrationAPI = {
  // 연동 상태 조회 (getStatus로도 접근 가능)
  getIntegrationStatus: async () => {
    try {
      const response = await apiClient.get('/api/integrations/status');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch integration status:', error);
      return {
        slack: false,
        notion: false,
        jira: false,
      };
    }
  },

  // getStatus 별칭 (다른 컴포넌트에서 사용)
  getStatus: async () => {
    return integrationAPI.getIntegrationStatus();
  },

  // 연동 해지
  disconnectService: async (service: 'slack' | 'notion' | 'jira'): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await apiClient.delete(`/api/integrations/${service}`);
      return {
        success: true,
        message: response.data.message || '연동이 해제되었습니다.'
      };
    } catch (error) {
      console.error(`Failed to disconnect ${service}:`, error);
      return {
        success: false,
        message: '연동 해제에 실패했습니다.'
      };
    }
  },

  // Notion 연동 (OAuth 리다이렉트 방식으로 변경됨 - 사용 안 함)
  // connectNotion: async () => {
  //   try {
  //     const response = await apiClient.get('/api/integrations/notion/auth');
  //     return response.data.authUrl;
  //   } catch (error) {
  //     console.error('Failed to get Notion auth URL:', error);
  //     return null;
  //   }
  // },

  // JIRA 연동 (OAuth 리다이렉트 방식으로 변경됨 - 사용 안 함)
  // connectJira: async () => {
  //   try {
  //     const response = await apiClient.get('/api/integrations/jira/auth');
  //     return response.data.authUrl;
  //   } catch (error) {
  //     console.error('Failed to get JIRA auth URL:', error);
  //     return null;
  //   }
  // },
};

// Real-time event listeners
export const subscribeToRealTimeUpdates = (callbacks: {
  onTaskUpdate?: (task: Task) => void;
  onProjectCreate?: (project: Project) => void;
  onProcessingStatus?: (status: { type: string; message: string; progress?: number }) => void;
}) => {
  const socket = connectSocket();

  if (callbacks.onTaskUpdate) {
    socket.on('task:updated', callbacks.onTaskUpdate);
  }

  if (callbacks.onProjectCreate) {
    socket.on('project:created', callbacks.onProjectCreate);
  }

  if (callbacks.onProcessingStatus) {
    socket.on('processing:status', callbacks.onProcessingStatus);
  }

  return () => {
    socket.off('task:updated');
    socket.off('project:created');
    socket.off('processing:status');
  };
};

export default {
  dashboardAPI,
  projectAPI,
  taskAPI,
  userAPI,
  slackAPI,
  integrationAPI,
  connectSocket,
  disconnectSocket,
  subscribeToRealTimeUpdates,
};
