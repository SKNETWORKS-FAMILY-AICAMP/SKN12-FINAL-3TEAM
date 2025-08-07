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
  

async createMeetingPage(inputData: InputData | string): Promise<{ id: string; url: string }> {
  // JSON 파싱
  let parsedData: InputData;
  if (typeof inputData === 'string') {
    parsedData = JSON.parse(inputData as string);
  } else {
    parsedData = inputData;
  }

  try {
    console.log('📝 Notion 페이지 생성 시작');
    
    // 부모 페이지 찾기
    const search = await this.notion.search({
      query: '',
      filter: { value: 'page', property: 'object' },
      page_size: 1
    });
    
    // 첫 번째 결과 확인
    const firstResult = search.results[0];
    if (!firstResult?.id) {
      throw new Error('부모 페이지를 찾을 수 없습니다');
    }

    // 데이터베이스 생성
    const database = await this.notion.databases.create({
      parent: { page_id: firstResult.id },
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

    // 페이지 부모 (기존 로직 유지)
    const parent = { page_id: firstResult.id };
    
    // 페이지 생성
    const response = await this.notion.pages.create({
      parent,
      icon: { emoji: '🔔' },
      properties: {
        title: {
          title: [{ 
            text: { content: `딸깍 - ${parsedData.summary}` } 
          }]
        }
      },
      
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
              // 실제 action_items 데이터로 행 생성
              ...parsedData.action_items.map((item) => ({
                object: 'block' as const,
                type: 'table_row' as const,
                table_row: {
                  cells: [
                    [{ type: 'text' as const, text: { content: item.id.toString() } }],
                    [{ type: 'text' as const, text: { content: item.start_date } }],
                    [{ type: 'text' as const, text: { content: item.deadline } }],
                    [{ type: 'text' as const, text: { content: item.title } }],
                    [{ type: 'text' as const, text: { content: this.getStatusBadge(item.status) } }],
                    [{ type: 'text' as const, text: { content: item.assignee || '' } }]
                  ]
                }
              }))
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
                    { type: 'text' as const, text: { content: ': TtalKkac 모바일 앱 프로젝트' } }
                  ]
                }
              },
              
              // 목적 (summary 사용)
              {
                object: 'block' as const,
                type: 'paragraph' as const,
                paragraph: {
                  rich_text: [
                    { type: 'text' as const, text: { content: '목적' }, annotations: { bold: true } },
                    { type: 'text' as const, text: { content: `: ${parsedData.summary}` } }
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
                    { type: 'text' as const, text: { content: `: ${this.calculateProjectPeriod(parsedData.action_items)}` } }
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
                    { type: 'text' as const, text: { content: `: ${this.extractAssignees(parsedData.action_items).join(', ')}` } }
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
              
              // 목표 불릿 리스트 (high priority 업무들 사용)
              ...this.extractObjectives(parsedData.action_items).map(objective => ({
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
                          text: { content: parsedData.summary }
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
                          text: { content: this.extractTechnologies(parsedData.action_items) }
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
                          text: { content: `총 ${parsedData.action_items.length}개 업무를 단계별로 실행합니다.` }
                        }]
                      }
                    },
                    // 각 action_item을 실행 단계로 표시
                    ...parsedData.action_items.map((item, index) => ({
                      object: 'block' as const,
                      type: 'bulleted_list_item' as const,
                      bulleted_list_item: {
                        rich_text: [{ 
                          type: 'text' as const, 
                          text: { content: `${index + 1}단계: ${item.title} (${item.deadline})` }
                        }]
                      }
                    }))
                  ]
                }
              }
            ]
          }
        }
      ]
      
    });
    
    console.log('✅ Notion 페이지 생성 완료');
    
    return {
      id: response.id,
      url: (response as any).url || `https://notion.so/${response.id.replace(/-/g, '')}`
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

private extractTechnologies(actionItems: any[]): string {
  if (!actionItems || actionItems.length === 0) return '기술 스택이 정의되지 않았습니다.';
  
  // tags에서 기술 관련 태그들 추출
  const allTags = actionItems.flatMap(item => item.tags || []);
  const techTags = allTags.filter(tag => 
    ['backend', 'frontend', 'database', 'api', 'ui', 'ux', 'mongodb', 'react', 'node'].includes(tag.toLowerCase())
  );
  
  if (techTags.length > 0) {
    return `주요 기술: ${[...new Set(techTags)].join(', ')}`;
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

// 프로젝트 종료일 계산
// 기존 함수 수정
private calculateProjectPeriod(actionItems: any[]): string {
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

// 담당자 목록 추출
private extractAssignees(actionItems: any[]): string[] {
  if (!actionItems || actionItems.length === 0) return ['담당자 미지정'];
  
  const assignees = [...new Set(actionItems.map(item => item.assignee))];
  return assignees.filter(assignee => assignee && assignee.trim() !== '');
}

// AI 업무 목록에서 목표 추출
private extractObjectives(actionItems: any[]): string[] {
  if (!actionItems || actionItems.length === 0) {
    return ['프로젝트 목표가 설정되지 않았습니다.'];
  }
  
  // 높은 우선순위 업무들의 제목을 목표로 사용
  const highPriorityTasks = actionItems.filter(task => task.priority === 'high');
  if (highPriorityTasks.length > 0) {
    return highPriorityTasks.slice(0, 5).map(task => task.title);
  }
  
  // 높은 우선순위가 없으면 처음 5개 업무를 목표로 사용
  return actionItems.slice(0, 5).map(task => task.title);
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
}