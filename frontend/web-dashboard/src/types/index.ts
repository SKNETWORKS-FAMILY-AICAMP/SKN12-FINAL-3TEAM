export interface MeetingStats {
  totalMeetings: number;
  avgOnlineTime: number;
  accuracy: number;
}

export interface Task {
  id: string;
  title: string;
  dueDate: string;
  status: 'completed' | 'inProgress' | 'scheduled';
  priority?: 'high' | 'medium' | 'low';
}

export interface TaskItem {
  id: string;
  title: string;
  date: string;
  category: 'completed' | 'inProgress' | 'scheduled';
}

export interface DetailedTask {
  id: number;
  name: string;
  assignee: string;
  dueDate: string;
  status: '완료' | '진행 중' | '예정';
  statusColor: string;
  priority: '높음' | '중간' | '낮음';
  description: string;
}

export interface MeetingFilters {
  meetingName: string;
  date: string;
  participants: string;
}

export interface TaskFilters {
  assignee: string;
  status: string;
  priority: string;
  search: string;
}

export interface Notification {
  id: string;
  message: string;
  type: 'warning' | 'info' | 'error';
}

export interface RecentSummary {
  id: string;
  title: string;
  date: string;
  taskCount: number;
}

export interface User {
  id: string;
  name: string;
  role: string;
  avatar?: string;
}

export interface DashboardData {
  meetingStats: MeetingStats;
  tasks: TaskItem[];
  notifications: Notification[];
  recentSummaries: RecentSummary[];
  user: User;
} 