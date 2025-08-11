import { Navigate } from 'react-router-dom';
import { ReactNode, useState, useEffect } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  
  useEffect(() => {
    // 세션 확인
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const token = localStorage.getItem('token');
    
    console.log('ProtectedRoute 체크:', { 
      isLoggedIn, 
      hasToken: !!token,
      tokenValue: token,
      currentPath: window.location.pathname
    });
    
    // 토큰 유효성 검사 (간단한 버전)
    if (token && isLoggedIn) {
      try {
        const parts = token.split('.');
        
        if (parts.length !== 3) {
          console.error('토큰 형식 오류: 파트 개수가 3개가 아님');
          throw new Error('Invalid token format');
        }
        
        const [header, payload, signature] = parts;
        
        if (!payload) {
          console.error('토큰 payload가 없음');
          throw new Error('Missing payload');
        }
        
        // URL-safe base64를 일반 base64로 변환
        const base64 = payload
          .replace(/-/g, '+')
          .replace(/_/g, '/')
          .padEnd(payload.length + (4 - payload.length % 4) % 4, '=');
        
        const decoded = JSON.parse(atob(base64));
        console.log('토큰 디코딩 성공:', decoded);
        
        // 토큰 만료 확인
        if (decoded.exp && decoded.exp < Date.now() / 1000) {
          console.error('토큰 만료됨:', new Date(decoded.exp * 1000));
          setIsAuthenticated(false);
          return;
        }
        
        console.log('토큰 검증 성공, 대시보드 접근 허용');
        setIsAuthenticated(true);
      } catch (error) {
        console.error('토큰 파싱 실패:', error);
        console.error('문제가 된 토큰:', token);
        setIsAuthenticated(false);
      }
    } else {
      console.log('로그인 안됨 또는 토큰 없음');
      setIsAuthenticated(false);
    }
  }, []);
  
  // 인증 상태 확인 중
  if (isAuthenticated === null) {
    return <div>인증 확인 중...</div>;
  }
  
  // 인증되지 않은 경우 로그인 페이지로 리다이렉트
  if (!isAuthenticated) {
    console.log('인증 실패 - 로그인 페이지로 리다이렉트');
    return <Navigate to="/login" replace />;
  }
  
  // 인증된 경우 자식 컴포넌트 렌더링
  console.log('인증 성공 - 대시보드 렌더링');
  return <>{children}</>;
};

export default ProtectedRoute;