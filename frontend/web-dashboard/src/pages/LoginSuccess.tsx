import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

const LoginSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // 이미 처리중이거나 처리됐으면 스킵
    if (localStorage.getItem('isLoggedIn') === 'true' && !searchParams.get('token')) {
      console.log('이미 로그인됨, 대시보드로 이동');
      navigate('/dashboard', { replace: true });
      return;
    }
    
    console.log('LoginSuccess 페이지 마운트됨');
    console.log('현재 URL:', window.location.href);
    console.log('Search params:', searchParams.toString());
    
    const encodedToken = searchParams.get('token');
    const isInstall = searchParams.get('install') === 'true';
    
    console.log('인코딩된 토큰 존재 여부:', !!encodedToken);
    
    if (encodedToken) {
      try {
        const token = decodeURIComponent(encodedToken);
        console.log('디코딩된 토큰:', token);
        
        // JWT 형식 토큰 파싱 (URL-safe base64 디코딩)
        const parts = token.split('.');
        console.log('토큰 파트 개수:', parts.length);
        
        if (parts.length !== 3) {
          throw new Error('잘못된 토큰 형식');
        }
        
        const [header, payload, signature] = parts;
        
        if (!payload) {
          throw new Error('토큰 payload가 없습니다');
        }
        
        // URL-safe base64를 일반 base64로 변환
        const base64 = payload
          .replace(/-/g, '+')
          .replace(/_/g, '/')
          .padEnd(payload.length + (4 - payload.length % 4) % 4, '=');
        
        const userInfo = JSON.parse(atob(base64));
        
        // localStorage에 사용자 정보 및 토큰 저장
        localStorage.setItem('user', JSON.stringify(userInfo));
        localStorage.setItem('currentUser', JSON.stringify(userInfo)); // API와 통일
        localStorage.setItem('token', token);
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('isAuthenticated', 'true'); // 추가 플래그
        
        // Go to Market으로 접근한 경우 채널 초대 메시지
        if (isInstall) {
          toast.success(`환영합니다, ${userInfo.name}님!`, {
            description: 'TtalKkak 앱이 Slack 채널에 초대되었습니다.',
            duration: 5000
          });
        } else {
          toast.success(`환영합니다, ${userInfo.name}님!`);
        }
        
        // 대시보드로 리다이렉트
        console.log('로그인 성공! 대시보드로 이동합니다.');
        console.log('저장된 사용자 정보:', userInfo);
        
        // 즉시 이동 (setTimeout 제거)
        navigate('/dashboard', { replace: true });
      } catch (error) {
        console.error('로그인 처리 실패:', error);
        toast.error('로그인 처리 중 오류가 발생했습니다.');
        navigate('/login');
      }
    } else {
      toast.error('유효하지 않은 로그인 정보입니다.');
      navigate('/login');
    }
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">로그인 처리 중...</p>
      </div>
    </div>
  );
};

export default LoginSuccess;