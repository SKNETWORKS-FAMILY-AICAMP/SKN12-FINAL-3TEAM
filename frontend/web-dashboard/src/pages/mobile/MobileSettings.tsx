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

interface IntegrationStatus {
  slack: boolean;
  jira: boolean;
  notion: boolean;
}

const fetchIntegrationStatus = async (): Promise<IntegrationStatus> => {
  try {
    const response = await apiClient.get<IntegrationStatus>('/api/integrations/status');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch integration status:', error);
    return { slack: false, jira: false, notion: false };
  }
};

const MobileSettings: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // 사용자 정보 (로컬스토리지에서 가져오기)
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  // 연동 상태 가져오기
  const { data: integrationStatus } = useQuery({
    queryKey: ['integrationStatus'],
    queryFn: fetchIntegrationStatus,
  });

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('isLoggedIn');
    window.location.href = '/login';
  };

  const settingsItems = [
    {
      title: '알림 설정',
      icon: '🔔',
      items: [
        { label: '푸시 알림', type: 'toggle', value: true },
        { label: '이메일 알림', type: 'toggle', value: false },
        { label: '업무 마감일 알림', type: 'toggle', value: true },
      ]
    },
    {
      title: '연동 서비스',
      icon: '🔗',
      items: [
        { label: 'Slack 연동', type: 'status', value: integrationStatus?.slack ? '연결됨' : '미연결' },
        { label: 'JIRA 연동', type: 'status', value: integrationStatus?.jira ? '연결됨' : '미연결' },
        { label: 'Notion 연동', type: 'status', value: integrationStatus?.notion ? '연결됨' : '미연결' },
      ]
    },
    {
      title: '앱 설정',
      icon: '⚙️',
      items: [
        { label: '다크 모드', type: 'toggle', value: false },
        { label: '언어', type: 'select', value: '한국어' },
        { label: '시간대', type: 'select', value: 'KST (UTC+9)' },
      ]
    }
  ];

  return (
    <div className="mobile-dashboard">
      <MobileNavbar 
        isMenuOpen={isMenuOpen} 
        setIsMenuOpen={setIsMenuOpen}
        title="설정"
      />
      
      <div className="mobile-content">
        {/* 사용자 프로필 */}
        <div className="mobile-profile-card">
          <div className="profile-avatar">
            {user.name?.charAt(0) || 'U'}
          </div>
          <div className="profile-info">
            <h2 className="profile-name">{user.name || '사용자'}</h2>
            <p className="profile-email">{user.email || 'user@example.com'}</p>
          </div>
        </div>

        {/* 설정 섹션들 */}
        <div className="mobile-settings-sections">
          {settingsItems.map((section, index) => (
            <div key={index} className="settings-section">
              <div className="section-header">
                <span className="section-icon">{section.icon}</span>
                <h3 className="section-title">{section.title}</h3>
              </div>
              
              <div className="settings-items">
                {section.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="setting-item">
                    <span className="setting-label">{item.label}</span>
                    
                    {item.type === 'toggle' && (
                      <label className="toggle-switch">
                        <input 
                          type="checkbox" 
                          defaultChecked={item.value as boolean}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    )}
                    
                    {item.type === 'status' && (
                      <span className={`status-badge ${item.value === '연결됨' ? 'connected' : 'disconnected'}`}>
                        {item.value}
                      </span>
                    )}
                    
                    {item.type === 'select' && (
                      <span className="setting-value">
                        {item.value}
                        <span className="chevron">›</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 로그아웃 버튼 */}
        <div className="mobile-logout-section">
          <button className="logout-button" onClick={handleLogout}>
            <span className="logout-icon">🚪</span>
            로그아웃
          </button>
        </div>

        {/* 앱 정보 */}
        <div className="mobile-app-info">
          <p className="app-version">TtalKkac v1.0.0</p>
          <p className="app-copyright">© 2024 TtalKkac Team</p>
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
              <a href="/mobile/meeting" className="mobile-menu-item">
                <span className="icon">🎤</span> 회의 분석
              </a>
              <a href="/mobile/settings" className="mobile-menu-item active">
                <span className="icon">⚙️</span> 설정
              </a>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileSettings;