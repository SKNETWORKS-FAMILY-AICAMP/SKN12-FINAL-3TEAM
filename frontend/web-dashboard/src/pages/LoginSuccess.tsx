import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

const LoginSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const isInstall = searchParams.get('install') === 'true';
    
    if (token) {
      try {
        // JWT 형식 토큰 파싱
        const [header, payload, signature] = token.split('.');
        const userInfo = JSON.parse(atob(payload));
        
        // localStorage에 사용자 정보 및 토큰 저장
        localStorage.setItem('user', JSON.stringify(userInfo));
        localStorage.setItem('token', token);
        localStorage.setItem('isLoggedIn', 'true');
        
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
        setTimeout(() => {
          navigate('/dashboard');
        }, 1000);
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