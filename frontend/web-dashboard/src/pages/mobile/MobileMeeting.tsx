import React, { useState } from 'react';
import MobileNavbar from '../../components/mobile/MobileNavbar';
import '../../styles/mobile.css';
import '../../styles/mobile-pages.css';

const MobileMeeting: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const handleStartRecording = () => {
    setIsRecording(true);
    // 실제 녹음 로직 구현
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    // 실제 녹음 중지 로직 구현
  };

  // 더미 데이터
  const recentMeetings = [
    {
      id: 1,
      title: '프로젝트 킥오프 미팅',
      date: '2024-01-15',
      duration: '45분',
      participants: ['김철수', '이영희', '박민수'],
      summary: '프로젝트 목표 및 일정 논의'
    },
    {
      id: 2,
      title: '주간 스프린트 회의',
      date: '2024-01-10',
      duration: '30분',
      participants: ['김철수', '이영희'],
      summary: '주간 진행 상황 공유 및 이슈 논의'
    },
  ];

  return (
    <div className="mobile-dashboard">
      <MobileNavbar 
        isMenuOpen={isMenuOpen} 
        setIsMenuOpen={setIsMenuOpen}
        title="회의 분석"
      />
      
      <div className="mobile-content">
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