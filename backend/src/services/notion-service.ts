/**
 * Notion 서비스 - 심플 버전
 */

import { Client } from '@notionhq/client';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 입력 데이터 구조
interface InputData {
  summary: string;
  action_items: Array<{
    id: number;
    title: string;
    description: string;
    details?: string;
    priority: string;
    status: string;
    assignee: string;
    start_date: string;
    deadline: string;
    estimated_hours: number;
    complexity: number;
    dependencies: number[];
    test_strategy: string;
    acceptance_criteria: string[];
    subtasks: any[];
    tags: string[];
    created_at: string;
    updated_at: string | null;
  }>;
}

export class NotionService {
  private notion: Client;
  
  constructor(accessToken: string) {
    this.notion = new Client({
      auth: this.decrypt(accessToken),
    });
  }
  
  // 암호화/복호화
  private decrypt(encryptedText: string): string {
    try {
      return Buffer.from(encryptedText, 'base64').toString();
    } catch (error) {
      console.error('토큰 복호화 실패:', error);
      throw new Error('Invalid access token');
    }
  }
  
  // 사용자별 NotionService 인스턴스 생성
  static async createForUser(tenantId: string, userId: string): Promise<NotionService | null> {
    try {
      const integration = await prisma.integration.findUnique({
        where: {
          tenantId_userId_serviceType: {
            tenantId,
            userId,
            serviceType: 'NOTION'
          }
        }
      });
      
      if (!integration || !integration.isActive || !integration.accessToken) {
        console.log(`❌ Notion 연동 없음: tenantId=${tenantId}, userId=${userId}`);
        return null;
      }
      
      console.log(`✅ Notion 연동 확인됨: ${(integration.config as any)?.workspace_name || 'Unknown Workspace'}`);
      return new NotionService(integration.accessToken);
    } catch (error) {
      console.error('NotionService 생성 오류:', error);
      return null;
    }
  }
  

async createMeetingPage(inputData: InputData | string, projectName?: string): Promise<{ id: string; url: string }> {
  // JSON 파싱
  let parsedData: InputData;
  if (typeof inputData === 'string') {
    parsedData = JSON.parse(inputData as string);
  } else {
    parsedData = inputData;
  }

  try {
    console.log('📝 Notion 페이지 생성 시작');
    console.log('📌 프로젝트 이름:', projectName || '없음');
    
    // 프로젝트 이름으로 독립 페이지 생성
    const pageTitle = projectName || `딸깍 - ${parsedData.summary}`;
    
    console.log('📝 페이지 제목:', pageTitle);
    
    // 워크스페이스의 최상위 레벨 페이지 찾기
    // 부모가 workspace인 페이지들을 찾아서 그와 같은 레벨에 생성
    const search = await this.notion.search({
      query: '',
      filter: { value: 'page', property: 'object' },
      page_size: 10 // 여러 페이지 검색
    });
    
    if (search.results.length === 0) {
      throw new Error('노션 워크스페이스에 접근 가능한 페이지가 없습니다. 노션에서 앱에 페이지 접근 권한을 부여해주세요.');
    }
    
    // workspace 레벨 페이지 찾기 (parent가 workspace_true인 페이지)
    let parent: any;
    let workspaceLevelPage = null;
    
    for (const page of search.results) {
      const pageData = page as any;
      if (pageData.parent?.type === 'workspace' && pageData.parent?.workspace === true) {
        workspaceLevelPage = pageData;
        break;
      }
    }
    
    if (workspaceLevelPage) {
      // workspace 레벨 페이지를 찾았다면 같은 레벨에 생성
      console.log('✅ 워크스페이스 레벨 페이지 발견, 같은 레벨에 생성');
      parent = { type: 'workspace', workspace: true };
    } else {
      // workspace 레벨을 못 찾았다면 가장 상위 페이지를 찾아서 그 레벨에 생성
      const firstPage = search.results[0] as any;
      
      // 첫 번째 페이지의 최상위 부모 찾기
      if (firstPage.parent?.type === 'page_id') {
        // 부모의 부모를 찾을 수 없으므로 첫 번째 페이지와 같은 레벨에 생성
        parent = firstPage.parent;
      } else if (firstPage.parent?.type === 'database_id') {
        // 데이터베이스 하위는 피하고 페이지 자체를 부모로
        parent = { page_id: firstPage.id };
      } else {
        // workspace이거나 다른 경우
        parent = firstPage.parent || { page_id: firstPage.id };
      }
    }
    
    console.log('📌 페이지 생성 위치:', parent);

    // 프로젝트 이름으로 메인 페이지 생성
    const mainPageResponse = await this.notion.pages.create({
      parent,
      icon: { emoji: '📋' },
      properties: {
        title: {
          title: [{ 
            text: { content: pageTitle } 
          }]
        }
      },
      children: []
    });
    
    console.log(`✅ 개인 페이지 생성 완료: "${pageTitle}"`);

    // 데이터베이스를 새로 생성된 페이지 안에 생성
    const database = await this.notion.databases.create({
      parent: { page_id: mainPageResponse.id },
      title: [{ text: { content: "딸깍 회의 데이터베이스" } }],
      properties: {
        "제목": { title: {} },
        "시작일": { date: {} },
        "마감일": { date: {} },
        "담당자": { rich_text: {} }
      }
    });

    console.log('📊 데이터베이스 생성 완료:', database.id);
    console.log('🔍 NotionService에서 받은 첫 번째 아이템:', parsedData.action_items[0]);
    for (const item of parsedData.action_items) {
      
      await this.notion.pages.create({
        parent: { database_id: database.id },
        properties: {
          "제목": { title: [{ text: { content: item.title } }] },
          "시작일": { date: { start: item.start_date } },
          "마감일": { date: { start: item.deadline } },
          "담당자": { rich_text: [{ text: { content: item.assignee } }] }
        }
      });
    }

    // 메인 페이지에 콘텐츠 블록 추가
    await this.notion.blocks.children.append({
      block_id: mainPageResponse.id,
      children: [
        // 🎈SKN 12기 Final Project 3팀
        {
          object: 'block' as const,
          type: 'heading_3' as const,
          heading_3: {
            rich_text: [{ 
              type: 'text' as const, 
              text: { content: '🎈SKN 12기 Final Project 3팀' } 
            }]
          }
        },
        
        // 프로젝트 설명 (summary 사용)
        {
          object: 'block' as const,
          type: 'paragraph' as const,
          paragraph: {
            rich_text: [{ 
              type: 'text' as const, 
              text: { content: parsedData.summary } 
            }]
          }
        },
        
        // 네비게이션 콜아웃 (회색 배경)
        {
          object: 'block' as const,
          type: 'callout' as const,
          callout: {
            rich_text: [{ 
              type: 'text' as const, 
              text: { content: 'Home    |   Calendar   |  Work  ' } 
            }],
            color: 'gray_background' as const
          }
        },
        
        // Work 콜아웃 (브라운 배경, 체크리스트 아이콘)
        {
          object: 'block' as const,
          type: 'callout' as const,
          callout: {
            rich_text: [{ 
              type: 'text' as const, 
              text: { content: 'Work' },
              annotations: { bold: true }
            }],
            icon: { emoji: '✅' },
            color: 'brown_background' as const
          }
        },
        
        // Work 테이블 - HTML과 정확히 동일한 구조
        {
          object: 'block' as const,
          type: 'table' as const,
          table: {
            table_width: 6,
            has_column_header: true,
            has_row_header: false,
            children: [
              // 헤더 행
              {
                object: 'block' as const,
                type: 'table_row' as const,
                table_row: {
                  cells: [
                    [{ type: 'text' as const, text: { content: 'ID' }, annotations: { bold: true } }],
                    [{ type: 'text' as const, text: { content: '시작일' }, annotations: { bold: true } }],
                    [{ type: 'text' as const, text: { content: '마감일' }, annotations: { bold: true } }],
                    [{ type: 'text' as const, text: { content: '내용' }, annotations: { bold: true } }],
                    [{ type: 'text' as const, text: { content: '상태' }, annotations: { bold: true } }],
                    [{ type: 'text' as const, text: { content: '담당자' }, annotations: { bold: true } }]
                  ]
                }
              },
              // 메인 태스크와 서브태스크 모두 표시
              ...this.createTaskRowsWithSubtasks(parsedData.action_items)
            ]
          }
        },
        // Calendar 콜아웃 (모든 내용이 박스 안에 들어감)
        {
          object: 'block' as const,
          type: 'callout' as const,
          callout: {
            rich_text: [{ 
              type: 'text' as const, 
              text: { content: '✱ Calendar' },
              annotations: { bold: true }
            }],
            icon: { emoji: '📅' },
            color: 'blue_background' as const,
            children: [
              // Notion Calendar + 연결 가이드
              {
                object: 'block' as const,
                type: 'paragraph' as const,
                paragraph: {
                  rich_text: [
                    {
                      type: 'text' as const,
                      text: { 
                        content: '📅 Notion Calendar 열기',
                        link: { url: 'https://calendar.notion.so/' }
                      },
                      annotations: { 
                        bold: true,
                        color: 'blue' as const
                      }
                    },
                    { 
                      type: 'text' as const, 
                      text: { content: ' → 열린 후 아래 데이터베이스를 연결하세요!' }
                    }
                  ]
                }
              },
              // 데이터베이스 연결 (Notion Calendar와 동기화)
              {
                object: 'block' as const,
                type: 'paragraph' as const,
                paragraph: {
                  rich_text: [
                    {
                      type: 'text' as const,
                      text: { 
                        content: '🔗 이 데이터베이스 보기',
                        link: { url: `https://www.notion.so/${database.id.replace(/-/g, '')}` }
                      },
                      annotations: { 
                        bold: true,
                        color: 'green' as const
                      }
                    },
                    { 
                      type: 'text' as const, 
                      text: { content: ' ← 데이터베이스를 Notion Calendar에 연결하세요' }
                    }
                  ]
                }
              },
              // 데이터베이스 직접 링크
              {
                object: 'block' as const,
                type: 'link_to_page' as const,
                link_to_page: {
                  page_id: database.id
                }
              }
            ]
          }
        },


        // 기획안 콜아웃 - 전체 기획안을 담는 큰 박스
        {
          object: 'block' as const,
          type: 'callout' as const,
          callout: {
            rich_text: [{ 
              type: 'text' as const, 
              text: { content: '✱ 기획안' },
              annotations: { bold: true }
            }],
            children: [
              // 프로젝트 개요 (파란 배경)
              {
                object: 'block' as const,
                type: 'heading_2' as const,
                heading_2: {
                  rich_text: [{ 
                    type: 'text' as const, 
                    text: { content: '프로젝트 개요' }
                  }],
                  color: 'blue_background' as const
                }
              },
              // 프로젝트명
              {
                object: 'block' as const,
                type: 'paragraph' as const,
                paragraph: {
                  rich_text: [
                    { type: 'text' as const, text: { content: '프로젝트명' }, annotations: { bold: true } },
                    { type: 'text' as const, text: { content: `: ${this.extractProjectName(parsedData)}` } }
                  ]
                }
              },
              
              // 목적 (AI 응답에서 목적 추출)
              {
                object: 'block' as const,
                type: 'paragraph' as const,
                paragraph: {
                  rich_text: [
                    { type: 'text' as const, text: { content: '목적' }, annotations: { bold: true } },
                    { type: 'text' as const, text: { content: `: ${this.extractPurposeFromSummary(parsedData)}` } }
                  ]
                }
              },
              
              // 수행기간
              {
                object: 'block' as const,
                type: 'paragraph' as const,
                paragraph: {
                  rich_text: [
                    { type: 'text' as const, text: { content: '수행기간' }, annotations: { bold: true } },
                    { type: 'text' as const, text: { content: `: ${this.calculateProjectPeriod(parsedData)}` } }
                  ]
                }
              },
              
              // 담당자
              {
                object: 'block' as const,
                type: 'paragraph' as const,
                paragraph: {
                  rich_text: [
                    { type: 'text' as const, text: { content: '담당자' }, annotations: { bold: true } },
                    { type: 'text' as const, text: { content: `: ${this.extractAssignees(parsedData).join(', ')}` } }
                  ]
                }
              },
              
              // 핵심 목표 (파란 배경)
              {
                object: 'block' as const,
                type: 'heading_2' as const,
                heading_2: {
                  rich_text: [{ 
                    type: 'text' as const, 
                    text: { content: '핵심 목표' }
                  }],
                  color: 'blue_background' as const
                }
              },
              
              // 목표 불릿 리스트 (기획안 데이터 또는 high priority 업무들 사용)
              ...this.extractObjectives(parsedData).map(objective => ({
                object: 'block' as const,
                type: 'bulleted_list_item' as const,
                bulleted_list_item: {
                  rich_text: [{ type: 'text' as const, text: { content: objective } }]
                }
              })),
              
              // 세부 내용 (보라 배경)
              {
                object: 'block' as const,
                type: 'heading_2' as const,
                heading_2: {
                  rich_text: [{ 
                    type: 'text' as const, 
                    text: { content: '세부 내용' }
                  }],
                  color: 'purple_background' as const
                }
              },
              
              // 핵심 아이디어 토글
              {
                object: 'block' as const,
                type: 'toggle' as const,
                toggle: {
                  rich_text: [{ 
                    type: 'text' as const, 
                    text: { content: '핵심 아이디어' },
                    annotations: { bold: true }
                  }],
                  children: [
                    {
                      object: 'block' as const,
                      type: 'paragraph' as const,
                      paragraph: {
                        rich_text: [{ 
                          type: 'text' as const, 
                          text: { content: this.extractCoreIdea(parsedData) }
                        }]
                      }
                    }
                  ]
                }
              },
              
              // 아이디어 기술 토글
              {
                object: 'block' as const,
                type: 'toggle' as const,
                toggle: {
                  rich_text: [{ 
                    type: 'text' as const, 
                    text: { content: '아이디어 기술' },
                    annotations: { bold: true }
                  }],
                  children: [
                    {
                      object: 'block' as const,
                      type: 'paragraph' as const,
                      paragraph: {
                        rich_text: [{ 
                          type: 'text' as const, 
                          text: { content: this.extractTechnologies(parsedData) }
                        }]
                      }
                    }
                  ]
                }
              },
              
              // 실행 계획 토글
              {
                object: 'block' as const,
                type: 'toggle' as const,
                toggle: {
                  rich_text: [{ 
                    type: 'text' as const, 
                    text: { content: '실행 계획' },
                    annotations: { bold: true }
                  }],
                  children: [
                    {
                      object: 'block' as const,
                      type: 'paragraph' as const,
                      paragraph: {
                        rich_text: [{ 
                          type: 'text' as const, 
                          text: { content: this.getExecutionPlanDescription(parsedData) }
                        }]
                      }
                    },
                    // 각 메인 태스크를 실행 단계로 표시 (서브태스크 제외)
                    ...this.createExecutionPlan(parsedData.action_items)
                  ]
                }
              }
            ]
          }
        }
      ]
    });
    
    console.log('✅ Notion 페이지 생성 완료');
    
    // Notion 페이지 URL 생성 (공개 URL 형식)
    const pageUrl = (mainPageResponse as any).url || 
                    (mainPageResponse as any).public_url ||
                    `https://www.notion.so/${mainPageResponse.id.replace(/-/g, '')}`;
    
    console.log('📝 생성된 Notion 페이지:', {
      id: mainPageResponse.id,
      url: pageUrl
    });
    
    return {
      id: mainPageResponse.id,
      url: pageUrl
    };
    
  } catch (error) {
    console.error('❌ Notion 페이지 생성 실패:', error);
    throw new Error(`Notion 페이지 생성 실패: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


private getStatusBadge(status: string): string {
  switch(status.toLowerCase()) {
    case 'pending': return '예정';
    case 'in_progress': return '진행 중';  
    case 'completed': return '완료';
    default: return status;
  }
}

private extractTechnologies(parsedData: InputData): string {
  // notion_project 데이터 확인
  const notionData = (parsedData as any).notion_project;
  if (notionData?.idea_description) {
    return notionData.idea_description;
  }
  
  const actionItems = parsedData.action_items;
  if (!actionItems || actionItems.length === 0) return '기술 스택이 정의되지 않았습니다.';
  
  // subtasks의 required_skills 수집
  const allSkills = new Set<string>();
  
  actionItems.forEach(item => {
    // 메인 태스크의 태그
    if (item.tags) {
      item.tags.forEach(tag => allSkills.add(tag));
    }
    
    // 서브태스크의 required_skills
    if (item.subtasks && Array.isArray(item.subtasks)) {
      item.subtasks.forEach(subtask => {
        if (subtask.required_skills && Array.isArray(subtask.required_skills)) {
          subtask.required_skills.forEach(skill => allSkills.add(skill));
        }
      });
    }
  });
  
  if (allSkills.size > 0) {
    return `주요 기술: ${Array.from(allSkills).join(', ')}`;
  }
  
  return '프로젝트 기술 스택과 구현 방법론을 정의합니다.';
}
  

  
// 날짜에서 주차 정보 추출
private getWeekFromDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const month = date.toLocaleDateString('ko-KR', { month: 'long' });
    const weekOfMonth = Math.ceil(date.getDate() / 7);
    return `${month} ${weekOfMonth}주차`;
  } catch {
    return '미정';
  }
}

// 프로젝트 기간 계산 - 기획안 데이터 우선 사용
private calculateProjectPeriod(parsedData: InputData): string {
  const notionData = (parsedData as any).notion_project;
  if (notionData?.project_period) {
    return notionData.project_period;
  }
  
  const actionItems = parsedData.action_items;
  if (!actionItems || actionItems.length === 0) return '[기간 미정]';
  
  const firstItem = actionItems[0];
  if (!firstItem?.start_date || !firstItem?.deadline) return '[기간 미정]';
  
  // 가장 이른 시작일 찾기
  const earliestStart = actionItems.reduce((earliest, item) => {
    if (!item.start_date) return earliest;
    const itemDate = new Date(item.start_date);
    const earliestDate = new Date(earliest);
    return itemDate < earliestDate ? item.start_date : earliest;
  }, firstItem.start_date);
  
  // 가장 늦은 종료일 찾기
  const latestEnd = actionItems.reduce((latest, item) => {
    if (!item.deadline) return latest;
    const itemDate = new Date(item.deadline);
    const latestDate = new Date(latest);
    return itemDate > latestDate ? item.deadline : latest;
  }, firstItem.deadline);
  
  return `${earliestStart} ~ ${latestEnd}`;
}

// 담당자 목록 추출 - 기획안 데이터 우선 사용
private extractAssignees(parsedData: InputData): string[] {
  const notionData = (parsedData as any).notion_project;
  if (notionData?.project_manager) {
    return [notionData.project_manager];
  }
  
  const actionItems = parsedData.action_items;
  if (!actionItems || actionItems.length === 0) return ['담당자 미지정'];
  
  const assignees = [...new Set(actionItems.map(item => item.assignee))];
  const filtered = assignees.filter(assignee => assignee && assignee.trim() !== '');
  return filtered.length > 0 ? filtered : ['담당자 미지정'];
}

// AI 업무 목록에서 목표 추출 - 기획안 데이터 우선 사용
private extractObjectives(parsedData: InputData): string[] {
  // notion_project 데이터가 있으면 우선 사용
  const notionData = (parsedData as any).notion_project;
  if (notionData?.core_objectives && Array.isArray(notionData.core_objectives)) {
    return notionData.core_objectives;
  }
  
  const actionItems = parsedData.action_items;
  if (!actionItems || actionItems.length === 0) {
    return ['프로젝트 목표가 설정되지 않았습니다.'];
  }
  
  // 높은 우선순위 업무들의 설명(description)을 목표로 사용 (제목보다 구체적)
  const highPriorityTasks = actionItems.filter(task => task.priority === 'high');
  if (highPriorityTasks.length > 0) {
    return highPriorityTasks.slice(0, 5).map(task => 
      task.description || task.title || '목표 설정 필요'
    );
  }
  
  // 높은 우선순위가 없으면 처음 5개 업무의 설명을 목표로 사용
  return actionItems.slice(0, 5).map(task => 
    task.description || task.title || '목표 설정 필요'
  );
}
// 헬퍼 함수들
private createDetailedTaskToggles(actionItems: any[]): any[] {
  if (!actionItems || actionItems.length === 0) return [];
  
  return actionItems.slice(0, 5).map(task => ({
    object: 'block',
    type: 'toggle',
    toggle: {
      rich_text: [{ 
        type: 'text', 
        text: { content: task.title || '업무명' },
        annotations: { bold: true }
      }],
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ 
              type: 'text', 
              text: { content: `📝 설명: ${task.description || '설명 없음'}` } 
            }]
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ 
              type: 'text', 
              text: { content: `👤 담당자: ${task.assignee || '미지정'} | ⏱️ 예상시간: ${task.estimated_hours || 0}h | 📅 마감: ${task.deadline || '미정'}` } 
            }]
          }
        }
      ]
    }
  }));
}
  
  // ⭐ 심플한 업무 테이블 생성
  private createSimpleTaskTable(actionItems: InputData['action_items']): any[] {
    if (!actionItems || actionItems.length === 0) {
      return [{
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ 
            type: 'text', 
            text: { content: '생성된 업무가 없습니다.' }
          }]
        }
      }];
    }

    // 테이블 생성 - 핵심 컬럼만
    const tableRows = [
      // 헤더
      {
        object: 'block',
        type: 'table_row',
        table_row: {
          cells: [
            [{ type: 'text', text: { content: 'ID' }, annotations: { bold: true } }],
            [{ type: 'text', text: { content: '업무명' }, annotations: { bold: true } }],
            [{ type: 'text', text: { content: '담당자' }, annotations: { bold: true } }],
            [{ type: 'text', text: { content: '우선순위' }, annotations: { bold: true } }],
            [{ type: 'text', text: { content: '상태' }, annotations: { bold: true } }],
            [{ type: 'text', text: { content: '마감일' }, annotations: { bold: true } }]
          ]
        }
      },
      // 데이터 행들
      ...actionItems.map(item => ({
        object: 'block',
        type: 'table_row',
        table_row: {
          cells: [
            [{ type: 'text', text: { content: item.id.toString() } }],
            [{ type: 'text', text: { content: item.title } }],
            [{ type: 'text', text: { content: item.assignee } }],
            [{ type: 'text', text: { content: item.priority } }],
            [{ type: 'text', text: { content: item.status } }],
            [{ type: 'text', text: { content: item.deadline } }]
          ]
        }
      }))
    ];

    return [{
      object: 'block',
      type: 'table',
      table: {
        table_width: 6,
        has_column_header: true,
        has_row_header: false,
        children: tableRows
      }
    }];
  }

  // ⭐ 업무 상세 정보 (토글 형태로 깔끔하게)
  private createTaskDetails(actionItems: InputData['action_items']): any[] {
    if (!actionItems || actionItems.length === 0) return [];

    const detailBlocks = [
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ 
            type: 'text', 
            text: { content: '업무 상세' }
          }]
        }
      }
    ];

    // 각 업무를 토글 블록으로
    const taskToggles = actionItems.map(task => ({
      object: 'block',
      type: 'toggle',
      toggle: {
        rich_text: [{ 
          type: 'text', 
          text: { content: `${task.id}. ${task.title}` },
          annotations: { bold: true }
        }],
        children: [
          // 기본 정보
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ 
                type: 'text', 
                text: { content: `📝 ${task.description}` }
              }]
            }
          },
          // 세부 정보
          {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [{ 
                type: 'text', 
                text: { content: `담당자: ${task.assignee}` }
              }]
            }
          },
          {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [{ 
                type: 'text', 
                text: { content: `우선순위: ${task.priority} | 예상시간: ${task.estimated_hours}h | 복잡도: ${task.complexity}/10` }
              }]
            }
          },
          {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [{ 
                type: 'text', 
                text: { content: `마감일: ${task.deadline} | 상태: ${task.status}` }
              }]
            }
          },
          // 상세사항 (있으면)
          ...(task.details ? [{
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ 
                type: 'text', 
                text: { content: `📋 상세사항: ${task.details}` }
              }]
            }
          }] : []),
          // 완료 조건 (있으면)
          ...(task.acceptance_criteria && task.acceptance_criteria.length > 0 ? [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [{ 
                  type: 'text', 
                  text: { content: '✅ 완료 조건:' },
                  annotations: { bold: true }
                }]
              }
            },
            ...task.acceptance_criteria.map(criteria => ({
              object: 'block',
              type: 'bulleted_list_item',
              bulleted_list_item: {
                rich_text: [{ 
                  type: 'text', 
                  text: { content: criteria }
                }]
              }
            }))
          ] : []),
          // 태그 (있으면)
          ...(task.tags && task.tags.length > 0 ? [{
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ 
                type: 'text', 
                text: { content: `🏷️ ${task.tags.join(', ')}` }
              }]
            }
          }] : [])
        ]
      }
    }));

    return [...detailBlocks, ...taskToggles];
  }
  
  // 연동 상태 테스트
  async testConnection(): Promise<boolean> {
    try {
      await this.notion.users.me({});
      return true;
    } catch (error) {
      console.error('Notion 연결 테스트 실패:', error);
      return false;
    }
  }
  
  // 사용자별 연동 상태 확인
  static async checkUserIntegration(tenantId: string, userId: string): Promise<{
    connected: boolean;
    workspace_name?: string;
    error?: string | undefined;
  }> {
    try {
      const integration = await prisma.integration.findUnique({
        where: {
          tenantId_userId_serviceType: {
            tenantId,
            userId,
            serviceType: 'NOTION'
          }
        }
      });
      
      if (!integration || !integration.isActive) {
        return { connected: false };
      }
      
      const notionService = new NotionService(integration.accessToken!);
      const isWorking = await notionService.testConnection();
      
      return {
        connected: isWorking,
        workspace_name: (integration.config as any)?.workspace_name,
        ...(isWorking ? {} : { error: 'Connection test failed' })
      };
      
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // 메인 태스크와 서브태스크를 테이블 행으로 변환
  private createTaskRowsWithSubtasks(actionItems: any[]): any[] {
    const rows: any[] = [];
    
    for (const item of actionItems) {
      // 메인 태스크 행
      rows.push({
        object: 'block' as const,
        type: 'table_row' as const,
        table_row: {
          cells: [
            [{ type: 'text' as const, text: { content: item.id.toString() }, annotations: { bold: true } }],
            [{ type: 'text' as const, text: { content: item.start_date } }],
            [{ type: 'text' as const, text: { content: item.deadline } }],
            [{ type: 'text' as const, text: { content: item.title }, annotations: { bold: true } }],
            [{ type: 'text' as const, text: { content: this.getStatusBadge(item.status) } }],
            [{ type: 'text' as const, text: { content: item.assignee || '' } }]
          ]
        }
      });
      
      // 서브태스크가 있으면 추가
      if (item.subtasks && Array.isArray(item.subtasks) && item.subtasks.length > 0) {
        for (const subtask of item.subtasks) {
          rows.push({
            object: 'block' as const,
            type: 'table_row' as const,
            table_row: {
              cells: [
                [{ type: 'text' as const, text: { content: `  └ ${subtask.id || ''}` } }],
                [{ type: 'text' as const, text: { content: subtask.start_date || item.start_date } }],
                [{ type: 'text' as const, text: { content: subtask.deadline || item.deadline } }],
                [{ type: 'text' as const, text: { content: `    ${subtask.title || subtask.description || '서브태스크'}` } }],
                [{ type: 'text' as const, text: { content: this.getStatusBadge(subtask.status || 'pending') } }],
                [{ type: 'text' as const, text: { content: subtask.assignee || item.assignee || '' } }]
              ]
            }
          });
        }
      }
    }
    
    return rows;
  }

  // AI 응답에서 목적 추출 - 기획안 데이터 우선 사용
  private extractPurposeFromSummary(parsedData: InputData): string {
    // parsedData에 notion_project 데이터가 있는지 확인
    const notionData = (parsedData as any).notion_project;
    if (notionData?.project_purpose) {
      return notionData.project_purpose;
    }
    
    // AI 응답 형식에서 목적 부분 추출
    const summary = parsedData.summary;
    
    // "목적: " 패턴 찾기
    const purposeMatch = summary.match(/목적[:：]\s*([^\n]+)/);
    if (purposeMatch && purposeMatch[1]) {
      return purposeMatch[1].trim();
    }
    
    // summary가 짧으면 전체를 목적으로 사용
    if (summary.length < 100) {
      return summary;
    }
    
    // 첫 문장을 목적으로 사용
    const firstSentence = summary.split(/[.。!?]/).filter(s => s.trim().length > 0)[0];
    return firstSentence ? firstSentence.trim() : summary.substring(0, 100) + '...';
  }

  // 핵심 아이디어 추출 - 기획안 데이터 우선 사용
  private extractCoreIdea(parsedData: InputData): string {
    // parsedData에 notion_project 데이터가 있는지 확인
    const notionData = (parsedData as any).notion_project;
    if (notionData?.core_idea) {
      return notionData.core_idea;
    }
    
    const summary = parsedData.summary;
    
    // "핵심 아이디어" 패턴 찾기
    const ideaMatch = summary.match(/핵심\s*아이디어[:：]\s*([^\n]+)/);
    if (ideaMatch && ideaMatch[1]) {
      return ideaMatch[1].trim();
    }
    
    // summary 전체 반환
    return summary;
  }

  // 실행 계획 설명 가져오기
  private getExecutionPlanDescription(parsedData: InputData): string {
    const notionData = (parsedData as any).notion_project;
    if (notionData?.execution_plan) {
      return notionData.execution_plan;
    }
    
    const actionItems = parsedData.action_items;
    if (!actionItems || actionItems.length === 0) {
      return '실행 계획이 수립되지 않았습니다.';
    }
    
    return `총 ${actionItems.length}개 업무를 단계별로 실행합니다.`;
  }

  // 실행 계획 생성 (서브태스크 포함)
  private createExecutionPlan(actionItems: any[]): any[] {
    const planItems: any[] = [];
    let stepNumber = 1;
    
    for (const item of actionItems) {
      // 메인 태스크
      planItems.push({
        object: 'block' as const,
        type: 'bulleted_list_item' as const,
        bulleted_list_item: {
          rich_text: [{ 
            type: 'text' as const, 
            text: { content: `${stepNumber}단계: ${item.title} (${item.deadline})` },
            annotations: { bold: true }
          }]
        }
      });
      
      // 서브태스크가 있으면 하위 항목으로 추가
      if (item.subtasks && Array.isArray(item.subtasks) && item.subtasks.length > 0) {
        for (const subtask of item.subtasks) {
          planItems.push({
            object: 'block' as const,
            type: 'bulleted_list_item' as const,
            bulleted_list_item: {
              rich_text: [{ 
                type: 'text' as const, 
                text: { content: `  • ${subtask.title || subtask.description || '서브태스크'}` }
              }]
            }
          });
        }
      }
      
      stepNumber++;
    }
    
    return planItems;
  }

  // 프로젝트명 추출 - AI가 생성한 기획안 데이터에서 추출
  private extractProjectName(parsedData: InputData): string {
    // parsedData에 notion_project 데이터가 있는지 확인
    const notionData = (parsedData as any).notion_project;
    if (notionData?.project_name) {
      return notionData.project_name;
    }
    
    const summary = parsedData.summary;
    
    // "프로젝트명: " 패턴 찾기
    const projectMatch = summary.match(/프로젝트명[:：]\s*([^\n]+)/);
    if (projectMatch && projectMatch[1]) {
      return projectMatch[1].trim();
    }
    
    // 첫 번째 태스크에서 프로젝트 정보 찾기
    if (parsedData.action_items && parsedData.action_items.length > 0) {
      const firstTask = parsedData.action_items[0];
      if (firstTask && firstTask.tags && firstTask.tags.includes('project')) {
        return firstTask.title;
      }
    }
    
    // 기본값
    return 'TtalKkac 프로젝트';
  }
}