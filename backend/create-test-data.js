// DB에 직접 테스트 데이터 생성
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestData() {
  try {
    console.log('=== 테스트 데이터 생성 시작 ===\n');
    
    // 1. Tenant 확인/생성
    let tenant = await prisma.tenant.findUnique({
      where: { slug: 'dev-tenant' }
    });
    
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          name: 'Dev Tenant',
          slug: 'dev-tenant'
        }
      });
      console.log('✅ Tenant 생성:', tenant.id);
    } else {
      console.log('✅ Tenant 존재:', tenant.id);
    }
    
    // 2. User 확인/생성
    let user = await prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        slackUserId: 'U123456'
      }
    });
    
    if (!user) {
      user = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: 'test@example.com',
          name: 'Test User',
          slackUserId: 'U123456'
        }
      });
      console.log('✅ User 생성:', user.id);
    } else {
      console.log('✅ User 존재:', user.id);
    }
    
    // 3. SlackInput 생성
    const slackInput = await prisma.slackInput.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        channelId: 'C123456',
        messageType: 'COMMAND',
        status: 'COMPLETED',
        rawContent: '테스트 회의록',
        processedContent: {
          summary: 'AI 기반 프로젝트 관리 시스템 구축',
          tasks: []
        }
      }
    });
    console.log('✅ SlackInput 생성:', slackInput.id);
    
    // 4. Project 생성
    const project = await prisma.project.create({
      data: {
        tenantId: tenant.id,
        slackInputId: slackInput.id,
        title: 'AI 테스트 프로젝트',
        overview: 'AI 서버 파이프라인을 통해 생성된 프로젝트입니다.',
        content: {
          notion_project: {
            title: 'AI 테스트 프로젝트',
            overview: 'WhisperX + BERT + Qwen 통합 파이프라인 테스트',
            objectives: ['음성 인식 정확도 향상', 'BERT 필터링 효과 검증'],
            key_deliverables: ['회의록 자동 생성', 'Task 자동 생성']
          },
          prd: {
            title: 'Task Master PRD',
            overview: '프로젝트 요구사항 정의서',
            user_stories: []
          },
          generated_tasks: []
        },
        notionStatus: 'pending'
      }
    });
    console.log('✅ Project 생성:', project.id);
    
    // 5. Tasks 생성
    const tasks = [
      {
        title: 'Data Review and Cleaning',
        description: 'Review the generated transcript data and clean up any inconsistencies or errors.',
        priority: 'HIGH',
        estimatedHours: 8
      },
      {
        title: 'System Integration and Backend Connection',
        description: 'Connect the AI system with backend services and ensure proper data flow.',
        priority: 'HIGH',
        estimatedHours: 16
      },
      {
        title: 'QA and Final Testing',
        description: 'Perform comprehensive testing of the entire pipeline.',
        priority: 'MEDIUM',
        estimatedHours: 12
      },
      {
        title: 'Documentation and Knowledge Transfer',
        description: 'Create detailed documentation for the system.',
        priority: 'LOW',
        estimatedHours: 6
      },
      {
        title: 'Deployment and Monitoring Setup',
        description: 'Deploy the system to production and set up monitoring.',
        priority: 'HIGH',
        estimatedHours: 10
      }
    ];
    
    const createdTasks = [];
    for (const [index, taskData] of tasks.entries()) {
      const task = await prisma.task.create({
        data: {
          tenantId: tenant.id,
          projectId: project.id,
          taskNumber: `TK-${Date.now()}-${index + 1}`,
          title: taskData.title,
          description: taskData.description,
          status: 'TODO',
          priority: taskData.priority,
          assigneeId: user.id,
          metadata: {
            create: {
              estimatedHours: taskData.estimatedHours,
              actualHours: 0,
              labels: ['ai-generated', '2-stage-pipeline'],
              customFields: {}
            }
          }
        }
      });
      createdTasks.push(task);
      console.log(`✅ Task ${index + 1} 생성: ${task.title}`);
      
      // Subtasks 생성 (첫 번째 태스크에만)
      if (index === 0) {
        const subtasks = [
          { title: 'Identify data inconsistencies', hours: 3 },
          { title: 'Clean transcript segments', hours: 3 },
          { title: 'Validate BERT filtering results', hours: 2 }
        ];
        
        for (const [subIndex, subtask] of subtasks.entries()) {
          const sub = await prisma.task.create({
            data: {
              tenantId: tenant.id,
              projectId: project.id,
              taskNumber: `TK-${Date.now()}-${index + 1}-${subIndex + 1}`,
              title: subtask.title,
              description: '',
              status: 'TODO',
              priority: 'MEDIUM',
              assigneeId: user.id,
              parentId: task.id, // 부모 태스크 연결
              metadata: {
                create: {
                  estimatedHours: subtask.hours,
                  actualHours: 0,
                  labels: ['subtask'],
                  customFields: {}
                }
              }
            }
          });
          console.log(`  ✅ Subtask ${subIndex + 1} 생성: ${sub.title}`);
        }
      }
    }
    
    // 6. Meeting Note 생성
    const meetingNote = await prisma.meetingNote.create({
      data: {
        tenantId: tenant.id,
        projectId: project.id,
        userId: user.id,
        content: {
          summary: 'AI 파이프라인 테스트 회의',
          transcript: 'WhisperX로 변환된 회의 내용...',
          filtered_transcript: 'BERT로 필터링된 내용 (75.3% 노이즈 제거)...',
          action_items: tasks.map(t => ({ task: t.title, priority: t.priority })),
          decisions: ['2단계 파이프라인 사용 결정', 'BERT 필터링 적용'],
          next_steps: ['파이프라인 성능 모니터링', '실사용자 피드백 수집']
        },
        meetingDate: new Date()
      }
    });
    console.log('✅ Meeting Note 생성:', meetingNote.id);
    
    console.log('\n=== 테스트 데이터 생성 완료 ===');
    console.log(`
📊 생성 결과:
- Project: ${project.title}
- Tasks: ${createdTasks.length}개
- Subtasks: 3개
- Meeting Note: 1개
    `);
    
  } catch (error) {
    console.error('❌ 에러:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestData();