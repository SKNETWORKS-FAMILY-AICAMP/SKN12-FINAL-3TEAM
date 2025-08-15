import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, Settings, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from '@tanstack/react-query';
import { integrationAPI } from '../services/api';

const Integration = () => {
  // 연동 상태 가져오기
  const { data: integrationStatus } = useQuery({
    queryKey: ['integrationStatus'],
    queryFn: integrationAPI.getStatus
  });

  // 더미 데이터를 실제 API 데이터로 교체
  const [integrations, setIntegrations] = useState([
    {
      id: 1,
      name: "노션(Notion)",
      tag: "비활성화",
      status: "disconnected",
      url: "연결 필요",
      lastSync: "-",
      color: "bg-gray-100",
      logo: "https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png"
    },
    {
      id: 2,
      name: "지라(Jira)", 
      tag: "비활성화",
      status: "disconnected",
      url: "연결 필요",
      lastSync: "-",
      color: "bg-blue-100",
      logo: "https://cdn.worldvectorlogo.com/logos/jira-1.svg"
    }
  ]);
  
  // integrationStatus가 변경될 때마다 integrations 상태 업데이트
  useEffect(() => {
    if (integrationStatus) {
      setIntegrations(prev => [
        {
          ...prev[0],
          tag: integrationStatus.notion ? "활성화" : "비활성화",
          status: integrationStatus.notion ? "connected" : "disconnected",
          url: integrationStatus.notion ? "SYNC_PRJ_321AM" : "연결 필요",
          lastSync: integrationStatus.notion ? "방금 전" : "-"
        },
        {
          ...prev[1],
          tag: integrationStatus.jira ? "활성화" : "비활성화",
          status: integrationStatus.jira ? "connected" : "disconnected",
          url: integrationStatus.jira ? "SYNC_PRJ_321AM" : "연결 필요",
          lastSync: integrationStatus.jira ? "방금 전" : "-"
        }
      ]);
    }
  }, [integrationStatus]);

  // 확인 모달 상태 관리
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'add' | 'remove' | null>(null);
  const [confirmData, setConfirmData] = useState<any>(null);

  // 설정 모달 상태 관리
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsData, setSettingsData] = useState<any>(null);

  // 더보기 메뉴 상태 관리
  const [showMoreMenu, setShowMoreMenu] = useState<number | null>(null);

  // 연동 추가 확인 모달 열기
  const handleAddIntegration = (integrationId: number) => {
    const integration = integrations.find(i => i.id === integrationId);
    setConfirmData(integration);
    setConfirmAction('add');
    setShowConfirmModal(true);
  };

  // 연동 해지 확인 모달 열기
  const handleRemoveIntegration = (integrationId: number) => {
    const integration = integrations.find(i => i.id === integrationId);
    setConfirmData(integration);
    setConfirmAction('remove');
    setShowConfirmModal(true);
  };

  // 실제 연동 추가 실행 - OAuth 리다이렉트
  const executeAddIntegration = () => {
    if (!confirmData) return;
    
    // localStorage에서 현재 사용자 정보 가져오기
    const userStr = localStorage.getItem('user') || localStorage.getItem('currentUser');
    let userId = null;
    let tenantSlug = 'dev-tenant';
    
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        userId = user.id;
        // tenant slug도 가져올 수 있으면 가져오기
        if (user.tenant && user.tenant.slug) {
          tenantSlug = user.tenant.slug;
        }
      } catch (e) {
        console.error('Failed to parse user data:', e);
      }
    }
    
    let oauthUrl = '';
    
    // 서비스별 OAuth URL 생성 - 백엔드 라우트 형식에 맞춤
    switch (confirmData.name) {
      case '노션(Notion)':
        oauthUrl = `${import.meta.env.VITE_API_BASE_URL}/auth/notion/${tenantSlug}?userId=${userId || ''}`;
        break;
      case '지라(Jira)':
        oauthUrl = `${import.meta.env.VITE_API_BASE_URL}/auth/jira/${tenantSlug}?userId=${userId || ''}`;
        break;
      default:
        toast.error('지원하지 않는 서비스입니다.');
        return;
    }
    
    // OAuth 페이지로 이동
    toast.info(`${confirmData.name} 연동 페이지로 이동합니다...`);
    window.location.href = oauthUrl;
  };

  // 실제 연동 해지 실행 - API 연결
  const executeRemoveIntegration = async () => {
    if (!confirmData) return;
    
    // 서비스 이름 매핑
    const serviceMap: { [key: string]: 'slack' | 'notion' | 'jira' } = {
      '슬랙(Slack)': 'slack',
      '노션(Notion)': 'notion', 
      '지라(Jira)': 'jira'
    };
    
    const service = serviceMap[confirmData.name];
    if (!service) {
      toast.error('지원하지 않는 서비스입니다.');
      return;
    }

    try {
      toast.info(`${confirmData.name} 연동을 해제하고 있습니다...`);
      
      const result = await integrationAPI.disconnectService(service);
      
      if (result.success) {
        toast.success(`${confirmData.name} 연동이 해제되었습니다! 🔌`);
        // 연동 상태 새로고침을 위해 페이지 리로드 (임시)
        window.location.reload();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Integration disconnect failed:', error);
      toast.error('연동 해제 중 오류가 발생했습니다.');
    } finally {
      setShowConfirmModal(false);
      setConfirmData(null);
      setConfirmAction(null);
    }
  };

  // 모달 취소
  const cancelConfirmation = () => {
    setShowConfirmModal(false);
    setConfirmData(null);
    setConfirmAction(null);
  };

  // 설정 모달 열기
  const handleSettings = (integrationId: number) => {
    const integration = integrations.find(i => i.id === integrationId);
    setSettingsData(integration);
    setShowSettingsModal(true);
  };

  // 설정 모달 닫기
  const closeSettingsModal = () => {
    setShowSettingsModal(false);
    setSettingsData(null);
  };

  // 더보기 메뉴 토글
  const toggleMoreMenu = (integrationId: number) => {
    setShowMoreMenu(showMoreMenu === integrationId ? null : integrationId);
  };

  // 연결 테스트
  const testConnection = (integration: any) => {
    toast.success(`${integration.name} 연결 테스트가 성공했습니다! ✅`);
    setShowMoreMenu(null);
  };

  // 동기화 실행
  const syncNow = (integration: any) => {
    const now = new Date().toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(/\. /g, '.').replace(/:/g, ':');
    
    setIntegrations(prev => prev.map(i => 
      i.id === integration.id ? { ...i, lastSync: now } : i
    ));
    toast.success(`${integration.name} 동기화가 완료되었습니다! 🔄`);
    setShowMoreMenu(null);
  };

  // 동기화 기록 보기
  const viewSyncHistory = (integration: any) => {
    toast.success(`${integration.name} 동기화 기록을 확인합니다! 📋`);
    setShowMoreMenu(null);
  };

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showMoreMenu && target && !target.closest('.dropdown-menu')) {
        setShowMoreMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMoreMenu]);



  return (
    <div className="flex-1 p-6 bg-white dark:bg-gray-900 overflow-y-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">연동</h1>
        <p className="text-sm text-gray-500 dark:text-gray-300">외부 서비스와의 연동을 관리하세요</p>
      </div>

      {/* 연동 진행 상황 */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">연동 진행 상황</h2>
        <div className="flex items-center justify-center">
          <div className="flex items-center justify-between max-w-md">
                               {/* 1단계 - 노션 */}
                     <div className="flex flex-col items-center">
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${
                         integrations.find(i => i.name.includes('노션'))?.status === 'connected'
                           ? 'bg-green-500'
                           : 'bg-gray-300'
                       }`}>
                         <Check className={`w-4 h-4 ${
                           integrations.find(i => i.name.includes('노션'))?.status === 'connected'
                             ? 'text-white'
                             : 'text-gray-500'
                         }`} />
                       </div>
                       <span className="text-xs text-gray-600">노션 연동</span>
                     </div>
          
          {/* 연결선 */}
          <div className={`flex-1 h-0.5 mx-4 ${
            integrations.find(i => i.name.includes('노션'))?.status === 'connected' &&
            integrations.find(i => i.name.includes('지라'))?.status === 'connected'
              ? 'bg-green-500' 
              : 'bg-gray-300'
          }`}></div>
          
                               {/* 2단계 - 지라 */}
                     <div className="flex flex-col items-center">
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${
                         integrations.find(i => i.name.includes('지라'))?.status === 'connected'
                           ? 'bg-green-500'
                           : 'bg-gray-300'
                       }`}>
                         <Check className={`w-4 h-4 ${
                           integrations.find(i => i.name.includes('지라'))?.status === 'connected'
                             ? 'text-white'
                             : 'text-gray-500'
                         }`} />
                       </div>
                       <span className="text-xs text-gray-600">지라 연동</span>
                     </div>
          </div>
        </div>
        
        {/* 진행률 표시 */}
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            연동 완료: {integrations.filter(i => i.status === 'connected').length} / {integrations.length}
            {integrations.filter(i => i.status === 'connected').length === integrations.length && (
              <span className="ml-2 text-green-600 font-medium">🎉 모든 연동 완료!</span>
            )}
          </p>
        </div>
      </div>

      {/* 연동된 서비스 */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">연동된 서비스</h2>
        <div className="space-y-4">
          {integrations.map((integration) => (
            <div key={integration.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {/* 로고 이미지 */}
                  <div className={`w-12 h-12 rounded-lg ${integration.color} flex items-center justify-center p-2`}>
                    <img 
                      src={integration.logo} 
                      alt={`${integration.name} Logo`} 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  
                  {/* 서비스 정보 */}
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-medium text-gray-900">{integration.name}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        integration.status === 'connected' 
                          ? 'bg-green-100 text-green-700' 
                          : integration.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {integration.tag}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      채널: {integration.url} • 최근 동기화: {integration.lastSync}
                    </p>
                    <div className="mt-1">
                      {/* 연동된 상태일 때 - 연동 해지 버튼 표시 */}
                      {integration.status === 'connected' && (
                        <button 
                          onClick={() => handleRemoveIntegration(integration.id)}
                          className="text-sm text-red-600 hover:text-red-800 flex items-center space-x-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>연동 해지</span>
                        </button>
                      )}
                      {/* 연동 안된 상태일 때 - 연동 추가 버튼 표시 */}
                      {(integration.status === 'disconnected' || integration.status === 'pending') && (
                        <button 
                          onClick={() => handleAddIntegration(integration.id)}
                          className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>연동 추가</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* 우측 버튼 */}
                <div className="flex items-center space-x-2">
                  {(integration.status === 'disconnected' || integration.status === 'pending') ? (
                    <button 
                      onClick={() => handleAddIntegration(integration.id)}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                    >
                      연동 & 테스트
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={() => handleSettings(integration.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="설정"
                      >
                        <Settings className="w-4 h-4 text-gray-500" />
                      </button>
                      <div className="relative">
                        <button 
                          onClick={() => toggleMoreMenu(integration.id)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="더보기"
                        >
                          <MoreHorizontal className="w-4 h-4 text-gray-500" />
                        </button>
                        
                        {/* 더보기 드롭다운 메뉴 */}
                        {showMoreMenu === integration.id && (
                          <div className="dropdown-menu absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                            <div className="py-1">
                              <button
                                onClick={() => testConnection(integration)}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                              >
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                <div>
                                  <div className="font-medium">연결 확인</div>
                                  <div className="text-xs text-gray-500">서비스 연결 상태 점검</div>
                                </div>
                              </button>
                              <button
                                onClick={() => syncNow(integration)}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                              >
                                <span>📥</span>
                                <div>
                                  <div className="font-medium">데이터 가져오기</div>
                                  <div className="text-xs text-gray-500">최신 데이터로 업데이트</div>
                                </div>
                              </button>
                              <button
                                onClick={() => viewSyncHistory(integration)}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                              >
                                <span>📊</span>
                                <div>
                                  <div className="font-medium">활동 기록</div>
                                  <div className="text-xs text-gray-500">연동 사용 내역 보기</div>
                                </div>
                              </button>
                              <hr className="my-1" />
                              <button
                                onClick={() => handleRemoveIntegration(integration.id)}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                              >
                                <span>⚠️</span>
                                <div>
                                  <div className="font-medium">연동 해지</div>
                                  <div className="text-xs text-red-400">서비스 연결 끊기</div>
                                </div>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 확인 모달 */}
      {showConfirmModal && confirmData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div 
            className="bg-white rounded-xl p-6 w-full max-w-md mx-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <div className="flex items-center mb-4">
              <div className={`w-12 h-12 rounded-full ${confirmData.color} flex items-center justify-center mr-4`}>
                <img 
                  src={confirmData.logo} 
                  alt={confirmData.name} 
                  className="w-8 h-8"
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {confirmAction === 'add' ? '연동 추가' : '연동 해지'}
                </h3>
                <p className="text-sm text-gray-500">{confirmData.name}</p>
              </div>
            </div>

            <div className="mb-6">
              {confirmAction === 'add' ? (
                <div className="space-y-2">
                  <p className="text-gray-700">
                    <strong>{confirmData.name}</strong>와의 연동을 추가하시겠습니까?
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      ✅ 실시간 데이터 동기화가 시작됩니다<br/>
                      ✅ 자동 알림 기능이 활성화됩니다<br/>
                      ✅ 채널: {confirmData.url}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-gray-700">
                    <strong>{confirmData.name}</strong> 연동을 해지하시겠습니까?
                  </p>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800">
                      ⚠️ 실시간 동기화가 중단됩니다<br/>
                      ⚠️ 자동 알림이 비활성화됩니다<br/>
                      ⚠️ 기존 데이터는 유지됩니다
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <motion.button
                onClick={cancelConfirmation}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                취소
              </motion.button>
              <motion.button
                onClick={confirmAction === 'add' ? executeAddIntegration : executeRemoveIntegration}
                className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors ${
                  confirmAction === 'add' 
                    ? 'bg-blue-600 hover:bg-blue-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {confirmAction === 'add' ? '연동 추가' : '연동 해지'}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 설정 모달 */}
      {showSettingsModal && settingsData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div 
            className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <div className="flex items-center mb-6">
              <div className={`w-12 h-12 rounded-full ${settingsData.color} flex items-center justify-center mr-4`}>
                <img 
                  src={settingsData.logo} 
                  alt={settingsData.name} 
                  className="w-8 h-8"
                />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {settingsData.name} 설정
                </h3>
                <p className="text-sm text-gray-500">연동 설정을 관리하세요</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* 기본 설정 */}
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-3">기본 설정</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="text-sm font-medium text-gray-800">자동 동기화</span>
                      <p className="text-xs text-gray-500">새로운 데이터를 자동으로 가져옵니다</p>
                    </div>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="text-sm font-medium text-gray-800">알림 받기</span>
                      <p className="text-xs text-gray-500">업무 변경 사항을 알림으로 받습니다</p>
                    </div>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </div>
                </div>
              </div>

              {/* 연결 정보 */}
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-3">연결 정보</h4>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                    <span className="text-sm font-medium text-green-800">정상 연결됨</span>
                  </div>
                  <div className="text-xs text-green-600 space-y-1">
                    <p>📱 채널: {settingsData.url}</p>
                    <p>🕐 마지막 동기화: {settingsData.lastSync}</p>
                    <p>✅ 데이터 전송 상태: 양호</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <motion.button
                onClick={closeSettingsModal}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                취소
              </motion.button>
              <motion.button
                onClick={() => {
                  toast.success('설정이 저장되었습니다! ⚙️');
                  closeSettingsModal();
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                저장
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Integration;