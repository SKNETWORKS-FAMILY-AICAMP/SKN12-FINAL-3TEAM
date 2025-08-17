import React, { useState } from 'react';
import { useDrag, useDrop, DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';
import { Clock, User, AlertCircle, CheckCircle, Circle } from 'lucide-react';
import { Task } from '../../services/api';

interface MobileKanbanBoardV2Props {
  tasks: Task[];
  onStatusUpdate: (taskId: string, newStatus: string) => void;
}

const isTouchDevice = 'ontouchstart' in window;
const DndBackend = isTouchDevice ? TouchBackend : HTML5Backend;

const getPriorityColor = (priority?: string) => {
  switch (priority) {
    case 'HIGH':
    case 'high': return 'priority-high';
    case 'MEDIUM':
    case 'medium': return 'priority-medium';
    case 'LOW':
    case 'low': return 'priority-low';
    default: return 'priority-default';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending': return <Circle size={16} />;
    case 'in_progress': return <AlertCircle size={16} />;
    case 'completed': return <CheckCircle size={16} />;
    default: return <Circle size={16} />;
  }
};

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
      className={`task-card-v2 ${isDragging ? 'dragging' : ''} ${getPriorityColor(task.priority)}`}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      {task.parentId && (
        <div className="task-parent-v2">
          서브태스크
        </div>
      )}
      
      <h4 className="task-title-v2">{task.title}</h4>
      
      {task.description && (
        <p className="task-description-v2">{task.description}</p>
      )}
      
      <div className="task-meta-v2">
        {task.assignee && (
          <div className="task-meta-item">
            <User size={14} />
            <span>{typeof task.assignee === 'string' ? task.assignee : task.assignee.name}</span>
          </div>
        )}
        
        {task.dueDate && (
          <div className="task-meta-item">
            <Clock size={14} />
            <span>{new Date(task.dueDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const KanbanColumn: React.FC<{ 
  status: string; 
  title: string; 
  tasks: Task[]; 
  onStatusUpdate: (taskId: string, newStatus: string) => void;
  icon: React.ReactNode;
}> = ({ status, title, tasks, onStatusUpdate, icon }) => {
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
    <div ref={drop} className={`kanban-column-v2 ${isOver ? 'column-hover' : ''}`}>
      <div className="column-header-v2">
        <div className="column-title-group">
          {icon}
          <h3 className="column-title-v2">{title}</h3>
        </div>
        <span className="column-count">{tasks.length}</span>
      </div>
      
      <div className="column-content-v2">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onStatusUpdate={onStatusUpdate} />
          ))
        ) : (
          <div className="empty-column-v2">
            <p>No tasks</p>
          </div>
        )}
      </div>
    </div>
  );
};

const MobileKanbanBoardV2: React.FC<MobileKanbanBoardV2Props> = ({ tasks, onStatusUpdate }) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'in_progress' | 'completed'>('pending');

  const columns = {
    pending: { 
      title: 'To Do', 
      tasks: tasks.filter(t => t.status === 'pending'),
      icon: <Circle size={16} />
    },
    in_progress: { 
      title: 'In Progress', 
      tasks: tasks.filter(t => t.status === 'in_progress'),
      icon: <AlertCircle size={16} />
    },
    completed: { 
      title: 'Done', 
      tasks: tasks.filter(t => t.status === 'completed'),
      icon: <CheckCircle size={16} />
    },
  };

  return (
    <DndProvider backend={DndBackend}>
      <div className="kanban-board-v2">
        <div className="kanban-tabs-v2">
          {Object.entries(columns).map(([key, column]) => (
            <button
              key={key}
              className={`kanban-tab-v2 ${activeTab === key ? 'active' : ''}`}
              onClick={() => setActiveTab(key as any)}
            >
              {column.icon}
              <span>{column.title}</span>
              <span className="tab-count-v2">{column.tasks.length}</span>
            </button>
          ))}
        </div>

        <div className="kanban-content-v2">
          <KanbanColumn
            status={activeTab}
            title={columns[activeTab].title}
            tasks={columns[activeTab].tasks}
            onStatusUpdate={onStatusUpdate}
            icon={columns[activeTab].icon}
          />
        </div>
      </div>
    </DndProvider>
  );
};

export default MobileKanbanBoardV2;