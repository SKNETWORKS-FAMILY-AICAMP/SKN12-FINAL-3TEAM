import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  // 세션 확인
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  const token = localStorage.getItem('token');
  
  // 토큰 유효성 검사 (간단한 버전)
  if (token) {
    try {
      const [header, payload, signature] = token.split('.');
      const decoded = JSON.parse(atob(payload));
      
      // 토큰 만료 확인
      if (decoded.exp && decoded.exp < Date.now() / 1000) {
        // 토큰 만료됨
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return <Navigate to="/login" replace />;
      }
    } catch (error) {
      // 토큰 파싱 실패
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return <Navigate to="/login" replace />;
    }
  }
  
  if (!isLoggedIn || !token) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

export default ProtectedRoute;