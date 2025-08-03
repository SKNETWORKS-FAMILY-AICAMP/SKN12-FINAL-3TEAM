import { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { DetailedTask, TaskFilters } from '../types';

const TaskManagement = () => {
  const [filters, setFilters] = useState<TaskFilters>({
    assignee: '담당자',
    status: '상태',
    priority: '우선순위',
    search: ''
  });

  const [selectedTask, setSelectedTask] = useState<DetailedTask | null>(null);

  const tasks: DetailedTask[] = [
    { 
      id: 1, 
      name: 'd', 
      assignee: '텍스트', 
      dueDate: '텍스트', 
      status: '완료',
      statusColor: 'bg-green-500 text-white',
      priority: '높음',
      description: '업무 상세 내용이 여기에 표시됩니다.'
    },
    { 
      id: 2, 
      name: '', 
      assignee: '텍스트', 
      dueDate: '텍스트', 
      status: '진행 중',
      statusColor: 'bg-blue-500 text-white',
      priority: '중간',
      description: '진행 중인 업무의 상세 정보입니다.'
    },
    { 
      id: 3, 
      name: '', 
      assignee: '', 
      dueDate: '', 
      status: '예정',
      statusColor: 'bg-orange-500 text-white',
      priority: '낮음',
      description: '예정된 업무에 대한 설명입니다.'
    }
  ];

  const todayTasks = [
    '마감 임박',
    '지연 업무'
  ];

  const handleTaskClick = (task: DetailedTask) => {
    setSelectedTask(task);
  };

  return (
    <div className="flex h-full bg-gray-100">
      {/* Main Content */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold mb-6">업무 관리</h1>
          
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <select 
              value={filters.assignee}
              onChange={(e) => setFilters({...filters, assignee: e.target.value})}
              className="px-4 py-2 border border-gray-300 rounded-md bg-white"
            >
              <option>담당자</option>
              <option>김미정</option>
              <option>이철수</option>
              <option>박영희</option>
            </select>
            
            <select 
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="px-4 py-2 border border-gray-300 rounded-md bg-white"
            >
              <option>상태</option>
              <option>완료</option>
              <option>진행 중</option>
              <option>예정</option>
            </select>
            
            <select 
              value={filters.priority}
              onChange={(e) => setFilters({...filters, priority: e.target.value})}
              className="px-4 py-2 border border-gray-300 rounded-md bg-white"
            >
              <option>우선순위</option>
              <option>높음</option>
              <option>중간</option>
              <option>낮음</option>
            </select>
            
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="업무 검색..."
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-md pr-10"
              />
              <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
            </div>
            
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-2">
              <Plus className="w-4 h-4" />
              새 업무
            </button>
          </div>
        </div>

        {/* Task Table */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-4 gap-4 p-4 bg-gray-200 rounded-t-md font-medium text-gray-700">
            <div>업무명</div>
            <div>담당자</div>
            <div>마감일</div>
            <div>상태</div>
          </div>
          
          <div className="divide-y divide-gray-200">
            {tasks.map((task) => (
              <div 
                key={task.id} 
                className="grid grid-cols-4 gap-4 p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => handleTaskClick(task)}
              >
                <div className="text-sm">{task.name}</div>
                <div className="text-sm">{task.assignee}</div>
                <div className="text-sm">{task.dueDate}</div>
                <div>
                  <span className={`px-2 py-1 text-xs rounded-full ${task.statusColor}`}>
                    {task.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">오늘의 할 일</h3>
            <div className="space-y-2">
              {todayTasks.map((task, index) => (
                <div key={index} className="text-sm text-gray-600">
                  - {task}
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">업무 상태 알림</h3>
            <div className="space-y-2">
              <div className="text-sm text-gray-600">- 마감 임박</div>
              <div className="text-sm text-gray-600">- 지연 업무</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Task Details */}
      <div className="w-80 bg-white shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4">업무 상세 정보</h3>
        
        {selectedTask ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">업무내용</label>
              <div className="text-sm text-gray-600">{selectedTask.name || '업무명 없음'}</div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">진행 상황</label>
              <span className={`px-2 py-1 text-xs rounded-full ${selectedTask.statusColor}`}>
                {selectedTask.status}
              </span>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">코멘트</label>
              <div className="text-sm text-gray-600">{selectedTask.description}</div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">첨부 파일</label>
              <div className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center text-sm text-gray-500">
                파일을 드래그하거나 클릭하여 업로드
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 mt-8">
            업무를 선택하면 상세 정보가 표시됩니다.
          </div>
        )}
        
        <div className="mt-8">
          <h4 className="text-md font-semibold mb-4">추가 기능 공간</h4>
          <div className="space-y-2">
            <button className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm">
              업무 캘린더 보기
            </button>
            <button className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm">
              팀원 업무 분배 현황
            </button>
            <div className="text-sm text-gray-600 mt-4">
              업무 캘린더 or 팀원 업무 분배 현황
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskManagement; 