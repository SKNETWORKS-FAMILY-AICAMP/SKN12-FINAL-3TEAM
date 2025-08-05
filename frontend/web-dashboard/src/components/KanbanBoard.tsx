import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

interface DragState {
  activeTaskId: string | null;
  overColumnId: string | null;
  insertPosition: number; // 삽입될 위치 인덱스
  isValidDrop: boolean;
}


// 드래그 중 공간을 만들어주는 Placeholder 컴포넌트 (완전히 새로운 버전)
const DragPlaceholder: React.FC<{ 
  isVisible: boolean;
  taskHeight?: number;
}> = ({ isVisible, taskHeight = 100 }) => {
  console.log('🎯 DragPlaceholder 렌더링:', { isVisible, taskHeight });
  
  return (
    <motion.div
      layout
      initial={{ height: 0, opacity: 0, marginBottom: 0 }}
      animate={{ 
        height: isVisible ? taskHeight : 0,
        opacity: isVisible ? 0.8 : 0,
        marginBottom: isVisible ? 12 : 0,
      }}
      exit={{ height: 0, opacity: 0, marginBottom: 0 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 25,
        duration: 0.3,
      }}
      className="w-full bg-gradient-to-br from-blue-50 via-blue-100 to-blue-50 border-2 border-dashed border-blue-400 rounded-2xl flex items-center justify-center overflow-hidden"
      style={{
        boxShadow: isVisible ? '0 8px 25px rgba(59, 130, 246, 0.25)' : 'none',
        backdropFilter: isVisible ? 'blur(1px)' : 'none',
      }}
    >
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center space-x-2 text-blue-600 font-medium text-sm"
        >
          <motion.div
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.7, 1, 0.7]
            }}
            transition={{ 
              duration: 1.5, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="w-2 h-2 bg-blue-500 rounded-full"
          />
          <span>여기에 놓으세요</span>
        </motion.div>
      )}
    </motion.div>
  );
};

const TaskCard: React.FC<{ 
  task: Task; 
  isDragging?: boolean;
  dragState?: DragState;
  index: number;
  columnId: string;
  onDragStart?: (task: Task, index: number) => void;
  onDragEnd?: (task: Task) => void;
  onDragOver?: (e: React.DragEvent, task: Task, index: number) => void;
}> = ({ task, isDragging, dragState, index, columnId, onDragStart, onDragEnd, onDragOver }) => {
  
  // 이 태스크가 다른 태스크를 위해 자리를 만들어줘야 하는지 계산
  const shouldMakeSpace = dragState && 
    dragState.activeTaskId && 
    dragState.activeTaskId !== task.id && 
    dragState.overColumnId === columnId &&
    index >= dragState.insertPosition;
    
  console.log('🎯 TaskCard 렌더링:', {
    taskTitle: task.title,
    index,
    shouldMakeSpace,
    insertPosition: dragState?.insertPosition,
    activeTaskId: dragState?.activeTaskId,
    overColumnId: dragState?.overColumnId,
    currentColumnId: columnId,
    isDragActive: !!dragState?.activeTaskId
  });

  const handleDragStart = (e: React.DragEvent) => {
    console.log('🎯 드래그 시작:', task.title);
    e.dataTransfer.setData('text/plain', JSON.stringify({ taskId: task.id, index, columnId }));
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.(task, index);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    console.log('🎯 드래그 종료:', task.title);
    onDragEnd?.(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onDragOver?.(e, task, index);
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
      layout
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      initial={{ opacity: 0, y: 20 }}
      animate={{ 
        opacity: 1,
        y: shouldMakeSpace ? 35 : 0,
        scale: shouldMakeSpace ? 0.95 : 1,
        rotateX: shouldMakeSpace ? 5 : 0,
      }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ 
        y: shouldMakeSpace ? 35 : -4, 
        scale: shouldMakeSpace ? 0.95 : 1.03,
        transition: { duration: 0.2 }
      }}
      whileTap={{ scale: 0.95 }}
      transition={{
        type: "spring",
        stiffness: 500,
        damping: 30,
        duration: 0.25,
      }}
      className={`bg-white rounded-2xl p-4 shadow-soft border border-neutral-200 cursor-grab active:cursor-grabbing transition-all duration-300 hover:shadow-medium ${
        isDragging ? 'opacity-90 rotate-1 scale-105 shadow-xl z-50 ring-2 ring-blue-400' : ''
      } ${shouldMakeSpace ? 'shadow-sm transform-gpu bg-gray-50 border-gray-300' : ''}`}
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

        {/* 마감일 */}
        {task.dueDate && (
          <div className="flex items-center space-x-1">
            <Calendar className="w-3 h-3 text-neutral-400" />
            <span className="text-xs text-neutral-500">
              {formatDate(task.dueDate)}
            </span>
          </div>
        )}

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

const KanbanColumn: React.FC<{ 
  column: KanbanColumn; 
  onAddTask: (columnId: string) => void;
  isOver?: boolean;
  dragState?: DragState;
  onDrop?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onTaskDragStart?: (task: Task, index: number) => void;
  onTaskDragEnd?: (task: Task) => void;
  onTaskDragOver?: (e: React.DragEvent, task: Task, index: number) => void;
}> = ({ 
  column, 
  onAddTask,
  isOver = false,
  dragState,
  onDrop,
  onDragOver,
  onTaskDragStart,
  onTaskDragEnd,
  onTaskDragOver
}) => {

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
      <div className={`${column.bgColor} rounded-2xl p-4 mb-4 border border-opacity-20 transition-all duration-200 ${
        isOver ? 'ring-2 ring-offset-2 ring-blue-400 scale-105' : ''
      }`} style={{ borderColor: column.color }}>
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
      <div 
        onDrop={onDrop}
        onDragOver={onDragOver}
        data-column-id={column.id}
        className={`flex-1 space-y-3 min-h-[200px] transition-all duration-200 rounded-2xl p-2 ${
          isOver ? 'bg-blue-50 border-2 border-dashed border-blue-300' : ''
        }`}
      >
        <motion.div layout className="space-y-3">
            {column.tasks.map((task, index) => {
              // 삽입 위치에 Placeholder 보여주기
              const shouldShowPlaceholderBefore = 
                dragState?.overColumnId === column.id && 
                dragState.insertPosition === index;
                
              console.log('🔍 태스크 렌더링:', {
                taskTitle: task.title,
                index,
                insertPosition: dragState?.insertPosition,
                overColumnId: dragState?.overColumnId,
                shouldShowPlaceholderBefore
              });
              
              return (
                <React.Fragment key={task.id}>
                  {/* 삽입 위치에 Placeholder 표시 */}
                  {shouldShowPlaceholderBefore && (
                    <DragPlaceholder isVisible={true} />
                  )}
                  
                  <TaskCard 
                    task={task}
                    isDragging={dragState?.activeTaskId === task.id}
                    dragState={dragState}
                    index={index}
                    columnId={column.id}
                    onDragStart={onTaskDragStart}
                    onDragEnd={onTaskDragEnd}
                    onDragOver={onTaskDragOver}
                  />
                </React.Fragment>
              );
            })}
            
            {/* 마지막에 삽입하는 경우 */}
            {dragState?.overColumnId === column.id && 
             dragState.insertPosition === column.tasks.length && (
              <DragPlaceholder isVisible={true} />
            )}
          </motion.div>
        
        {column.tasks.length === 0 && dragState?.overColumnId === column.id && (
          <DragPlaceholder isVisible={true} taskHeight={140} />
        )}
        
        {column.tasks.length === 0 && dragState?.overColumnId !== column.id && (
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
  const [dragState, setDragState] = useState<DragState>({
    activeTaskId: null,
    overColumnId: null,
    insertPosition: 0,
    isValidDrop: false,
  });
  const queryClient = useQueryClient();

  // 임시 mock 데이터 (백엔드 없을 때)
  const mockTasks: Task[] = [
    {
      id: 'task-1',
      title: '사용자 인증 시스템 구현',
      description: 'JWT 기반 로그인/로그아웃 기능 구현',
      status: 'TODO',
      priority: 'high',
      createdAt: new Date().toISOString(),
      assignee: { id: 'user-1', name: '김개발', email: 'dev@example.com' },
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: { estimatedHours: 8 }
    },
    {
      id: 'task-2', 
      title: '데이터베이스 스키마 설계',
      description: '사용자, 태스크, 프로젝트 테이블 설계',
      status: 'TODO',
      priority: 'medium',
      createdAt: new Date().toISOString(),
      assignee: { id: 'user-2', name: '박디비', email: 'db@example.com' },
      metadata: { estimatedHours: 4 }
    },
    {
      id: 'task-3',
      title: 'API 엔드포인트 개발',
      description: 'RESTful API 구현 및 문서화',
      status: 'IN_PROGRESS',
      priority: 'high', 
      createdAt: new Date().toISOString(),
      assignee: { id: 'user-1', name: '김개발', email: 'dev@example.com' },
      metadata: { estimatedHours: 12 }
    },
    {
      id: 'task-4',
      title: '프론트엔드 컴포넌트 개발',
      description: 'React 컴포넌트 및 스타일링',
      status: 'DONE',
      priority: 'medium',
      createdAt: new Date().toISOString(),
      assignee: { id: 'user-3', name: '이프론트', email: 'front@example.com' },
      metadata: { estimatedHours: 16 }
    }
  ];

  // 태스크 데이터 가져오기 (백엔드 연결 시에는 주석 해제)
  const { data: fetchedTasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => taskAPI.getTasks(),
    enabled: false, // 백엔드가 없으므로 비활성화
  });

  // 백엔드가 없으면 mock 데이터 사용
  const tasks = fetchedTasks.length > 0 ? fetchedTasks : mockTasks;

  // 태스크 상태 업데이트 mutation (임시로 비활성화)
  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: Task['status'] }) => {
      console.log(`태스크 ${taskId} 상태를 ${status}로 변경`);
      return Promise.resolve(); // 임시로 성공 반환
    },
    onSuccess: () => {
      console.log('태스크 상태 업데이트 성공 (mock)');
      // queryClient.invalidateQueries({ queryKey: ['tasks'] }); // 백엔드 연결 시 활성화
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

  // 네이티브 HTML5 드래그앤드롭 핸들러들
  const handleTaskDragStart = (task: Task, index: number) => {
    setActiveTask(task);
    setDragState(prev => ({
      ...prev,
      activeTaskId: task.id,
    }));
    console.log('🎯 네이티브 드래그 시작:', task.title);
  };

  const handleTaskDragEnd = (task: Task) => {
    console.log('🎯 네이티브 드래그 종료:', task.title);
  };

  const handleTaskDragOver = (e: React.DragEvent, task: Task, index: number) => {
    e.preventDefault();
    
    // 현재 컬럼 찾기
    const targetColumn = columns.find(col => 
      col.tasks.some(t => t.id === task.id)
    );
    
    if (!targetColumn || !dragState.activeTaskId) return;
    
    // 마우스 위치 기반으로 삽입 위치 계산
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mouseY = e.clientY;
    const elementTop = rect.top;
    const elementHeight = rect.height;
    const relativeY = mouseY - elementTop;
    const isAbove = relativeY < elementHeight / 2;
    
    const insertPosition = isAbove ? index : index + 1;
    
    setDragState(prev => ({
      ...prev,
      overColumnId: targetColumn.id,
      insertPosition,
      isValidDrop: true,
    }));
    
    console.log('🎯 네이티브 드래그 오버:', {
      targetTask: task.title,
      index,
      insertPosition,
      isAbove,
      column: targetColumn.title
    });
  };

  const handleColumnDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleColumnDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    
    if (!data) return;
    
    try {
      const { taskId, index: sourceIndex, columnId: sourceColumnId } = JSON.parse(data);
      const targetColumnId = (e.currentTarget as HTMLElement).dataset.columnId;
      
      if (!targetColumnId) return;
      
      const activeTask = tasks.find(t => t.id === taskId);
      const targetColumn = columns.find(col => col.id === targetColumnId);
      
      if (activeTask && targetColumn) {
        console.log('✅ 네이티브 드롭 완료:', {
          taskTitle: activeTask.title,
          fromColumn: sourceColumnId,
          toColumn: targetColumnId,
          insertPosition: dragState.insertPosition
        });
        
        // 상태 변경
        if (activeTask.status !== targetColumn.status) {
          updateTaskMutation.mutate({
            taskId: taskId,
            status: targetColumn.status,
          });
        }
      }
    } catch (error) {
      console.error('드롭 데이터 파싱 실패:', error);
    }
    
    // 드래그 상태 초기화
    setActiveTask(null);
    setDragState({
      activeTaskId: null,
      overColumnId: null,
      insertPosition: 0,
      isValidDrop: false,
    });
  };

  const handleAddTask = (columnId: string) => {
    // TODO: 새 태스크 추가 모달 열기
    console.log('Add task to column:', columnId);
  };

  if (isLoading && fetchedTasks.length === 0 && mockTasks.length === 0) {
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

      {/* 칸반 보드 - 네이티브 HTML5 드래그앤드롭 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
        {columns.map((column) => (
          <motion.div
            key={column.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * columns.indexOf(column) }}
            className="flex flex-col"
          >
            <KanbanColumn 
              column={column} 
              onAddTask={handleAddTask}
              isOver={dragState.overColumnId === column.id}
              dragState={dragState}
              onDrop={handleColumnDrop}
              onDragOver={handleColumnDragOver}
              onTaskDragStart={handleTaskDragStart}
              onTaskDragEnd={handleTaskDragEnd}
              onTaskDragOver={handleTaskDragOver}
            />
          </motion.div>
        ))}
      </div>

      {/* 드래그 오버레이 - 네이티브 구현 */}
      {activeTask && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed top-0 left-0 pointer-events-none z-50"
          style={{
            transform: 'translate(-50%, -50%)',
          }}
        >
          <TaskCard 
            task={activeTask} 
            isDragging={true} 
            index={-1} 
            columnId="overlay" 
          />
        </motion.div>
      )}
    </div>
  );
};

export default KanbanBoard;