import { useState, useEffect } from 'react';
import { Bell, Palette, Sun, Moon, Monitor, Users, Plus, Edit3, Trash2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { integrationAPI, userAPI } from '../services/api';

interface TeamMember {
  id: string; // user ID는 string
  name: string;
  role: string;
  email: string;
  phone: string;
}

const Settings = () => {
  const queryClient = useQueryClient();

  // 연동 상태 가져오기
  const { data: integrationStatus, isLoading: integrationsLoading } = useQuery({
    queryKey: ['integrationStatus'],
    queryFn: integrationAPI.getStatus
  });

  // 팀원 목록 가져오기
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const data = await userAPI.getUsers();
      console.log('🔍 API에서 받은 users 데이터:', data);
      
      // 데이터 검증
      if (!Array.isArray(data)) {
        console.error('⚠️ users 데이터가 배열이 아닙니다:', data);
        return [];
      }
      
      // 각 사용자 데이터 검증
      const validatedData = data.map((user, index) => {
        if (!user || typeof user !== 'object') {
          console.error(`⚠️ 사용자 ${index}의 데이터가 잘못되었습니다:`, user);
          return null;
        }
        
        // ID가 숫자로만 되어있는 경우 (예: 1, 2, 3)를 UUID로 매핑
        // 이것은 임시 방편이며, 실제로는 백엔드에서 올바른 ID를 반환해야 함
        if (typeof user.id === 'number' || (typeof user.id === 'string' && /^\d+$/.test(user.id))) {
          console.warn(`⚠️ 사용자 ${index}의 ID가 숫자입니다. UUID가 필요합니다:`, user.id);
        }
        
        return user;
      }).filter(user => user !== null);
      
      return validatedData;
    }
  });

  const [settings, setSettings] = useState({
    notifications: {
      push: true,
      meeting: true,
      deadline: true
    },
    appearance: {
      theme: localStorage.getItem('theme') || 'light'
    }
  });

  // 팀원 데이터 변환 (API 데이터 -> UI 형식)  
  const teamMembers: TeamMember[] = users.map((user, index) => {
    console.log(`사용자 ${index}:`, user); // 디버깅용
    console.log(`사용자 ${index} ID:`, user.id, 'ID 타입:', typeof user.id); // ID 디버깅
    
    // ID가 없거나 숫자인 경우 경고
    if (!user.id || typeof user.id === 'number') {
      console.error(`⚠️ 사용자 ${index}의 ID가 잘못되었습니다:`, user.id);
    }
    
    return {
      id: String(user.id || `temp-${index}`), // 문자열로 강제 변환
      name: user.name || '이름 없음',
      role: user.role === 'OWNER' ? '프로젝트 오너' : 
            user.role === 'ADMIN' ? '관리자' : '팀원',
      email: user.email || '',
      phone: '' // API에서 전화번호가 없으므로 빈 문자열
    };
  });

  const [showTeamMemberModal, setShowTeamMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [memberFormData, setMemberFormData] = useState({
    name: '',
    role: '',
    email: '',
    experienceLevel: 'junior',
    availableHours: 40,
    skills: [] as string[],
    preferredTypes: [] as string[]
  });

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6; // 페이지당 6명씩 표시

  // 테마 적용 함수
  const applyTheme = (theme: string) => {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      localStorage.setItem('theme', 'auto');
    }
  };

  // 테마 변경 핸들러
  const handleThemeChange = (newTheme: string) => {
    setSettings({
      ...settings,
      appearance: { ...settings.appearance, theme: newTheme }
    });
    applyTheme(newTheme);
  };

  // 컴포넌트 마운트 시 저장된 테마 적용
  useEffect(() => {
    applyTheme(settings.appearance.theme);
  }, []);

  // users 데이터 변경 시 로깅
  useEffect(() => {
    console.log('👥 Settings - users 데이터 변경됨:', users);
    console.log('👥 Settings - teamMembers 데이터:', teamMembers);
  }, [users, teamMembers]);

  // 설정 변경 시 자동 저장
  useEffect(() => {
    localStorage.setItem('settings', JSON.stringify(settings));
  }, [settings]);

  // 팀원 변경 시 자동 저장
  useEffect(() => {
    localStorage.setItem('team-members', JSON.stringify(teamMembers));
  }, [teamMembers]);

  // 팀원 관리 함수들
  const openAddMemberModal = () => {
    setEditingMember(null);
    setMemberFormData({ 
      name: '', 
      role: '', 
      email: '', 
      experienceLevel: 'junior',
      availableHours: 40,
      skills: [],
      preferredTypes: []
    });
    setShowTeamMemberModal(true);
  };

  const openEditMemberModal = (member: TeamMember) => {
    setEditingMember(member);
    // DB에서 사용자 정보 가져오기
    const user = users.find(u => u.id === member.id);
    setMemberFormData({
      name: member.name,
      role: member.role,
      email: member.email,
      experienceLevel: user?.experienceLevel || 'junior',
      availableHours: user?.availableHours || 40,
      skills: user?.skills || [],
      preferredTypes: user?.preferredTypes || []
    });
    setShowTeamMemberModal(true);
  };

  const saveMember = () => {
    if (!memberFormData.name.trim()) {
      toast.error('이름을 입력해주세요!');
      return;
    }

    if (editingMember) {
      // 수정 - editingMember.id가 이미 실제 user ID
      console.log('🔍 editingMember 전체 객체:', editingMember);
      console.log('🔍 수정할 사용자 ID:', editingMember.id);
      console.log('🔍 ID 타입:', typeof editingMember.id);
      console.log('🔍 수정 데이터:', {
        name: memberFormData.name,
        email: memberFormData.email,
        role: memberFormData.role
      });
      
      // role 값을 API 형식으로 변환
      let apiRole: 'OWNER' | 'ADMIN' | 'MEMBER' = 'MEMBER';
      
      if (memberFormData.role === '프로젝트 오너') {
        apiRole = 'OWNER';
      } else if (memberFormData.role === '관리자') {
        apiRole = 'ADMIN';
      } else {
        apiRole = 'MEMBER';
      }
      
      // API 호출
      updateUserMutation.mutate({
        userId: editingMember.id,
        updates: {
          name: memberFormData.name,
          email: memberFormData.email,
          role: apiRole,
          experienceLevel: memberFormData.experienceLevel,
          availableHours: memberFormData.availableHours,
          skills: memberFormData.skills,
          preferredTypes: memberFormData.preferredTypes
        }
      });
    } else {
      // 추가 - role 값을 API 형식으로 변환
      let apiRole: 'OWNER' | 'ADMIN' | 'MEMBER' = 'MEMBER';
      
      if (memberFormData.role === '프로젝트 오너') {
        apiRole = 'OWNER';
      } else if (memberFormData.role === '관리자') {
        apiRole = 'ADMIN';
      } else {
        apiRole = 'MEMBER';
      }
      
      // API 호출
      createUserMutation.mutate({
        name: memberFormData.name,
        email: memberFormData.email,
        role: apiRole,
        experienceLevel: memberFormData.experienceLevel,
        availableHours: memberFormData.availableHours,
        skills: memberFormData.skills,
        preferredTypes: memberFormData.preferredTypes
      });
    }

    setShowTeamMemberModal(false);
  };

  // Mutations 정의
  const createUserMutation = useMutation({
    mutationFn: userAPI.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('새 팀원이 추가되었습니다! 👤');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || '팀원 추가에 실패했습니다.');
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, updates }: { userId: string, updates: any }) => 
      userAPI.updateUser(userId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('팀원 정보가 수정되었습니다! ✏️');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || '팀원 정보 수정에 실패했습니다.');
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: userAPI.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('팀원이 삭제되었습니다! 🗑️');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || '팀원 삭제에 실패했습니다.');
    }
  });

  const deleteMember = (id: string) => {
    // id는 이미 실제 user ID
    console.log('삭제할 사용자 ID:', id);
    deleteUserMutation.mutate(id);
  };

  // 페이지네이션 계산
  const totalPages = Math.ceil(teamMembers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentMembers = teamMembers.slice(startIndex, endIndex);

  // 페이지 변경 핸들러
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="p-6 bg-gray-100 dark:bg-gray-900 h-full overflow-auto transition-colors">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">설정</h1>

        <div className="space-y-6">
          {/* Team Management */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Users className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">팀원 정보</h2>
              </div>
              <button
                onClick={openAddMemberModal}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                팀원 추가
              </button>
            </div>

            {/* 팀원 수 표시 */}
            <div className="mb-6">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                총 {teamMembers.length}명의 팀원이 있습니다.
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentMembers.map((member) => (
                <div key={member.id} className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 rounded-xl p-6 border border-gray-200 dark:border-gray-600 hover:shadow-lg hover:scale-105 transition-all duration-300">
                  <div className="flex flex-col items-center text-center space-y-3">
                    {/* 프로필 아바타 */}
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                      {member.name.charAt(0)}
                    </div>
                    
                    {/* 이름 */}
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">{member.name}</h3>
                    
                    {/* 역할 */}
                    <span className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full font-medium">
                      {member.role}
                    </span>
                    
                    {/* 이메일 */}
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 max-w-full">
                      <Mail className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{member.email}</span>
                    </div>
                    
                    {/* 액션 버튼들 */}
                    <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 w-full">
                      <button
                        onClick={() => openEditMemberModal(member)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                        수정
                      </button>
                      <button
                        onClick={() => deleteMember(member.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              
              {currentMembers.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">
                    등록된 팀원이 없습니다
                  </h3>
                  <p className="text-sm">
                    새 팀원을 추가해서 팀을 구성해보세요.
                  </p>
                </div>
              )}
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center mt-6">
                <div className="flex items-center gap-2">
                  {/* 이전 페이지 버튼 */}
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                      currentPage === 1
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    이전
                  </button>

                  {/* 페이지 번호들 */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                  {/* 다음 페이지 버튼 */}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                      currentPage === totalPages
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    다음
                  </button>
                </div>
              </div>
            )}

            {/* 페이지 정보 */}
            {totalPages > 1 && (
              <div className="text-center mt-3 text-sm text-gray-600 dark:text-gray-400">
                {currentPage} / {totalPages} 페이지 ({startIndex + 1}-{Math.min(endIndex, teamMembers.length)} / {teamMembers.length}명)
              </div>
            )}
          </div>

          {/* Notification Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 transition-colors">
            <div className="flex items-center mb-4">
              <Bell className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">알림 설정</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">푸시 알림</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">브라우저 알림 받기</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifications.push}
                  onChange={(e) => {
                    setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, push: e.target.checked }
                    });
                    toast.success(
                      e.target.checked 
                        ? '푸시 알림이 활성화되었습니다! 🔔' 
                        : '푸시 알림이 비활성화되었습니다! 🔕'
                    );
                  }}
                  className="h-4 w-4 text-blue-600 rounded"
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">회의 알림</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">회의 시작 시 알림</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifications.meeting}
                  onChange={(e) => {
                    setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, meeting: e.target.checked }
                    });
                    toast.success(
                      e.target.checked 
                        ? '회의 알림이 활성화되었습니다! 📅' 
                        : '회의 알림이 비활성화되었습니다! 📅'
                    );
                  }}
                  className="h-4 w-4 text-blue-600 rounded"
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">마감일 알림</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">업무 마감일 알림</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifications.deadline}
                  onChange={(e) => {
                    setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, deadline: e.target.checked }
                    });
                    toast.success(
                      e.target.checked 
                        ? '마감일 알림이 활성화되었습니다! ⏰' 
                        : '마감일 알림이 비활성화되었습니다! ⏰'
                    );
                  }}
                  className="h-4 w-4 text-blue-600 rounded"
                />
              </div>
            </div>
          </div>

          {/* Appearance Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 transition-colors">
            <div className="flex items-center mb-4">
              <Palette className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">화면 설정</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">테마 선택</label>
                <div className="grid grid-cols-3 gap-3">
                  {/* Light Theme */}
                  <button
                    onClick={() => handleThemeChange('light')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      settings.appearance.theme === 'light'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="flex flex-col items-center space-y-2">
                      <Sun className="w-6 h-6 text-yellow-500" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">라이트</span>
                      <div className="w-full h-2 bg-white border rounded"></div>
                    </div>
                  </button>

                  {/* Dark Theme */}
                  <button
                    onClick={() => handleThemeChange('dark')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      settings.appearance.theme === 'dark'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="flex flex-col items-center space-y-2">
                      <Moon className="w-6 h-6 text-purple-500" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">다크</span>
                      <div className="w-full h-2 bg-gray-800 border rounded"></div>
                    </div>
                  </button>

                  {/* Auto Theme */}
                  <button
                    onClick={() => handleThemeChange('auto')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      settings.appearance.theme === 'auto'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="flex flex-col items-center space-y-2">
                      <Monitor className="w-6 h-6 text-blue-500" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">자동</span>
                      <div className="w-full h-2 bg-gradient-to-r from-white to-gray-800 border rounded"></div>
                    </div>
                  </button>
                </div>
                
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {settings.appearance.theme === 'light' && '🌞 밝은 테마로 설정되었습니다.'}
                    {settings.appearance.theme === 'dark' && '🌙 어두운 테마로 설정되었습니다.'}
                    {settings.appearance.theme === 'auto' && '💻 시스템 설정에 따라 자동으로 변경됩니다.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 팀원 추가/수정 모달 */}
      {showTeamMemberModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              {editingMember ? '팀원 정보 수정' : '새 팀원 추가'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">이름 *</label>
                <input
                  type="text"
                  value={memberFormData.name}
                  onChange={(e) => setMemberFormData({...memberFormData, name: e.target.value})}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="팀원 이름을 입력하세요"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">역할</label>
                <select
                  value={memberFormData.role}
                  onChange={(e) => setMemberFormData({...memberFormData, role: e.target.value})}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">역할 선택</option>
                  <optgroup label="권한 역할">
                    <option value="프로젝트 오너">프로젝트 오너</option>
                    <option value="관리자">관리자</option>
                  </optgroup>
                  <optgroup label="직무 역할">
                    <option value="프로젝트 매니저">프로젝트 매니저</option>
                    <option value="개발자">개발자</option>
                    <option value="디자이너">디자이너</option>
                    <option value="기획자">기획자</option>
                    <option value="QA">QA</option>
                    <option value="팀원">일반 팀원</option>
                  </optgroup>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">이메일</label>
                <input
                  type="email"
                  value={memberFormData.email}
                  onChange={(e) => setMemberFormData({...memberFormData, email: e.target.value})}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="example@company.com"
                />
              </div>
              

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">경험 수준</label>
                <select
                  value={memberFormData.experienceLevel}
                  onChange={(e) => setMemberFormData({...memberFormData, experienceLevel: e.target.value})}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="junior">주니어 (1-3년)</option>
                  <option value="mid">미드 (3-7년)</option>
                  <option value="senior">시니어 (7년+)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">주간 가능 시간</label>
                <input
                  type="number"
                  value={memberFormData.availableHours}
                  onChange={(e) => setMemberFormData({...memberFormData, availableHours: Number(e.target.value)})}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="40"
                  min="0"
                  max="168"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">보유 기술</label>
                <div className="grid grid-cols-3 gap-2">
                  {['JavaScript', 'TypeScript', 'Python', 'Java', 'React', 'Vue.js', 'Node.js', 'Spring', 'Django', 'MongoDB', 'PostgreSQL', 'MySQL', 'AWS', 'Docker', 'Kubernetes', 'Git', 'AI/ML', 'Flutter', 'Swift', 'Kotlin'].map(skill => (
                    <label key={skill} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={memberFormData.skills.includes(skill)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setMemberFormData({...memberFormData, skills: [...memberFormData.skills, skill]});
                          } else {
                            setMemberFormData({...memberFormData, skills: memberFormData.skills.filter(s => s !== skill)});
                          }
                        }}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{skill}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">선호 업무</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'frontend', label: '프론트엔드 개발' },
                    { value: 'backend', label: '백엔드 개발' },
                    { value: 'fullstack', label: '풀스택 개발' },
                    { value: 'mobile', label: '모바일 개발' },
                    { value: 'design', label: 'UI/UX 디자인' },
                    { value: 'database', label: '데이터베이스 설계' },
                    { value: 'devops', label: '인프라/DevOps' },
                    { value: 'cloud', label: '클라우드 아키텍처' },
                    { value: 'data', label: '데이터 분석' },
                    { value: 'ai', label: 'AI/ML 개발' },
                    { value: 'testing', label: '테스팅/QA' },
                    { value: 'documentation', label: '문서화' },
                    { value: 'pm', label: '프로젝트 관리' },
                    { value: 'security', label: '보안' },
                    { value: 'optimization', label: '성능 최적화' }
                  ].map(type => (
                    <label key={type.value} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={memberFormData.preferredTypes.includes(type.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setMemberFormData({...memberFormData, preferredTypes: [...memberFormData.preferredTypes, type.value]});
                          } else {
                            setMemberFormData({...memberFormData, preferredTypes: memberFormData.preferredTypes.filter(t => t !== type.value)});
                          }
                        }}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{type.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowTeamMemberModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                취소
              </button>
              <button
                onClick={saveMember}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingMember ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings; 