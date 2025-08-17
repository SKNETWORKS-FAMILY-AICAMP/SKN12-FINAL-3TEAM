import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import MobileNavbar from '../../components/mobile/MobileNavbar';
import MobileKanbanBoard from '../../components/mobile/MobileKanbanBoard';
import MobileProjectSelector from '../../components/mobile/MobileProjectSelector';
import { Task, Project } from '../../services/api';
import '../../styles/mobile.css';

// API 기본 설정
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3500';

// API 클라이언트 설정
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Tenant-Slug': 'default',
  },
});

// 인증 토큰 추가
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// API 함수들
const fetchProjects = async () => {
  const response = await apiClient.get('/api/projects');
  return response.data;
};

const fetchTasks = async (projectId?: string) => {
  const url = projectId ? `/api/tasks?projectId=${projectId}` : '/api/tasks';
  const response = await apiClient.get(url);
  return response.data;
};

const updateTaskStatus = async (taskId: string, status: string) => {
  const response = await apiClient.patch(`/api/tasks/${taskId}/status`, { status });
  return response.data;
};

const MobileDashboard: React.FC = () => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 프로젝트 데이터 가져오기
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  // 태스크 데이터 가져오기
  const { data: tasks = [], isLoading: tasksLoading, refetch } = useQuery({
    queryKey: ['tasks', selectedProjectId],
    queryFn: () => fetchTasks(selectedProjectId === 'all' ? undefined : selectedProjectId),
  });

  // 태스크 상태 업데이트 핸들러
  const handleStatusUpdate = async (taskId: string, newStatus: string) => {
    try {
      await updateTaskStatus(taskId, newStatus);
      refetch();
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  // 모바일 뷰포트 설정
  useEffect(() => {
    const viewport = document.querySelector('meta[name=viewport]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
    }
  }, []);

  if (projectsLoading || tasksLoading) {
    return (
      <div className="mobile-loading">
        <div className="spinner"></div>
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="mobile-dashboard">
      <MobileNavbar 
        isMenuOpen={isMenuOpen} 
        setIsMenuOpen={setIsMenuOpen}
        title="TtalKkac"
      />
      
      <div className="mobile-content">
        <MobileProjectSelector
          projects={projects as Project[]}
          selectedProjectId={selectedProjectId}
          onProjectChange={setSelectedProjectId}
        />
        
        <MobileKanbanBoard
          tasks={tasks as Task[]}
          onStatusUpdate={handleStatusUpdate}
        />
      </div>

      {/* 모바일 메뉴 오버레이 */}
      {isMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setIsMenuOpen(false)}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-menu-header">
              <h2>메뉴</h2>
              <button onClick={() => setIsMenuOpen(false)}>✕</button>
            </div>
            <nav className="mobile-menu-nav">
              <a href="/mobile" className="mobile-menu-item active">
                <span className="icon">📊</span> 대시보드
              </a>
              <a href="/mobile/tasks" className="mobile-menu-item">
                <span className="icon">✅</span> 업무 관리
              </a>
              <a href="/mobile/meeting" className="mobile-menu-item">
                <span className="icon">🎤</span> 회의 분석
              </a>
              <a href="/mobile/settings" className="mobile-menu-item">
                <span className="icon">⚙️</span> 설정
              </a>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileDashboard;