import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Menu, Bell, ChevronDown, LayoutGrid, CheckSquare, Mic, Settings, LogOut, Home } from 'lucide-react';
import MobileNavbarV2 from '../../components/mobile/MobileNavbarV2';
import MobileKanbanBoardV2 from '../../components/mobile/MobileKanbanBoardV2';
import '../../styles/mobile-v2.css';

// API 기본 설정
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3500';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Tenant-Slug': 'default',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const fetchProjects = async () => {
  const response = await apiClient.get('/api/projects');
  return response.data;
};

const fetchTasks = async (projectId?: string) => {
  const url = projectId ? `/api/tasks?projectId=${projectId}` : '/api/tasks';
  const response = await apiClient.get(url);
  return response.data;
};

const updateTaskStatus = async (taskId: string, status: string) => {
  const response = await apiClient.patch(`/api/tasks/${taskId}/status`, { status });
  return response.data;
};

const MobileDashboardV2: React.FC = () => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  const { data: tasks = [], isLoading: tasksLoading, refetch } = useQuery({
    queryKey: ['tasks', selectedProjectId],
    queryFn: () => fetchTasks(selectedProjectId === 'all' ? undefined : selectedProjectId),
  });

  const handleStatusUpdate = async (taskId: string, newStatus: string) => {
    try {
      await updateTaskStatus(taskId, newStatus);
      refetch();
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  useEffect(() => {
    const viewport = document.querySelector('meta[name=viewport]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
    }
  }, []);

  if (projectsLoading || tasksLoading) {
    return (
      <div className="mobile-loading-v2">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading dashboard...</p>
      </div>
    );
  }

  const menuItems = [
    { icon: Home, label: 'Dashboard', href: '/mobile', active: true },
    { icon: CheckSquare, label: 'Tasks', href: '/mobile/tasks', active: false },
    { icon: Mic, label: 'Meetings', href: '/mobile/meeting', active: false },
    { icon: Settings, label: 'Settings', href: '/mobile/settings', active: false },
  ];

  return (
    <div className="mobile-dashboard-v2">
      <MobileNavbarV2 
        isMenuOpen={isMenuOpen} 
        setIsMenuOpen={setIsMenuOpen}
        title="TtalKkac"
      />
      
      <div className="mobile-content-v2">
        {/* Project Selector */}
        <div className="project-selector-v2">
          <label className="selector-label-v2">Current Project</label>
          <div className="selector-wrapper-v2">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="project-select-v2"
            >
              <option value="all">All Projects</option>
              {projects.map((project: any) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <ChevronDown className="select-icon-v2" size={20} />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid-v2">
          <div className="stat-card-v2">
            <div className="stat-value">{tasks.filter((t: any) => t.status === 'pending').length}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card-v2">
            <div className="stat-value">{tasks.filter((t: any) => t.status === 'in_progress').length}</div>
            <div className="stat-label">In Progress</div>
          </div>
          <div className="stat-card-v2">
            <div className="stat-value">{tasks.filter((t: any) => t.status === 'completed').length}</div>
            <div className="stat-label">Completed</div>
          </div>
        </div>
        
        {/* Kanban Board */}
        <MobileKanbanBoardV2
          tasks={tasks}
          onStatusUpdate={handleStatusUpdate}
        />
      </div>

      {/* Side Menu */}
      {isMenuOpen && (
        <div className="mobile-menu-overlay-v2" onClick={() => setIsMenuOpen(false)}>
          <div className="mobile-menu-v2" onClick={(e) => e.stopPropagation()}>
            <div className="menu-header-v2">
              <div className="menu-logo">
                <div className="logo-icon">T</div>
                <span className="logo-text">TtalKkac</span>
              </div>
            </div>
            
            <nav className="menu-nav-v2">
              {menuItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <a
                    key={index}
                    href={item.href}
                    className={`menu-item-v2 ${item.active ? 'active' : ''}`}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </nav>

            <div className="menu-footer-v2">
              <button className="logout-btn-v2">
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileDashboardV2;