import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  Clock, 
  Target, 
  Bell,
  Volume2,
  FileText,
  LayoutDashboard,
  List,
  TrendingUp,
  Users,
  CheckCircle,
  AlertCircle,
  Plus,
  Search,
  RefreshCw
} from 'lucide-react';
import KanbanBoard from './KanbanBoard';
import { dashboardAPI, projectAPI, taskAPI, userAPI, subscribeToRealTimeUpdates } from '../services/api';

const MainContent = () => {
  const [viewMode, setViewMode] = useState<'dashboard' | 'kanban'>('dashboard');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'today' | 'week'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // React Query로 데이터 패칭
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardAPI.getStats,
    refetchInterval: 30000, // 30초마다 자동 갱신
  });

  const { data: tasks = [], isLoading: tasksLoading, refetch: refetchTasks } = useQuery({
    queryKey: ['tasks', selectedFilter],
    queryFn: () => taskAPI.getTasks(),
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: userAPI.getUsers,
  });

  // 실시간 업데이트 구독
  useEffect(() => {
    const unsubscribe = subscribeToRealTimeUpdates({
      onTaskUpdate: () => {
        refetchTasks();
        refetchStats();
      },
      onProjectCreate: () => {
        refetchStats();
      },
    });

    return unsubscribe;
  }, [refetchTasks, refetchStats]);

  // 업무 필터링
  const filteredTasks = tasks.filter(task => {
    if (searchQuery) {
      return task.title.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const completedTasks = filteredTasks.filter(task => task.status === 'DONE');
  const inProgressTasks = filteredTasks.filter(task => task.status === 'IN_PROGRESS');
  const todoTasks = filteredTasks.filter(task => task.status === 'TODO');

  // 파일 업로드 핸들러
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await projectAPI.createFromAudio(file);
      if (result.success) {
        refetchStats();
        refetchTasks();
        // 성공 알림
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  if (statsLoading || tasksLoading || usersLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center space-y-4">
          <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
          <p className="text-neutral-600 font-medium">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-neutral-50 min-h-screen">
      {/* 헤더 */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border-b border-neutral-200 px-8 py-6"
      >
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">오늘의 프로젝트 현황</h2>
            <p className="text-neutral-600 mt-1">AI 기반 실시간 업무 관리 대시보드</p>
          </div>
          
          {/* 뷰 모드 전환 */}
          <div className="flex items-center space-x-4">
            <div className="flex bg-neutral-100 rounded-2xl p-1">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setViewMode('dashboard')}
                className={`flex items-center px-4 py-2 rounded-xl transition-all duration-200 ${
                  viewMode === 'dashboard' 
                    ? 'bg-white shadow-soft text-brand-700' 
                    : 'text-neutral-600 hover:text-neutral-800'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 mr-2" />
                대시보드
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setViewMode('kanban')}
                className={`flex items-center px-4 py-2 rounded-xl transition-all duration-200 ${
                  viewMode === 'kanban' 
                    ? 'bg-white shadow-soft text-brand-700' 
                    : 'text-neutral-600 hover:text-neutral-800'
                }`}
              >
                <List className="w-4 h-4 mr-2" />
                칸반보드
              </motion.button>
            </div>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-brand-50 to-brand-100 rounded-2xl p-6 border border-brand-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-brand-700 text-sm font-semibold">총 회의 건수</p>
                <p className="text-3xl font-bold text-brand-800 mt-1">{stats?.totalMeetings || 0}건</p>
              </div>
              <div className="bg-brand-200 p-3 rounded-xl">
                <Calendar className="w-6 h-6 text-brand-700" />
              </div>
            </div>
            <div className="flex items-center mt-4">
              <TrendingUp className="w-4 h-4 text-brand-600 mr-1" />
              <span className="text-brand-600 text-sm font-medium">이번 주 +12%</span>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-accent-blue/10 to-accent-blue/20 rounded-2xl p-6 border border-accent-blue/20"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-accent-blue text-sm font-semibold">평균 요약 시간</p>
                <p className="text-3xl font-bold text-accent-blue mt-1">{stats?.averageProcessingTime || 0}초</p>
              </div>
              <div className="bg-accent-blue/20 p-3 rounded-xl">
                <Clock className="w-6 h-6 text-accent-blue" />
              </div>
            </div>
            <div className="flex items-center mt-4">
              <TrendingUp className="w-4 h-4 text-accent-blue mr-1" />
              <span className="text-accent-blue text-sm font-medium">-3초 개선</span>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-accent-green/10 to-accent-green/20 rounded-2xl p-6 border border-accent-green/20"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-accent-green text-sm font-semibold">AI 정확도</p>
                <p className="text-3xl font-bold text-accent-green mt-1">{stats?.accuracy || 0}%</p>
              </div>
              <div className="bg-accent-green/20 p-3 rounded-xl">
                <Target className="w-6 h-6 text-accent-green" />
              </div>
            </div>
            <div className="flex items-center mt-4">
              <CheckCircle className="w-4 h-4 text-accent-green mr-1" />
              <span className="text-accent-green text-sm font-medium">목표 달성</span>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-accent-purple/10 to-accent-purple/20 rounded-2xl p-6 border border-accent-purple/20"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-accent-purple text-sm font-semibold">활성 사용자</p>
                <p className="text-3xl font-bold text-accent-purple mt-1">{users.length}명</p>
              </div>
              <div className="bg-accent-purple/20 p-3 rounded-xl">
                <Users className="w-6 h-6 text-accent-purple" />
              </div>
            </div>
            <div className="flex items-center mt-4">
              <TrendingUp className="w-4 h-4 text-accent-purple mr-1" />
              <span className="text-accent-purple text-sm font-medium">접속 중 {Math.floor(users.length * 0.7)}명</span>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* 메인 콘텐츠 */}
      <div className="p-8">
        {viewMode === 'kanban' ? (
          <KanbanBoard />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
            {/* 메인 영역 */}
            <div className="xl:col-span-3 space-y-8">
              {/* 빠른 액션 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white rounded-2xl p-6 shadow-soft border border-neutral-200"
              >
                <h3 className="text-lg font-bold text-neutral-900 mb-4">빠른 액션</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <motion.label
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="relative group cursor-pointer"
                  >
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={isUploading}
                    />
                    <div className="flex flex-col items-center p-6 bg-gradient-to-br from-brand-50 to-brand-100 rounded-2xl border-2 border-dashed border-brand-300 transition-all duration-200 group-hover:border-brand-400 group-hover:shadow-medium">
                      {isUploading ? (
                        <RefreshCw className="w-8 h-8 text-brand-600 animate-spin mb-3" />
                      ) : (
                        <Volume2 className="w-8 h-8 text-brand-600 mb-3" />
                      )}
                      <span className="font-semibold text-brand-700">
                        {isUploading ? '처리 중...' : '음성 파일 업로드'}
                      </span>
                      <span className="text-sm text-brand-600 mt-1">회의록 자동 생성</span>
                    </div>
                  </motion.label>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex flex-col items-center p-6 bg-neutral-50 rounded-2xl border border-neutral-200 hover:border-neutral-300 hover:shadow-medium transition-all duration-200"
                  >
                    <FileText className="w-8 h-8 text-neutral-600 mb-3" />
                    <span className="font-semibold text-neutral-700">문서 분석</span>
                    <span className="text-sm text-neutral-500 mt-1">PDF, DOC 업로드</span>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex flex-col items-center p-6 bg-neutral-50 rounded-2xl border border-neutral-200 hover:border-neutral-300 hover:shadow-medium transition-all duration-200"
                  >
                    <Plus className="w-8 h-8 text-neutral-600 mb-3" />
                    <span className="font-semibold text-neutral-700">수동 업무 추가</span>
                    <span className="text-sm text-neutral-500 mt-1">직접 태스크 생성</span>
                  </motion.button>
                </div>
              </motion.div>

              {/* 업무 현황 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-white rounded-2xl p-6 shadow-soft border border-neutral-200"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-neutral-900">업무 현황</h3>
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                      <input
                        type="text"
                        placeholder="업무 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-neutral-200 rounded-xl focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all duration-200 text-sm"
                      />
                    </div>
                    <select
                      value={selectedFilter}
                      onChange={(e) => setSelectedFilter(e.target.value as any)}
                      className="px-4 py-2 border border-neutral-200 rounded-xl focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all duration-200 text-sm"
                    >
                      <option value="all">전체</option>
                      <option value="today">오늘</option>
                      <option value="week">이번 주</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* 완료된 업무 */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-5 h-5 text-accent-green" />
                      <h4 className="font-semibold text-neutral-700">완료 ({completedTasks.length})</h4>
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      <AnimatePresence>
                        {completedTasks.map((task, index) => (
                          <motion.div
                            key={task.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ delay: index * 0.1 }}
                            className="bg-accent-green/5 border border-accent-green/20 rounded-xl p-4 hover:shadow-soft transition-all duration-200"
                          >
                            <h5 className="font-medium text-neutral-800 text-sm">{task.title}</h5>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-neutral-500">
                                {task.assignee?.name || '담당자 없음'}
                              </span>
                              <span className="text-xs bg-accent-green/20 text-accent-green px-2 py-1 rounded-lg">
                                완료
                              </span>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* 진행 중인 업무 */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-5 h-5 text-accent-blue" />
                      <h4 className="font-semibold text-neutral-700">진행 중 ({inProgressTasks.length})</h4>
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      <AnimatePresence>
                        {inProgressTasks.map((task, index) => (
                          <motion.div
                            key={task.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ delay: index * 0.1 }}
                            className="bg-accent-blue/5 border border-accent-blue/20 rounded-xl p-4 hover:shadow-soft transition-all duration-200"
                          >
                            <h5 className="font-medium text-neutral-800 text-sm">{task.title}</h5>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-neutral-500">
                                {task.assignee?.name || '담당자 없음'}
                              </span>
                              <span className="text-xs bg-accent-blue/20 text-accent-blue px-2 py-1 rounded-lg">
                                진행중
                              </span>
                            </div>
                            {task.dueDate && (
                              <div className="mt-2">
                                <span className="text-xs text-neutral-400">
                                  마감: {new Date(task.dueDate).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* 대기 중인 업무 */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="w-5 h-5 text-accent-amber" />
                      <h4 className="font-semibold text-neutral-700">대기 중 ({todoTasks.length})</h4>
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      <AnimatePresence>
                        {todoTasks.map((task, index) => (
                          <motion.div
                            key={task.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ delay: index * 0.1 }}
                            className="bg-accent-amber/5 border border-accent-amber/20 rounded-xl p-4 hover:shadow-soft transition-all duration-200"
                          >
                            <h5 className="font-medium text-neutral-800 text-sm">{task.title}</h5>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-neutral-500">
                                {task.assignee?.name || '담당자 미배정'}
                              </span>
                              <span className="text-xs bg-accent-amber/20 text-accent-amber px-2 py-1 rounded-lg">
                                대기
                              </span>
                            </div>
                            <div className="flex items-center mt-2 space-x-1">
                              <Target className="w-3 h-3 text-neutral-400" />
                              <span className="text-xs text-neutral-400">
                                우선순위: {task.priority === 'HIGH' ? '높음' : task.priority === 'MEDIUM' ? '중간' : '낮음'}
                              </span>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* 사이드바 */}
            <div className="space-y-6">
              {/* 시스템 상태 */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 }}
                className="bg-white rounded-2xl p-6 shadow-soft border border-neutral-200"
              >
                <h3 className="font-bold text-neutral-900 mb-4 flex items-center">
                  <Bell className="w-5 h-5 mr-2 text-accent-amber" />
                  시스템 상태
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600">AI 엔진</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-accent-green rounded-full"></div>
                      <span className="text-sm font-medium text-accent-green">정상</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600">Slack 연동</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-accent-green rounded-full"></div>
                      <span className="text-sm font-medium text-accent-green">연결됨</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600">Notion 연동</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-accent-green rounded-full"></div>
                      <span className="text-sm font-medium text-accent-green">연결됨</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600">JIRA 연동</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-accent-green rounded-full"></div>
                      <span className="text-sm font-medium text-accent-green">연결됨</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* 최근 활동 */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 }}
                className="bg-white rounded-2xl p-6 shadow-soft border border-neutral-200"
              >
                <h3 className="font-bold text-neutral-900 mb-4">최근 활동</h3>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center">
                      <FileText className="w-4 h-4 text-brand-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-800">새 프로젝트 생성</p>
                      <p className="text-xs text-neutral-500 mt-1">"모바일 앱 개발" 프로젝트가 생성되었습니다</p>
                      <p className="text-xs text-neutral-400 mt-1">15분 전</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-accent-green/20 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-accent-green" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-800">업무 완료</p>
                      <p className="text-xs text-neutral-500 mt-1">김개발님이 "로그인 기능"을 완료했습니다</p>
                      <p className="text-xs text-neutral-400 mt-1">1시간 전</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-accent-blue/20 rounded-full flex items-center justify-center">
                      <Volume2 className="w-4 h-4 text-accent-blue" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-800">AI 처리 완료</p>
                      <p className="text-xs text-neutral-500 mt-1">회의록이 5개 업무로 분해되었습니다</p>
                      <p className="text-xs text-neutral-400 mt-1">2시간 전</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MainContent;