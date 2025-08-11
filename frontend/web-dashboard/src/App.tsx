import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';
import Login from './pages/Login';
import LoginSuccess from './pages/LoginSuccess';
import MeetingAnalysis from './pages/MeetingAnalysis';
import TaskManagement from './pages/TaskManagement';
import Settings from './pages/Settings';
import IntegrationSuccess from './pages/JiraSuccess';
import NotionSuccess from './pages/NotionSuccess';
import Integration from './pages/Integration';
import ProtectedRoute from './components/ProtectedRoute';
import { connectSocket, disconnectSocket } from './services/api';
import './App.css';

// React Query 클라이언트 설정
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5분
    },
    mutations: {
      retry: 1,
    },
  },
});

function App() {
  // 앱 시작 시 Socket 연결 (임시 비활성화 - tenant 문제)
  useEffect(() => {
    console.log('App 컴포넌트 마운트됨');
    console.log('현재 경로:', window.location.pathname);
    // Socket.IO 연결 임시 비활성화
    // TODO: tenant 미들웨어 문제 해결 후 재활성화
    /*
    const socket = connectSocket();
    
    socket.on('connect', () => {
      console.log('✅ Socket.IO 연결됨');
    });
    
    socket.on('disconnect', () => {
      console.log('❌ Socket.IO 연결 해제됨');
    });

    socket.on('connect_error', (error) => {
      console.error('Socket.IO 연결 오류:', error);
    });

    // 클린업
    return () => {
      disconnectSocket();
    };
    */
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="App min-h-screen bg-neutral-50 font-sans antialiased">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/test" element={<div>테스트 페이지입니다</div>} />
            <Route path="/dashboard" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="meeting" element={<MeetingAnalysis />} />
              <Route path="task" element={<TaskManagement />} />
              <Route path="integration" element={<Integration />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="/login" element={<Login />} />
            <Route path="/login/success" element={<LoginSuccess />} />
            <Route path="/integration-success" element={<IntegrationSuccess />} />
            <Route path="/jira-success" element={<IntegrationSuccess />} />
            <Route path="/notion-success" element={<NotionSuccess />} />

          </Routes>
          <Toaster
            toastOptions={{
              duration: 4000,
              style: {
                background: 'white',
                color: '#374151',
                border: '1px solid #E5E7EB',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '500',
              },
              classNames: {
                success: 'border-l-4 border-accent-green',
                error: 'border-l-4 border-accent-red',
              },
            }}
          />
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App; 