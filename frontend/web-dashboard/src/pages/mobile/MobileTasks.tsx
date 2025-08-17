import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import MobileNavbar from '../../components/mobile/MobileNavbar';
import '../../styles/mobile.css';
import '../../styles/mobile-pages.css';

// API 기본 설정
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3500';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Tenant-Slug': 'default',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const fetchTasks = async () => {
  const response = await apiClient.get('/api/tasks');
  return response.data;
};

const MobileTasks: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: fetchTasks,
  });

  const filteredTasks = (tasks as any[]).filter((task: any) => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#fbbf24';
      case 'in_progress': return '#3b82f6';
      case 'completed': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '대기 중';
      case 'in_progress': return '진행 중';
      case 'completed': return '완료';
      default: return status;
    }
  };

  if (isLoading) {
    return (
      <div className="mobile-loading">
        <div className="spinner"></div>
        <p>업무 목록을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="mobile-dashboard">
      <MobileNavbar 
        isMenuOpen={isMenuOpen} 
        setIsMenuOpen={setIsMenuOpen}
        title="업무 관리"
      />
      
      <div className="mobile-content">
        {/* 필터 탭 */}
        <div className="mobile-filter-tabs">
          <button 
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            전체
            <span className="filter-count">{(tasks as any[]).length}</span>
          </button>
          <button 
            className={`filter-tab ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            대기 중
            <span className="filter-count">{(tasks as any[]).filter((t: any) => t.status === 'pending').length}</span>
          </button>
          <button 
            className={`filter-tab ${filter === 'in_progress' ? 'active' : ''}`}
            onClick={() => setFilter('in_progress')}
          >
            진행 중
            <span className="filter-count">{(tasks as any[]).filter((t: any) => t.status === 'in_progress').length}</span>
          </button>
          <button 
            className={`filter-tab ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            완료
            <span className="filter-count">{(tasks as any[]).filter((t: any) => t.status === 'completed').length}</span>
          </button>
        </div>

        {/* 업무 목록 */}
        <div className="mobile-task-list">
          {filteredTasks.length > 0 ? (
            filteredTasks.map((task: any) => (
              <div key={task.id} className="mobile-task-item">
                <div className="task-item-header">
                  <h3 className="task-item-title">{task.title}</h3>
                  <div 
                    className="task-status-badge" 
                    style={{ backgroundColor: getStatusColor(task.status) }}
                  >
                    {getStatusText(task.status)}
                  </div>
                </div>
                
                {task.description && (
                  <p className="task-item-description">{task.description}</p>
                )}
                
                <div className="task-item-meta">
                  {task.assignee && (
                    <span className="task-meta-item">
                      <span className="meta-icon">👤</span>
                      {task.assignee}
                    </span>
                  )}
                  {task.deadline && (
                    <span className="task-meta-item">
                      <span className="meta-icon">📅</span>
                      {new Date(task.deadline).toLocaleDateString('ko-KR')}
                    </span>
                  )}
                  {task.priority && (
                    <span className="task-meta-item">
                      <span className="meta-icon">
                        {task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢'}
                      </span>
                      {task.priority}
                    </span>
                  )}
                </div>

                {task.parentTask && (
                  <div className="task-parent-info">
                    연관 업무: {task.parentTask.title}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="empty-tasks">
              <p>표시할 업무가 없습니다.</p>
            </div>
          )}
        </div>
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
              <a href="/mobile" className="mobile-menu-item">
                <span className="icon">📊</span> 대시보드
              </a>
              <a href="/mobile/tasks" className="mobile-menu-item active">
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

export default MobileTasks;