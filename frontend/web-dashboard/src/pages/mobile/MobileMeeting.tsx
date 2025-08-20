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

const fetchProjects = async () => {
  try {
    const response = await apiClient.get('/api/projects');
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return [];
  }
};

const MobileMeeting: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  const handleStartRecording = () => {
    setIsRecording(true);
    // 실제 녹음 로직 구현
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    // 실제 녹음 중지 로직 구현
  };

  // 프로젝트 데이터를 회의 형식으로 변환
  const recentMeetings = projects.slice(0, 5).map((project: any) => ({
    id: project.id,
    title: project.title || '제목 없음',
    date: project.createdAt || new Date().toISOString(),
    duration: '분석 중',
    participants: project.tasks ? 
      [...new Set(project.tasks.filter((t: any) => t.assignee).map((t: any) => 
        typeof t.assignee === 'string' ? t.assignee : t.assignee?.name
      ))] : [],
    summary: project.overview || '프로젝트 요약 정보가 없습니다.'
  }));

  return (
    <div className="mobile-dashboard">
      <MobileNavbar 
        isMenuOpen={isMenuOpen} 
        setIsMenuOpen={setIsMenuOpen}
        title="회의 분석"
      />
      
      <div className="mobile-content">
        {isLoading && (
          <div className="mobile-loading">
            <div className="spinner"></div>
            <p>데이터를 불러오는 중...</p>
          </div>
        )}
        {/* 녹음 섹션 */}
        <div className="mobile-recording-section">
          <div className="recording-card">
            <h2 className="recording-title">새 회의 녹음</h2>
            <p className="recording-description">
              회의를 녹음하여 자동으로 요약하고 업무를 추출합니다.
            </p>
            
            <div className="recording-controls">
              {!isRecording ? (
                <button 
                  className="recording-button start"
                  onClick={handleStartRecording}
                >
                  <span className="record-icon">🎙️</span>
                  녹음 시작
                </button>
              ) : (
                <>
                  <div className="recording-indicator">
                    <span className="recording-dot"></span>
                    녹음 중...
                  </div>
                  <button 
                    className="recording-button stop"
                    onClick={handleStopRecording}
                  >
                    <span className="stop-icon">⏹️</span>
                    녹음 중지
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 최근 회의 목록 */}
        <div className="mobile-recent-meetings">
          <h2 className="section-title">최근 회의</h2>
          
          <div className="meeting-list">
            {recentMeetings.map((meeting) => (
              <div key={meeting.id} className="meeting-card">
                <div className="meeting-header">
                  <h3 className="meeting-title">{meeting.title}</h3>
                  <span className="meeting-date">
                    {new Date(meeting.date).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                
                <p className="meeting-summary">{meeting.summary}</p>
                
                <div className="meeting-meta">
                  <span className="meta-item">
                    <span className="meta-icon">⏱️</span>
                    {meeting.duration}
                  </span>
                  <span className="meta-item">
                    <span className="meta-icon">👥</span>
                    {meeting.participants.length}명
                  </span>
                </div>
                
                <div className="meeting-actions">
                  <button className="action-button">
                    <span>📄</span> 요약 보기
                  </button>
                  <button className="action-button">
                    <span>✅</span> 업무 확인
                  </button>
                </div>
              </div>
            ))}
          </div>
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
              <a href="/mobile/tasks" className="mobile-menu-item">
                <span className="icon">✅</span> 업무 관리
              </a>
              <a href="/mobile/meeting" className="mobile-menu-item active">
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

export default MobileMeeting;