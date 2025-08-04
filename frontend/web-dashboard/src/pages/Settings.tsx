import { useState, useEffect } from 'react';
import { Bell, Palette, Sun, Moon, Monitor, Users, Plus, Edit3, Trash2, Mail } from 'lucide-react';
import { toast } from 'sonner';

interface TeamMember {
  id: number;
  name: string;
  role: string;
  email: string;
  phone: string;
  department: string;
}

const Settings = () => {
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

  // 팀원 관리 상태
  const defaultTeamMembers: TeamMember[] = [
    { id: 1, name: '김미정', role: '프로젝트 매니저', email: 'kim.mijung@company.com', phone: '', department: '개발팀' },
    { id: 2, name: '이철수', role: '시니어 개발자', email: 'lee.cheolsu@company.com', phone: '', department: '개발팀' },
    { id: 3, name: '박영희', role: 'UI/UX 디자이너', email: 'park.younghee@company.com', phone: '', department: '디자인팀' },
    { id: 4, name: '정수민', role: '데이터 분석가', email: 'jung.sumin@company.com', phone: '', department: '데이터팀' },
    { id: 5, name: '최민수', role: '프론트엔드 개발자', email: 'choi.minsu@company.com', phone: '', department: '개발팀' },
    { id: 6, name: '한지영', role: '백엔드 개발자', email: 'han.jiyoung@company.com', phone: '', department: '개발팀' },
    { id: 7, name: '송민호', role: 'DevOps 엔지니어', email: 'song.minho@company.com', phone: '', department: '개발팀' },
    { id: 8, name: '윤서연', role: '그래픽 디자이너', email: 'yoon.seoyeon@company.com', phone: '', department: '디자인팀' },
    { id: 9, name: '임동현', role: '브랜드 디자이너', email: 'lim.donghyun@company.com', phone: '', department: '디자인팀' },
    { id: 10, name: '강수진', role: '시각 디자이너', email: 'kang.sujin@company.com', phone: '', department: '디자인팀' },
    { id: 11, name: '조현우', role: '데이터 엔지니어', email: 'jo.hyunwoo@company.com', phone: '', department: '데이터팀' },
    { id: 12, name: '백지원', role: '머신러닝 엔지니어', email: 'baek.jiwon@company.com', phone: '', department: '데이터팀' },
    { id: 13, name: '오태현', role: '마케팅 매니저', email: 'oh.taehyun@company.com', phone: '', department: '마케팅팀' },
    { id: 14, name: '신유진', role: '콘텐츠 마케터', email: 'shin.yujin@company.com', phone: '', department: '마케팅팀' },
    { id: 15, name: '류승민', role: '디지털 마케터', email: 'ryu.seungmin@company.com', phone: '', department: '마케팅팀' },
    { id: 16, name: '남궁지은', role: '기획팀장', email: 'namgung.jieun@company.com', phone: '', department: '기획팀' },
    { id: 17, name: '전우진', role: '서비스 기획자', email: 'jeon.woojin@company.com', phone: '', department: '기획팀' },
    { id: 18, name: '홍길동', role: '운영 매니저', email: 'hong.gildong@company.com', phone: '', department: '운영팀' },
    { id: 19, name: '김철수', role: '고객지원팀장', email: 'kim.cheolsu@company.com', phone: '', department: '운영팀' },
    { id: 20, name: '이영희', role: '운영팀원', email: 'lee.younghee@company.com', phone: '', department: '운영팀' },
  ];

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() => {
    const savedMembers = localStorage.getItem('team-members');
    return savedMembers ? JSON.parse(savedMembers) : defaultTeamMembers;
  });

  const [showTeamMemberModal, setShowTeamMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [memberFormData, setMemberFormData] = useState({
    name: '',
    role: '',
    email: '',
    department: ''
  });

  // 필터링 및 페이지네이션 상태
  const [selectedDepartment, setSelectedDepartment] = useState<string>('전체');
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
    setMemberFormData({ name: '', role: '', email: '', department: '' });
    setShowTeamMemberModal(true);
  };

  const openEditMemberModal = (member: TeamMember) => {
    setEditingMember(member);
    setMemberFormData({
      name: member.name,
      role: member.role,
      email: member.email,
      department: member.department
    });
    setShowTeamMemberModal(true);
  };

  const saveMember = () => {
    if (!memberFormData.name.trim()) {
      toast.error('이름을 입력해주세요!');
      return;
    }

    if (editingMember) {
      // 수정
      setTeamMembers(prev => 
        prev.map(member => 
          member.id === editingMember.id 
            ? { ...member, ...memberFormData }
            : member
        )
      );
      toast.success('팀원 정보가 수정되었습니다! ✏️');
    } else {
      // 추가
      const newMember: TeamMember = {
        id: Math.max(...teamMembers.map(m => m.id)) + 1,
        ...memberFormData,
        phone: ''
      };
      setTeamMembers(prev => [...prev, newMember]);
      toast.success('새 팀원이 추가되었습니다! 👤');
    }

    setShowTeamMemberModal(false);
  };

  const deleteMember = (id: number) => {
    setTeamMembers(prev => prev.filter(member => member.id !== id));
    toast.success('팀원이 삭제되었습니다! 🗑️');
  };

  // 필터링된 팀원 목록
  const filteredMembers = teamMembers.filter(member => 
    selectedDepartment === '전체' || member.department === selectedDepartment
  );

  // 페이지네이션 계산
  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentMembers = filteredMembers.slice(startIndex, endIndex);

  // 부서 목록 (중복 제거)
  const departments = ['전체', ...Array.from(new Set(teamMembers.map(member => member.department)))];

  // 페이지 변경 핸들러
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // 부서 필터 변경 핸들러
  const handleDepartmentChange = (department: string) => {
    setSelectedDepartment(department);
    setCurrentPage(1); // 필터 변경 시 첫 페이지로 이동
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

            {/* 부서 필터 */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">부서별 필터:</span>
                <div className="flex flex-wrap gap-2">
                  {departments.map((dept) => (
                    <button
                      key={dept}
                      onClick={() => handleDepartmentChange(dept)}
                      className={`px-3 py-1 text-sm rounded-full transition-colors ${
                        selectedDepartment === dept
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                총 {filteredMembers.length}명의 팀원이 있습니다.
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
                    
                    {/* 부서 */}
                    <span className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
                      {member.department}
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
                    {filteredMembers.length === 0 ? '등록된 팀원이 없습니다' : '해당 부서의 팀원이 없습니다'}
                  </h3>
                  <p className="text-sm">
                    {filteredMembers.length === 0 ? '새 팀원을 추가해서 팀을 구성해보세요.' : '다른 부서를 선택해보세요.'}
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
                {currentPage} / {totalPages} 페이지 ({startIndex + 1}-{Math.min(endIndex, filteredMembers.length)} / {filteredMembers.length}명)
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
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
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
                <input
                  type="text"
                  value={memberFormData.role}
                  onChange={(e) => setMemberFormData({...memberFormData, role: e.target.value})}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="예: 프로젝트 매니저, 개발자"
                />
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">부서</label>
                <select
                  value={memberFormData.department}
                  onChange={(e) => setMemberFormData({...memberFormData, department: e.target.value})}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">부서 선택</option>
                  <option value="개발팀">개발팀</option>
                  <option value="디자인팀">디자인팀</option>
                  <option value="데이터팀">데이터팀</option>
                  <option value="마케팅팀">마케팅팀</option>
                  <option value="기획팀">기획팀</option>
                  <option value="운영팀">운영팀</option>
                </select>
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