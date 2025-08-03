import { Link, useLocation } from 'react-router-dom';
import { Home, MessageSquare, FileText, Settings, ChevronRight } from 'lucide-react';

interface SidebarProps {
  setActiveMenu: (menu: string) => void;
}

const Sidebar = ({ setActiveMenu }: SidebarProps) => {
  const location = useLocation();
  
  const menuItems = [
    { 
      id: 'home', 
      icon: Home, 
      label: '대시보드', 
      path: '/',
      description: '전체 현황 보기'
    },
    { 
      id: 'meeting', 
      icon: MessageSquare, 
      label: '회의 분석', 
      path: '/meeting',
      description: '회의록 및 인사이트'
    },
    { 
      id: 'task', 
      icon: FileText, 
      label: '업무 관리', 
      path: '/task',
      description: '프로젝트 및 태스크'
    },
    { 
      id: 'settings', 
      icon: Settings, 
      label: '설정', 
      path: '/settings',
      description: '시스템 설정'
    },
  ];

  const getActiveMenu = () => {
    const currentPath = location.pathname;
    const currentItem = menuItems.find(item => item.path === currentPath);
    return currentItem?.id || 'home';
  };

  return (
    <div className="w-72 bg-gradient-to-br from-brand-50 to-brand-100 border-r border-brand-200 min-h-screen relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute -top-4 -left-4 w-24 h-24 bg-brand-300 rounded-full blur-xl"></div>
        <div className="absolute top-32 -right-8 w-32 h-32 bg-brand-400 rounded-full blur-2xl"></div>
        <div className="absolute bottom-24 -left-8 w-28 h-28 bg-brand-500 rounded-full blur-xl"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 p-6 border-b border-brand-200/50">
        <div className="flex items-center space-x-3">
          {/* Logo Icon */}
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-300 to-brand-500 rounded-xl flex items-center justify-center shadow-soft">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 3 L15 8 L21 8 L16.5 12 L18 18 L12 15 L6 18 L7.5 12 L3 8 L9 8 Z" fill="white" stroke="none"/>
                <path d="M15 11 L21 11 L18 14 Z" fill="#4A5D3A" stroke="none"/>
              </svg>
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-brand-400 rounded-full animate-pulse"></div>
          </div>
          
          {/* Logo Text */}
          <div>
            <h1 className="text-xl font-bold text-neutral-800 tracking-tight">TtalKkak</h1>
            <p className="text-xs text-neutral-600 font-medium">AI 프로젝트 관리</p>
          </div>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="relative z-10 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = getActiveMenu() === item.id;
          
          return (
            <Link
              key={item.id}
              to={item.path}
              onClick={() => setActiveMenu(item.id)}
              className={`group relative w-full flex items-center p-4 rounded-2xl transition-all duration-200 ${
                isActive 
                  ? 'bg-white shadow-medium text-brand-700 scale-[1.02]' 
                  : 'text-neutral-700 hover:bg-white/50 hover:shadow-soft hover:scale-[1.01]'
              }`}
            >
              {/* Active Indicator */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-brand-400 to-brand-600 rounded-r-full"></div>
              )}
              
              {/* Icon Container */}
              <div className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors duration-200 ${
                isActive 
                  ? 'bg-brand-100 text-brand-600' 
                  : 'bg-neutral-100 text-neutral-500 group-hover:bg-brand-50 group-hover:text-brand-500'
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              
              {/* Content */}
              <div className="ml-4 flex-1">
                <div className="flex items-center justify-between">
                  <span className={`font-semibold text-sm ${
                    isActive ? 'text-brand-700' : 'text-neutral-700'
                  }`}>
                    {item.label}
                  </span>
                  <ChevronRight className={`w-4 h-4 transition-all duration-200 ${
                    isActive 
                      ? 'text-brand-500 translate-x-0 opacity-100' 
                      : 'text-neutral-400 -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
                  }`} />
                </div>
                <p className={`text-xs mt-0.5 ${
                  isActive ? 'text-brand-600' : 'text-neutral-500'
                }`}>
                  {item.description}
                </p>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        {/* Status Indicator */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-brand-200/50 shadow-soft">
          <div className="flex items-center space-x-3">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-accent-green rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-brand-400 rounded-full animate-pulse delay-100"></div>
              <div className="w-2 h-2 bg-accent-blue rounded-full animate-pulse delay-200"></div>
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-700">시스템 정상</p>
              <p className="text-xs text-neutral-500">모든 서비스 연결됨</p>
            </div>
          </div>
        </div>

        {/* Version Info */}
        <div className="mt-3 text-center">
          <p className="text-xs text-neutral-400 font-medium">TtalKkak v1.0.0</p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;