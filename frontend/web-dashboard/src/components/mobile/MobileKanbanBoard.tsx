import React, { useState } from 'react';
import { useDrag, useDrop, DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  assignee?: string;
  priority?: string;
  deadline?: string;
  parentTask?: {
    title: string;
  };
}

interface MobileKanbanBoardProps {
  tasks: Task[];
  onStatusUpdate: (taskId: string, newStatus: string) => void;
}

const isTouchDevice = 'ontouchstart' in window;
const DndBackend = isTouchDevice ? TouchBackend : HTML5Backend;

const TaskCard: React.FC<{ task: Task; onStatusUpdate: (taskId: string, newStatus: string) => void }> = ({ task, onStatusUpdate }) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'TASK',
    item: { id: task.id, status: task.status },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <div
      ref={drag}
      className={`mobile-task-card ${isDragging ? 'dragging' : ''}`}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      {task.parentTask && (
        <div className="task-parent-badge">
          {task.parentTask.title}
        </div>
      )}
      
      <h4 className="task-title">{task.title}</h4>
      
      {task.description && (
        <p className="task-description">{task.description}</p>
      )}
      
      <div className="task-meta">
        {task.assignee && (
          <span className="task-assignee">👤 {task.assignee}</span>
        )}
        
        {task.priority && (
          <span className={`task-priority priority-${task.priority}`}>
            {task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢'}
          </span>
        )}
        
        {task.deadline && (
          <span className="task-deadline">📅 {new Date(task.deadline).toLocaleDateString('ko-KR')}</span>
        )}
      </div>
    </div>
  );
};

const KanbanColumn: React.FC<{ 
  status: string; 
  title: string; 
  tasks: Task[]; 
  onStatusUpdate: (taskId: string, newStatus: string) => void 
}> = ({ status, title, tasks, onStatusUpdate }) => {
  const [{ isOver }, drop] = useDrop({
    accept: 'TASK',
    drop: (item: { id: string; status: string }) => {
      if (item.status !== status) {
        onStatusUpdate(item.id, status);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  return (
    <div ref={drop} className={`mobile-kanban-column ${isOver ? 'column-hover' : ''}`}>
      <div className="column-header">
        <h3 className="column-title">{title}</h3>
        <span className="task-count">{tasks.length}</span>
      </div>
      
      <div className="column-content">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onStatusUpdate={onStatusUpdate} />
        ))}
        
        {tasks.length === 0 && (
          <div className="empty-column">
            업무가 없습니다
          </div>
        )}
      </div>
    </div>
  );
};

const MobileKanbanBoard: React.FC<MobileKanbanBoardProps> = ({ tasks, onStatusUpdate }) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'in_progress' | 'completed'>('pending');

  const columns = {
    pending: { title: '대기 중', tasks: tasks.filter(t => t.status === 'pending') },
    in_progress: { title: '진행 중', tasks: tasks.filter(t => t.status === 'in_progress') },
    completed: { title: '완료', tasks: tasks.filter(t => t.status === 'completed') },
  };

  return (
    <DndProvider backend={DndBackend}>
      <div className="mobile-kanban-board">
        {/* 탭 네비게이션 */}
        <div className="kanban-tabs">
          <button
            className={`tab-button ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            대기 중
            <span className="tab-count">{columns.pending.tasks.length}</span>
          </button>
          <button
            className={`tab-button ${activeTab === 'in_progress' ? 'active' : ''}`}
            onClick={() => setActiveTab('in_progress')}
          >
            진행 중
            <span className="tab-count">{columns.in_progress.tasks.length}</span>
          </button>
          <button
            className={`tab-button ${activeTab === 'completed' ? 'active' : ''}`}
            onClick={() => setActiveTab('completed')}
          >
            완료
            <span className="tab-count">{columns.completed.tasks.length}</span>
          </button>
        </div>

        {/* 활성 탭의 칸반 컬럼 */}
        <div className="kanban-content">
          <KanbanColumn
            status={activeTab}
            title={columns[activeTab].title}
            tasks={columns[activeTab].tasks}
            onStatusUpdate={onStatusUpdate}
          />
        </div>

        {/* 스와이프 힌트 */}
        <div className="swipe-hint">
          좌우로 스와이프하거나 탭을 눌러 상태를 변경하세요
        </div>
      </div>
    </DndProvider>
  );
};

export default MobileKanbanBoard;