import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Clock, 
  User, 
  Calendar, 
  AlertCircle, 
  CheckCircle, 
  Target,
  Plus,
  MoreHorizontal 
} from 'lucide-react';
import { taskAPI, Task } from '../services/api';

interface KanbanColumn {
  id: string;
  title: string;
  status: Task['status'];
  color: string;
  bgColor: string;
  tasks: Task[];
}

const TaskCard: React.FC<{ task: Task; isDragging?: boolean }> = ({ task, isDragging }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-accent-red/10 text-accent-red border-accent-red/20';
      case 'MEDIUM':
        return 'bg-accent-amber/10 text-accent-amber border-accent-amber/20';
      case 'LOW':
        return 'bg-accent-green/10 text-accent-green border-accent-green/20';
      default:
        return 'bg-neutral-100 text-neutral-600 border-neutral-200';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ y: -2 }}
      className={`bg-white rounded-2xl p-4 shadow-soft border border-neutral-200 cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-medium ${
        isDragging || isSortableDragging ? 'opacity-50 rotate-3 scale-105' : ''
      }`}
    >
      {/* 태스크 헤더 */}
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-semibold text-neutral-900 text-sm leading-tight flex-1 pr-2">
          {task.title}
        </h4>
        <button className="text-neutral-400 hover:text-neutral-600 transition-colors">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* 태스크 설명 */}
      {task.description && (
        <p className="text-xs text-neutral-600 mb-3 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* 메타데이터 */}
      <div className="space-y-2">
        {/* 담당자 */}
        {task.assignee && (
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-brand-100 rounded-full flex items-center justify-center">
              <User className="w-3 h-3 text-brand-600" />
            </div>
            <span className="text-xs text-neutral-600 font-medium">
              {task.assignee.name}
            </span>
          </div>
        )}

        {/* 마감일과 우선순위 */}
        <div className="flex items-center justify-between">
          {/* 마감일 */}
          {task.dueDate && (
            <div className="flex items-center space-x-1">
              <Calendar className="w-3 h-3 text-neutral-400" />
              <span className="text-xs text-neutral-500">
                {formatDate(task.dueDate)}
              </span>
            </div>
          )}

          {/* 우선순위 배지 */}
          <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${getPriorityColor(task.priority)}`}>
            {task.priority === 'HIGH' ? '높음' : task.priority === 'MEDIUM' ? '중간' : '낮음'}
          </span>
        </div>

        {/* 예상 시간 */}
        {task.metadata?.estimatedHours && (
          <div className="flex items-center space-x-1">
            <Clock className="w-3 h-3 text-neutral-400" />
            <span className="text-xs text-neutral-500">
              {task.metadata.estimatedHours}시간 예상
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const KanbanColumn: React.FC<{ column: KanbanColumn; onAddTask: (columnId: string) => void }> = ({ 
  column, 
  onAddTask 
}) => {
  const {
    setNodeRef,
  } = useSortable({ id: column.id });

  const getColumnIcon = (status: Task['status']) => {
    switch (status) {
      case 'TODO':
        return <AlertCircle className="w-5 h-5" />;
      case 'IN_PROGRESS':
        return <Clock className="w-5 h-5" />;
      case 'DONE':
        return <CheckCircle className="w-5 h-5" />;
      default:
        return <Target className="w-5 h-5" />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 컬럼 헤더 */}
      <div className={`${column.bgColor} rounded-2xl p-4 mb-4 border border-opacity-20`} style={{ borderColor: column.color }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-xl ${column.bgColor.replace('/10', '/20')}`} style={{ color: column.color }}>
              {getColumnIcon(column.status)}
            </div>
            <div>
              <h3 className="font-bold text-neutral-900">{column.title}</h3>
              <p className="text-sm text-neutral-600">{column.tasks.length}개 업무</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onAddTask(column.id)}
            className="p-2 bg-white rounded-xl shadow-soft border border-neutral-200 text-neutral-600 hover:text-neutral-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* 태스크 리스트 */}
      <div ref={setNodeRef} className="flex-1 space-y-3 min-h-[200px]">
        <SortableContext items={column.tasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
          {column.tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </SortableContext>
        
        {column.tasks.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-neutral-200 rounded-2xl text-neutral-400"
          >
            <Target className="w-8 h-8 mb-2" />
            <p className="text-sm font-medium">업무가 없습니다</p>
            <p className="text-xs">새 업무를 추가해보세요</p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

const KanbanBoard: React.FC = () => {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const queryClient = useQueryClient();

  // 태스크 데이터 가져오기
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => taskAPI.getTasks(),
  });

  // 태스크 상태 업데이트 mutation
  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: Task['status'] }) =>
      taskAPI.updateTaskStatus(taskId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // 컬럼 설정
  const columns: KanbanColumn[] = [
    {
      id: 'todo',
      title: '대기 중',
      status: 'TODO',
      color: '#F59E0B',
      bgColor: 'bg-accent-amber/10',
      tasks: tasks.filter(task => task.status === 'TODO'),
    },
    {
      id: 'in-progress',
      title: '진행 중',
      status: 'IN_PROGRESS',
      color: '#3B82F6',
      bgColor: 'bg-accent-blue/10',
      tasks: tasks.filter(task => task.status === 'IN_PROGRESS'),
    },
    {
      id: 'done',
      title: '완료',
      status: 'DONE',
      color: '#10B981',
      bgColor: 'bg-accent-green/10',
      tasks: tasks.filter(task => task.status === 'DONE'),
    },
  ];

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find(t => t.id === active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveTask(null);
      return;
    }

    const activeTaskId = active.id as string;
    const overId = over.id as string;

    // 컬럼으로 드롭한 경우
    const targetColumn = columns.find(col => col.id === overId);
    if (targetColumn) {
      updateTaskMutation.mutate({
        taskId: activeTaskId,
        status: targetColumn.status,
      });
    }

    setActiveTask(null);
  };

  const handleAddTask = (columnId: string) => {
    // TODO: 새 태스크 추가 모달 열기
    console.log('Add task to column:', columnId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="loading-spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div className="h-full">
      {/* 헤더 */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">칸반 보드</h2>
        <p className="text-neutral-600">드래그 앤 드롭으로 업무 상태를 변경하세요</p>
      </motion.div>

      {/* 칸반 보드 */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
          {columns.map((column) => (
            <motion.div
              key={column.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * columns.indexOf(column) }}
              className="flex flex-col"
            >
              <KanbanColumn column={column} onAddTask={handleAddTask} />
            </motion.div>
          ))}
        </div>

        {/* 드래그 오버레이 */}
        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} isDragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default KanbanBoard;