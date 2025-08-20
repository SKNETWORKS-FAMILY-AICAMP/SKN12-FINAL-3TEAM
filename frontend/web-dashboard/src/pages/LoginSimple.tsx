import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, User, Lock } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3500';

const LoginSimple = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      toast.error('이메일과 비밀번호를 입력해주세요');
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await axios.post<{ token: string; user: any }>(`${API_BASE_URL}/api/auth/login`, {
        email: formData.email,
        password: formData.password
      });
      
      if (response.data.token) {
        // 토큰과 사용자 정보 저장
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        localStorage.setItem('currentUser', JSON.stringify(response.data.user));
        localStorage.setItem('isLoggedIn', 'true');
        
        toast.success('로그인 성공!');
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      if (error.response?.status === 404) {
        // 사용자가 없으면 자동으로 회원가입
        try {
          const signupResponse = await axios.post<{ token: string; user: any }>(`${API_BASE_URL}/api/auth/signup`, {
            email: formData.email,
            password: formData.password,
            name: formData.email.split('@')[0], // 이메일 앞부분을 이름으로 사용
            tenantName: 'default-team'
          });
          
          if (signupResponse.data.token) {
            localStorage.setItem('token', signupResponse.data.token);
            localStorage.setItem('user', JSON.stringify(signupResponse.data.user));
            localStorage.setItem('currentUser', JSON.stringify(signupResponse.data.user));
            localStorage.setItem('isLoggedIn', 'true');
            
            toast.success('새 계정이 생성되었습니다!');
            navigate('/dashboard');
          }
        } catch (signupError: any) {
          toast.error('계정 생성에 실패했습니다');
        }
      } else {
        toast.error(error.response?.data?.error || '로그인에 실패했습니다');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 테스트 계정으로 자동 입력
  const fillTestAccount = () => {
    setFormData({
      email: 'test@example.com',
      password: 'password123'
    });
    toast.info('테스트 계정 정보가 입력되었습니다');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <span className="text-2xl font-bold text-white">TK</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">TtalKkak 로그인</h1>
          <p className="text-gray-600 mt-2">계정에 로그인하세요</p>
        </div>

        {/* 로그인 폼 */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 이메일 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이메일
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="your@email.com"
                required
              />
            </div>
          </div>

          {/* 비밀번호 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              비밀번호
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* 로그인 버튼 */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <span>로그인 중...</span>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>로그인</span>
              </>
            )}
          </button>

          {/* 테스트 계정 버튼 */}
          <button
            type="button"
            onClick={fillTestAccount}
            className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            테스트 계정 사용
          </button>
        </form>

        {/* 추가 정보 */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-center text-sm text-gray-600">
            계정이 없으신가요? 이메일과 비밀번호를 입력하면 자동으로 생성됩니다.
          </p>
        </div>

        {/* 기능 설명 */}
        <div className="mt-6 space-y-2">
          <div className="flex items-center text-sm text-gray-600">
            <span className="mr-2">✅</span>
            <span>음성 기반 프로젝트 생성</span>
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <span className="mr-2">✅</span>
            <span>AI 자동 업무 배정</span>
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <span className="mr-2">✅</span>
            <span>JIRA & Notion 자동 연동</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginSimple;