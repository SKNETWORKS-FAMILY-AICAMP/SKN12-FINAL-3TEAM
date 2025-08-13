const axios = require('axios');

const API_URL = 'http://localhost:3500';

// 오늘 날짜 기준으로 테스트 업무 생성
async function createTestTasks() {
  const today = new Date();
  const tasks = [];
  
  // 다양한 날짜에 업무 생성
  for (let i = -5; i <= 10; i++) {
    const dueDate = new Date(today);
    dueDate.setDate(today.getDate() + i);
    const dueDateStr = dueDate.toISOString().split('T')[0];
    
    // 각 날짜에 1-2개의 업무 생성
    const taskCount = Math.random() > 0.5 ? 2 : 1;
    
    for (let j = 0; j < taskCount; j++) {
      const taskTypes = [
        { title: '회의 준비', description: '주간 회의 자료 준비' },
        { title: '코드 리뷰', description: 'PR 리뷰 및 피드백 작성' },
        { title: '문서 작성', description: '기술 문서 업데이트' },
        { title: '버그 수정', description: '긴급 버그 수정 작업' },
        { title: '기능 개발', description: '새로운 기능 구현' },
        { title: '테스트 작성', description: '유닛 테스트 작성' },
        { title: '배포 준비', description: '프로덕션 배포 준비' },
        { title: '미팅 참석', description: '클라이언트 미팅 참석' }
      ];
      
      const randomTask = taskTypes[Math.floor(Math.random() * taskTypes.length)];
      const statuses = ['TODO', 'IN_PROGRESS', 'DONE'];
      const priorities = ['LOW', 'MEDIUM', 'HIGH'];
      
      // 과거 날짜는 완료 상태로, 미래는 랜덤하게
      let status = statuses[Math.floor(Math.random() * statuses.length)];
      if (i < -2) {
        status = Math.random() > 0.3 ? 'DONE' : 'IN_PROGRESS';
      } else if (i > 5) {
        status = 'TODO';
      }
      
      tasks.push({
        title: `${randomTask.title} - ${dueDateStr.slice(5)}`,
        description: `${randomTask.description} (${dueDateStr})`,
        status: status,
        priority: priorities[Math.floor(Math.random() * priorities.length)],
        dueDate: dueDateStr
      });
    }
  }
  
  console.log(`Creating ${tasks.length} test tasks...`);
  
  // API 호출하여 업무 생성
  let successCount = 0;
  let failCount = 0;
  
  for (const task of tasks) {
    try {
      const response = await axios.post(`${API_URL}/api/tasks`, task, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 200 || response.status === 201) {
        successCount++;
        console.log(`✅ Created: ${task.title} (${task.dueDate})`);
      }
    } catch (error) {
      failCount++;
      console.error(`❌ Failed to create: ${task.title}`, error.response?.data?.error || error.message);
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`✅ Successfully created: ${successCount} tasks`);
  console.log(`❌ Failed: ${failCount} tasks`);
  console.log(`\n🔍 View tasks in the calendar at: http://localhost:3000/task-management`);
}

// 실행
createTestTasks().catch(console.error);