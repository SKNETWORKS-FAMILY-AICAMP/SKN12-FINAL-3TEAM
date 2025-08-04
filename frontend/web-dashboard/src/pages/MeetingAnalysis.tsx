import { useState, useEffect } from 'react';
import { Search, Edit3, Download, Plus, ChevronRight, FileText, Calendar, Clock, Users, CheckCircle, ArrowUp, ArrowRight, ArrowDown, Trash2, Star, Filter, BarChart3, TrendingUp, Eye, MessageSquare, Target, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, UnderlineType } from 'docx';
import { saveAs } from 'file-saver';
import { toast } from 'sonner';

const MeetingAnalysis = () => {
  const [searchFilters, setSearchFilters] = useState({
    meetingName: '',
    date: '',
    participants: ''
  });

  // 기본 체크리스트 데이터
  const defaultChecklist = [
    { id: 1, text: '모델 결과 정리', completed: false },
    { id: 2, text: '피드백 정리', completed: false },
    { id: 3, text: '회의실 예약', completed: false }
  ];

  // localStorage에서 체크리스트 불러오기
  const [checklist, setChecklist] = useState(() => {
    const savedChecklist = localStorage.getItem('meetingAnalysis-checklist');
    return savedChecklist ? JSON.parse(savedChecklist) : defaultChecklist;
  });

  const [showEditModal, setShowEditModal] = useState(false);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [showEditNextMeetingModal, setShowEditNextMeetingModal] = useState(false);
  const [showEditChecklistModal, setShowEditChecklistModal] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState(1); // 기본값: 첫 번째 회의
  // 기본 회의 요약 데이터
  const defaultSummary = {
    purpose: 'Q1 프로젝트 진행 상황 점검 및 이슈 해결',
    mainContent: '각 팀별 진행 상황 공유, 기술적 이슈 논의, 일정 조정',
    decisions: '다음 주까지 UI 개선안 마무리, API 문서화 완료'
  };

  // localStorage에서 회의 요약 불러오기
  const [editedSummary, setEditedSummary] = useState(() => {
    const savedSummary = localStorage.getItem('meetingAnalysis-summary');
    return savedSummary ? JSON.parse(savedSummary) : defaultSummary;
  });

  // 기본 파생업무 데이터
  const defaultDerivedTasks = [
    {
      id: 1,
      name: 'UI 개선안 마무리',
      assignee: '김미정',
      dueDate: '2025-01-22',
      status: '진행 중',
      statusColor: 'bg-blue-500',
      priority: '상'
    },
    {
      id: 2,
      name: 'API 문서화 완료',
      assignee: '이준호',
      dueDate: '2025-01-20',
      status: '진행 중',
      statusColor: 'bg-blue-500',
      priority: '중'
    },
    {
      id: 3,
      name: '성능 테스트 진행',
      assignee: '박지현',
      dueDate: '2025-01-25',
      status: '예정',
      statusColor: 'bg-orange-500',
      priority: '중'
    },
    {
      id: 4,
      name: '다음 회의 일정 확정',
      assignee: '정수민',
      dueDate: '2025-01-18',
      status: '완료',
      statusColor: 'bg-green-500',
      priority: '하'
    }
  ];

  // localStorage에서 파생업무 불러오기
  const [derivedTasks, setDerivedTasks] = useState(() => {
    const savedTasks = localStorage.getItem('meetingAnalysis-derivedTasks');
    return savedTasks ? JSON.parse(savedTasks) : defaultDerivedTasks;
  });


  
  // 기본 다음 회의 정보
  const defaultNextMeeting = {
    title: '▶ 다음 회의: 07.19 (수)',
    host: '김미정',
    preparations: '모델 결과 비교표, UI 피드백 수합본'
  };

  // localStorage에서 다음 회의 정보 불러오기
  const [nextMeetingInfo, setNextMeetingInfo] = useState(() => {
    const savedNextMeeting = localStorage.getItem('meetingAnalysis-nextMeeting');
    return savedNextMeeting ? JSON.parse(savedNextMeeting) : defaultNextMeeting;
  });

  // localStorage 자동 저장을 위한 useEffect들
  useEffect(() => {
    localStorage.setItem('meetingAnalysis-checklist', JSON.stringify(checklist));
  }, [checklist]);

  useEffect(() => {
    localStorage.setItem('meetingAnalysis-summary', JSON.stringify(editedSummary));
  }, [editedSummary]);

  useEffect(() => {
    localStorage.setItem('meetingAnalysis-derivedTasks', JSON.stringify(derivedTasks));
  }, [derivedTasks]);

  useEffect(() => {
    localStorage.setItem('meetingAnalysis-nextMeeting', JSON.stringify(nextMeetingInfo));
  }, [nextMeetingInfo]);

  // 샘플 회의 데이터 (회의록 내용 포함)
  const [meetings] = useState([
    {
      id: 1,
      name: '주간 프로젝트 리뷰',
      date: '2025-01-15',
      participants: ['김미정', '이준호', '박지현'],
      status: '완료',
      record: {
        purpose: 'Q1 프로젝트 진행 상황 점검 및 이슈 해결',
        mainContent: '각 팀별 진행 상황 공유, 기술적 이슈 논의, 일정 조정',
        decisions: '• UI 개선안 마무리 (담당: 김미정, 마감: 1/22)\n• API 문서화 완료 (담당: 이준호, 마감: 1/20)\n• 성능 테스트 진행 (담당: 박지현, 마감: 1/25)\n• 다음 회의 일정 확정 (담당: 정수민, 마감: 1/18)',
        basicInfo: {
          meetingName: '주간 프로젝트 리뷰',
          date: '2025년 1월 15일 14:00',
          participants: '김미정, 이준호, 박지현, 정수민',
          host: '김미정'
        },
        detailedContent: {
          uiStatus: 'UI 개선 현황: 모바일 반응형 작업 80% 완료, 데스크톱 버전 검토 중',
          apiStatus: 'API 문서화: 사용자 인증 관련 API 우선 작업, 예상 완료일 1월 20일',
          performance: '성능 최적화: 페이지 로딩 속도 개선안 논의, 이미지 압축 및 캐싱 전략 수립',
          technicalIssues: '기술적 이슈: 데이터베이스 쿼리 최적화 필요, 인덱스 재설계 검토'
        }
      }
    },
    {
      id: 2,
      name: '클라이언트 피드백 검토',
      date: '2025-01-12',
      participants: ['박지현', '정수민'],
      status: '완료',
      record: {
        purpose: '클라이언트 피드백 분석 및 개선 방안 수립',
        mainContent: '사용자 인터페이스 개선 요청, 기능 추가 건의사항, 성능 최적화 요구사항',
        decisions: '• 메인 화면 재설계 (담당: 박지현, 마감: 1/25)\n• 검색 기능 개선 (담당: 정수민, 마감: 1/23)\n• 로딩 속도 최적화 (담당: 이준호, 마감: 1/27)\n• 사용자 매뉴얼 작성 (담당: 김미정, 마감: 1/30)',
        basicInfo: {
          meetingName: '클라이언트 피드백 검토',
          date: '2025년 1월 12일 15:30',
          participants: '박지현, 정수민, 김미정',
          host: '박지현'
        },
        detailedContent: {
          uiStatus: '인터페이스 피드백: 메인 화면 네비게이션 개선 요청, 버튼 크기 및 배치 조정',
          apiStatus: '기능 요청: 실시간 검색 기능 추가, 필터링 옵션 확장 필요',
          performance: '성능 이슈: 페이지 로딩 시간 3초 이상, 이미지 최적화 시급',
          technicalIssues: '사용성 개선: 모바일 반응형 문제, 접근성 가이드라인 준수 필요'
        }
      }
    },
    {
      id: 3,
      name: '월간 기술 스터디',
      date: '2025-01-18',
      participants: ['김미정', '이준호', '박지현', '정수민', '최영희'],
      status: '예정',
      record: {
        purpose: '최신 기술 트렌드 공유 및 프로젝트 적용 방안 논의',
        mainContent: 'React 18 새로운 기능, AI 도구 활용법, 클라우드 서비스 도입',
        decisions: '• React 18 마이그레이션 계획 수립 (담당: 이준호, 마감: 2/5)\n• AI 코드 리뷰 도구 도입 (담당: 최영희, 마감: 2/10)\n• AWS 서비스 검토 (담당: 김미정, 마감: 2/15)\n• 기술 문서 업데이트 (담당: 박지현, 마감: 2/1)',
        basicInfo: {
          meetingName: '월간 기술 스터디',
          date: '2025년 1월 18일 16:00',
          participants: '김미정, 이준호, 박지현, 정수민, 최영희',
          host: '이준호'
        },
        detailedContent: {
          uiStatus: 'React 18 업데이트: Concurrent Features 도입, Suspense 개선사항 학습',
          apiStatus: 'AI 도구 연구: GitHub Copilot 활용, ChatGPT API 통합 방안',
          performance: '클라우드 마이그레이션: AWS Lambda 서버리스 아키텍처 검토',
          technicalIssues: '기술 부채 해결: 레거시 코드 리팩토링, 테스트 커버리지 향상'
        }
      }
    },
    {
      id: 4,
      name: 'UI/UX 디자인 검토',
      date: '2025-01-20',
      participants: ['김미정', '박지현'],
      status: '예정',
      record: {
        purpose: '새로운 디자인 시스템 검토 및 사용자 경험 개선',
        mainContent: '디자인 컴포넌트 정리, 접근성 개선, 모바일 최적화',
        decisions: '• 디자인 시스템 구축 (담당: 박지현, 마감: 2/10)\n• 접근성 가이드라인 작성 (담당: 김미정, 마감: 2/5)\n• 모바일 UI 개선 (담당: 박지현, 마감: 2/15)\n• 사용자 테스트 진행 (담당: 김미정, 마감: 2/20)',
        basicInfo: {
          meetingName: 'UI/UX 디자인 검토',
          date: '2025년 1월 20일 10:00',
          participants: '김미정, 박지현, 정수민',
          host: '박지현'
        },
        detailedContent: {
          uiStatus: '디자인 시스템: 컴포넌트 라이브러리 구축, Figma 디자인 토큰 정의',
          apiStatus: '사용자 경험: 사용자 여정 맵 작성, 페르소나 기반 인터페이스 설계',
          performance: '접근성 개선: WCAG 2.1 가이드라인 준수, 키보드 네비게이션 최적화',
          technicalIssues: '반응형 디자인: 다양한 디바이스 대응, 터치 인터페이스 개선'
        }
      }
    }
  ]);

  // 필터링된 회의 목록
  const filteredMeetings = meetings.filter(meeting => {
    const matchesName = !searchFilters.meetingName || 
      meeting.name.toLowerCase().includes(searchFilters.meetingName.toLowerCase());
    const matchesDate = !searchFilters.date || meeting.date === searchFilters.date;
    const matchesParticipants = !searchFilters.participants || 
      meeting.participants.some(p => p.toLowerCase().includes(searchFilters.participants.toLowerCase()));
    
    return matchesName && matchesDate && matchesParticipants;
  });

  // 체크리스트 토글 함수
  const toggleChecklistItem = (id: number) => {
    setChecklist(prev => prev.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  // 체크리스트 편집 시작
  const startEditingChecklist = () => {
    setEditingChecklist([...checklist]);
    setShowEditChecklistModal(true);
  };

  // 체크리스트 아이템 추가
  const addChecklistItem = () => {
    const newItem = {
      id: Date.now(),
      text: '새 항목',
      completed: false
    };
    setEditingChecklist(prev => [...prev, newItem]);
  };

  // 체크리스트 아이템 삭제
  const deleteChecklistItem = (id) => {
    setEditingChecklist(prev => prev.filter(item => item.id !== id));
  };

  // 체크리스트 아이템 텍스트 수정
  const updateChecklistItemText = (id, newText) => {
    setEditingChecklist(prev => 
      prev.map(item => 
        item.id === id ? { ...item, text: newText } : item
      )
    );
  };

  // 체크리스트 저장
  const saveChecklist = () => {
    setChecklist([...editingChecklist]);
    setShowEditChecklistModal(false);
    toast.success('체크리스트가 수정되었습니다! ✅');
  };

  // 체크리스트 편집 취소
  const cancelChecklistEdit = () => {
    setEditingChecklist([]);
    setShowEditChecklistModal(false);
  };

  // 회의 선택 시 회의록 업데이트
  const selectMeeting = (meetingId: number) => {
    setSelectedMeetingId(meetingId);
    const selectedMeeting = meetings.find(m => m.id === meetingId);
    
    if (selectedMeeting && selectedMeeting.record) {
      // 선택된 회의의 회의록으로 업데이트
      setEditedSummary({
        purpose: selectedMeeting.record.purpose,
        mainContent: selectedMeeting.record.mainContent,
        decisions: selectedMeeting.record.decisions
      });
      
      // 파생업무도 새로운 회의록에 맞게 업데이트
      const newDerivedTasks = generateDerivedTasksFromContent(selectedMeeting.record.decisions);
      setDerivedTasks(newDerivedTasks);
    }
  };

  // 회의록 내용에서 파생업무 자동 생성
  const generateDerivedTasksFromContent = (decisions: string) => {
    // 간단한 파싱 로직 - 실제로는 더 정교한 NLP나 AI를 사용할 수 있음
    const taskKeywords = [
      { keyword: 'UI 개선', assignee: '김미정', priority: '상' },
      { keyword: 'API 문서화', assignee: '이준호', priority: '중' },
      { keyword: '성능 테스트', assignee: '박지현', priority: '중' },
      { keyword: '회의 일정', assignee: '정수민', priority: '하' },
      { keyword: '테스트', assignee: '박지현', priority: '중' },
      { keyword: '문서화', assignee: '이준호', priority: '중' },
      { keyword: '검토', assignee: '김미정', priority: '중' },
      { keyword: '분석', assignee: '박지현', priority: '중' },
      { keyword: '준비', assignee: '정수민', priority: '하' },
      { keyword: '작성', assignee: '이준호', priority: '중' }
    ];

    const newTasks = [];
    let taskId = Date.now();

    // 결정사항을 줄 단위로 분석
    const lines = decisions.split('\n').filter(line => line.trim());
    
    lines.forEach((line, index) => {
      // 액션 아이템이나 업무를 나타내는 패턴 찾기
      if (line.includes('•') || line.includes('-') || line.includes('담당:') || line.includes('마감:')) {
        // 키워드 매칭
        const matchedKeyword = taskKeywords.find(kw => 
          line.toLowerCase().includes(kw.keyword.toLowerCase())
        );
        
        if (matchedKeyword) {
          // 마감일 추출 (MM/DD 형식)
          const dateMatch = line.match(/(\d{1,2}\/\d{1,2})|(\d{1,2}-\d{1,2})|(\d{1,2}\.\d{1,2})/);
          let dueDate = '2025-01-30'; // 기본값
          
          if (dateMatch) {
            const [month, day] = dateMatch[0].split(/[\/\-\.]/);
            dueDate = `2025-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }

          // 담당자 추출
          const assigneeMatch = line.match(/담당[:\s]*([가-힣]+)/);
          const assignee = assigneeMatch ? assigneeMatch[1] : matchedKeyword.assignee;

          // 업무명 추출 (첫 번째 의미있는 부분)
          let taskName = line.replace(/[•\-\s]+/, '').split('(')[0].split(':')[0].trim();
          if (taskName.length > 20) {
            taskName = taskName.substring(0, 20) + '...';
          }

          newTasks.push({
            id: taskId++,
            name: taskName || `액션 아이템 ${index + 1}`,
            assignee: assignee,
            dueDate: dueDate,
            status: Math.random() > 0.7 ? '완료' : Math.random() > 0.4 ? '진행 중' : '예정',
            statusColor: Math.random() > 0.7 ? 'bg-green-500' : Math.random() > 0.4 ? 'bg-blue-500' : 'bg-orange-500',
            priority: matchedKeyword.priority
          });
        }
      }
    });

    // 최소 2개의 기본 업무는 유지
    if (newTasks.length === 0) {
      newTasks.push(
        {
          id: taskId++,
          name: 'UI 개선안 마무리',
          assignee: '김미정',
          dueDate: '2025-01-22',
          status: '진행 중',
          statusColor: 'bg-blue-500',
          priority: '상'
        },
        {
          id: taskId++,
          name: 'API 문서화 완료',
          assignee: '이준호',
          dueDate: '2025-01-20',
          status: '진행 중',
          statusColor: 'bg-blue-500',
          priority: '중'
        }
      );
    }

    return newTasks.slice(0, 6); // 최대 6개까지
  };

  // 회의록 다운로드 함수 (Word 문서)
  const downloadMeetingRecord = async () => {
    try {
      // Word 문서 생성
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              // 제목
              new Paragraph({
                text: "회의록",
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER,
                spacing: {
                  after: 400,
                },
              }),

              // 회의 날짜
              new Paragraph({
                children: [
                  new TextRun({
                    text: `작성일: ${new Date().toLocaleDateString('ko-KR')}`,
                    italics: true,
                  }),
                ],
                alignment: AlignmentType.RIGHT,
                spacing: {
                  after: 200,
                },
              }),

              // 회의 기본 정보
              new Paragraph({
                text: "📋 회의 기본 정보",
                heading: HeadingLevel.HEADING_1,
                spacing: {
                  before: 300,
                  after: 200,
                },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "회의명: 주간 프로젝트 리뷰\n",
                    bold: true,
                  }),
                ],
                spacing: {
                  after: 100,
                },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "일시: 2025년 1월 15일 14:00\n",
                  }),
                ],
                spacing: {
                  after: 100,
                },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "참석자: 김미정, 이준호, 박지현, 정수민\n",
                  }),
                ],
                spacing: {
                  after: 100,
                },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "진행자: 김미정",
                  }),
                ],
                spacing: {
                  after: 300,
                },
              }),

              // 회의 목적
              new Paragraph({
                text: "🎯 회의 목적",
                heading: HeadingLevel.HEADING_1,
                spacing: {
                  before: 300,
                  after: 200,
                },
              }),
              new Paragraph({
                text: "Q1 프로젝트 진행 상황 점검 및 이슈 해결",
                spacing: {
                  after: 300,
                },
              }),

              // 주요 논의 내용
              new Paragraph({
                text: "💬 주요 논의 내용",
                heading: HeadingLevel.HEADING_1,
                spacing: {
                  before: 300,
                  after: 200,
                },
              }),
              new Paragraph({
                text: "각 팀별 진행 상황 공유, 기술적 이슈 논의, 일정 조정",
                spacing: {
                  after: 200,
                },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "• UI 개선 현황: ",
                    bold: true,
                  }),
                  new TextRun({
                    text: "모바일 반응형 작업 80% 완료, 데스크톱 버전 검토 중\n",
                  }),
                ],
                spacing: {
                  after: 100,
                },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "• API 문서화: ",
                    bold: true,
                  }),
                  new TextRun({
                    text: "사용자 인증 관련 API 우선 작업, 예상 완료일 1월 20일\n",
                  }),
                ],
                spacing: {
                  after: 100,
                },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "• 성능 최적화: ",
                    bold: true,
                  }),
                  new TextRun({
                    text: "페이지 로딩 속도 개선안 논의, 이미지 압축 및 캐싱 전략 수립\n",
                  }),
                ],
                spacing: {
                  after: 100,
                },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "• 기술적 이슈: ",
                    bold: true,
                  }),
                  new TextRun({
                    text: "데이터베이스 쿼리 최적화 필요, 인덱스 재설계 검토",
                  }),
                ],
                spacing: {
                  after: 300,
                },
              }),

              // 결정 사항 및 액션 아이템
              new Paragraph({
                text: "✅ 결정 사항 및 액션 아이템",
                heading: HeadingLevel.HEADING_1,
                spacing: {
                  before: 300,
                  after: 200,
                },
              }),
              new Paragraph({
                text: "다음 주까지 UI 개선안 마무리, API 문서화 완료",
                spacing: {
                  after: 200,
                },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "📌 액션 아이템:",
                    bold: true,
                  }),
                ],
                spacing: {
                  after: 100,
                },
              }),
              new Paragraph({
                text: "• UI 개선안 마무리 (담당: 김미정, 마감: 1/22)",
                spacing: {
                  after: 50,
                },
              }),
              new Paragraph({
                text: "• API 문서화 완료 (담당: 이준호, 마감: 1/20)",
                spacing: {
                  after: 50,
                },
              }),
              new Paragraph({
                text: "• 성능 테스트 진행 (담당: 박지현, 마감: 1/25)",
                spacing: {
                  after: 50,
                },
              }),
              new Paragraph({
                text: "• 다음 회의 일정 확정 (담당: 정수민, 마감: 1/18)",
                spacing: {
                  after: 300,
                },
              }),

              // 파생 업무
              new Paragraph({
                text: "파생 업무",
                heading: HeadingLevel.HEADING_1,
                spacing: {
                  before: 300,
                  after: 200,
                },
              }),
              ...meetingData.derivedTasks.flatMap(task => [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `• ${task.name}`,
                      bold: true,
                    }),
                  ],
                  spacing: {
                    after: 100,
                  },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `  담당자: ${task.assignee} | 마감일: ${task.dueDate} | 우선순위: ${task.priority} | 상태: ${task.status}`,
                      color: task.status === '완료' ? '22C55E' : task.status === '진행 중' ? '3B82F6' : 'F97316',
                    }),
                  ],
                  spacing: {
                    after: 200,
                  },
                }),
              ]),


            ],
          },
        ],
      });

      // Word 문서를 Blob으로 변환
      const buffer = await Packer.toBlob(doc);
      
      // 파일 다운로드
      const fileName = `회의록_${new Date().toISOString().split('T')[0]}.docx`;
      saveAs(buffer, fileName);
      
      toast.success('회의록 Word 문서가 다운로드되었습니다! 📄');
      
    } catch (error) {
      console.error('Word 문서 생성 중 오류:', error);
      toast.error('Word 문서 생성 중 오류가 발생했습니다. 😞');
    }
  };

  // 파일 업로드 함수
  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*,video/*,.mp3,.wav,.mp4,.avi';
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        toast.success(`파일 "${file.name}"이 업로드되었습니다! 🎤`, {
          description: '처리 중입니다...'
        });
      }
    };
    input.click();
  };

  // 선택된 회의에 따른 동적 meetingData
  const selectedMeeting = meetings.find(m => m.id === selectedMeetingId);
  const meetingData = {
    summary: {
      purpose: '회의 목적:',
      mainContent: '주요 내용:',
      decisions: '결정 사항 및 다음 단계:'
    },
    derivedTasks: derivedTasks,

    // 선택된 회의의 실제 정보 사용
    basicInfo: selectedMeeting?.record?.basicInfo || {
      meetingName: '주간 프로젝트 리뷰',
      date: '2025년 1월 15일 14:00',
      participants: '김미정, 이준호, 박지현, 정수민',
      host: '김미정'
    },
    
    detailedContent: selectedMeeting?.record?.detailedContent || {
      uiStatus: 'UI 개선 현황: 모바일 반응형 작업 80% 완료, 데스크톱 버전 검토 중',
      apiStatus: 'API 문서화: 사용자 인증 관련 API 우선 작업, 예상 완료일 1월 20일',
      performance: '성능 최적화: 페이지 로딩 속도 개선안 논의, 이미지 압축 및 캐싱 전략 수립',
      technicalIssues: '기술적 이슈: 데이터베이스 쿼리 최적화 필요, 인덱스 재설계 검토'
    },

    nextMeeting: {
      title: nextMeetingInfo.title,
      details: [
        `- 진행자: ${nextMeetingInfo.host}`,
        `- 준비사항: ${nextMeetingInfo.preparations}`,
        '- 체크리스트:'
      ]
    },
    relatedDocs: {
      text: '전 회의 요약본 (07.03)',
      action: '[열기]'
    }
  };

  return (
    <div className="flex h-full bg-gray-100 dark:bg-gray-900">
      {/* Main Content */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">회의 분석</h1>
          
          {/* Search Filters */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">회의명:</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="회의명"
                  value={searchFilters.meetingName}
                  onChange={(e) => setSearchFilters({...searchFilters, meetingName: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md pr-10"
                />
                <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">일시:</label>
              <input
                type="date"
                value={searchFilters.date}
                onChange={(e) => setSearchFilters({...searchFilters, date: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">참석자:</label>
              <input
                type="text"
                placeholder="참석자"
                value={searchFilters.participants}
                onChange={(e) => setSearchFilters({...searchFilters, participants: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
            </div>

            {/* 검색 결과 표시 */}
            <div className="mt-4 col-span-3">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-medium text-gray-700">
                  검색 결과: {filteredMeetings.length}개의 회의
                </h3>
                {(searchFilters.meetingName || searchFilters.date || searchFilters.participants) && (
                  <button 
                    onClick={() => setSearchFilters({ meetingName: '', date: '', participants: '' })}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    필터 초기화
                  </button>
                )}
              </div>
              
              {filteredMeetings.length > 0 ? (
                <div className="space-y-2 w-full">
                  {filteredMeetings.map((meeting) => (
                    <div
                      key={meeting.id}
                      className={`p-3 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                        selectedMeetingId === meeting.id 
                          ? 'border-blue-500 bg-blue-50 shadow-md' 
                          : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                      }`}
                      onClick={() => {
                        // 선택된 회의로 회의록 업데이트
                        selectMeeting(meeting.id);
                      }}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="grid grid-cols-4 gap-4 w-full">
                          <div className="text-base font-semibold text-gray-900">{meeting.name}</div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4" />
                            {meeting.date}
                          </div>
                          <div className="text-sm text-gray-600">{meeting.participants.join(', ')}</div>
                          <div className="flex justify-end">
                            <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                              meeting.status === '완료' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              {meeting.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                  조건에 맞는 회의가 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Meeting Summary Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">회의록</h2>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowEditModal(true)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md flex items-center gap-2 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                회의록 수정
              </button>
              <button 
                onClick={downloadMeetingRecord}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md flex items-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                회의록 다운로드
              </button>
            </div>
          </div>
          
          {/* 진짜 회의록 내용을 위한 큰 텍스트 박스 */}
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-6 min-h-[400px]">
              <div className="prose max-w-none">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">📋 회의 기본 정보</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">회의명:</span>
                      <span className="ml-2 text-gray-800">{meetingData.basicInfo.meetingName}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">일시:</span>
                      <span className="ml-2 text-gray-800">{meetingData.basicInfo.date}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">참석자:</span>
                      <span className="ml-2 text-gray-800">{meetingData.basicInfo.participants}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">진행자:</span>
                      <span className="ml-2 text-gray-800">{meetingData.basicInfo.host}</span>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">🎯 회의 목적</h3>
                  <div className="bg-white rounded-md p-4 text-gray-700 leading-relaxed">
                    {editedSummary.purpose}
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">💬 주요 논의 내용</h3>
                  <div className="bg-white rounded-md p-4 text-gray-700 leading-relaxed min-h-[120px]">
                    {editedSummary.mainContent}
                    
                    <div className="mt-4 space-y-2">
                      <p><strong>• {meetingData.detailedContent.uiStatus.split(':')[0]}:</strong> {meetingData.detailedContent.uiStatus.split(':')[1]}</p>
                      <p><strong>• {meetingData.detailedContent.apiStatus.split(':')[0]}:</strong> {meetingData.detailedContent.apiStatus.split(':')[1]}</p>
                      <p><strong>• {meetingData.detailedContent.performance.split(':')[0]}:</strong> {meetingData.detailedContent.performance.split(':')[1]}</p>
                      <p><strong>• {meetingData.detailedContent.technicalIssues.split(':')[0]}:</strong> {meetingData.detailedContent.technicalIssues.split(':')[1]}</p>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">✅ 결정 사항 및 액션 아이템</h3>
                  <div className="bg-white rounded-md p-4 text-gray-700 leading-relaxed">
                    {editedSummary.decisions}
                    
                    <div className="mt-4">
                      <h4 className="font-semibold mb-2">📌 액션 아이템:</h4>
                      <ul className="space-y-1 ml-4">
                        {editedSummary.decisions.split('\n').filter(line => line.trim().startsWith('•')).map((line, index) => (
                          <li key={index}>{line.trim()}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500">
                    📝 회의 종료: 15:30 | 다음 회의: 2025년 1월 22일(수) 14:00 | 장소: 회의실 A
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Derived Tasks Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">파생 업무</h2>
          
          <div className="mb-4 grid grid-cols-5 gap-4 text-sm font-medium text-gray-700">
            <div>업무명:</div>
            <div>담당자:</div>
            <div>마감일:</div>
            <div>우선순위:</div>
            <div>상태:</div>
          </div>
          
          <div className="space-y-2">
            {meetingData.derivedTasks.map((task) => {
              const isOverdue = new Date(task.dueDate) < new Date() && task.status !== '완료';
              return (
                <div 
                  key={task.id} 
                  className="grid grid-cols-5 gap-4 p-3 bg-gray-50 rounded-md hover:bg-blue-50 transition-colors cursor-pointer relative group"
                  title={`상세 정보: ${task.name} - 담당: ${task.assignee}, 마감: ${task.dueDate}, 상태: ${task.status}`}
                >
                  <div className="text-sm">{task.name}</div>
                  <div className="text-sm">{task.assignee}</div>
                  <div className={`text-sm ${isOverdue ? 'text-red-600 font-semibold' : ''}`}>
                    {task.dueDate}
                    {isOverdue && <span className="ml-1">⚠️</span>}
                  </div>
                  <div className="text-sm">{task.priority}</div>
                  <div>
                    <span className={`px-2 py-1 text-xs text-white rounded-full ${task.statusColor}`}>
                      {task.status}
                    </span>
                  </div>
                  
                  {/* 호버 툴팁 */}
                  <div className="absolute bottom-full left-0 mb-2 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-64">
                    <div className="font-semibold mb-1">{task.name}</div>
                    <div>👤 담당자: {task.assignee}</div>
                    <div>📅 마감일: {task.dueDate}</div>
                    <div>🎯 우선순위: {task.priority}</div>
                    <div>📊 상태: {task.status}</div>
                    {isOverdue && <div className="text-red-300 mt-1">⚠️ 마감일이 지났습니다</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-80 bg-white shadow-lg p-6">


        {/* Next Meeting Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{meetingData.nextMeeting.title}</h3>
            <button
              onClick={() => setShowEditNextMeetingModal(true)}
              className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="다음 회의 정보 수정"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {meetingData.nextMeeting.details.map((detail, index) => (
              <div key={index} className="text-sm text-gray-600">
                {detail}
              </div>
            ))}
          </div>
          
          {/* Checklist */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">체크리스트:</span>
              <button
                onClick={startEditingChecklist}
                className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="체크리스트 편집"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-2">
            {checklist.map((item) => (
              <div key={item.id} className="flex items-center gap-2 p-1 rounded hover:bg-gray-50 transition-colors">
                <input 
                  type="checkbox" 
                  checked={item.completed}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  onChange={() => toggleChecklistItem(item.id)}
                />
                <span className={`text-sm transition-colors ${
                  item.completed ? 'line-through text-gray-400' : 'text-gray-600'
                }`}>
                  {item.text}
                </span>
              </div>
            ))}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>진행률</span>
              <span>{checklist.filter(item => item.completed).length}/{checklist.length}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${(checklist.filter(item => item.completed).length / checklist.length) * 100}%` 
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* Related Documents Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">관련 문서 및 참고 자료</h3>
          
          {/* 다운로드한 회의록 열기 버튼 */}
          <div className="space-y-2">
            <input
              type="file"
              accept=".docx,.doc,.pdf,.txt"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  // 파일이 선택되면 열기 (기본 프로그램으로)
                  const url = URL.createObjectURL(file);
                  const a = document.createElement('a');
                  a.href = url;
                  a.target = '_blank';
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success(`"${file.name}" 파일을 열었습니다! 📄`);
                }
              }}
              style={{ display: 'none' }}
              id="meeting-record-file"
            />
            <button 
              onClick={() => {
                document.getElementById('meeting-record-file')?.click();
              }}
              className="w-full text-center text-sm text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              📂 회의록 파일 선택해서 열기
            </button>
          </div>
          
          {/* Meeting Notes Upload */}
          <div className="mt-4">
            <div className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center hover:border-blue-400 cursor-pointer transition-colors">
              <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <div className="text-sm text-gray-600 mb-2">회의 녹음 파일</div>
              <button 
                onClick={handleFileUpload}
                className="text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors"
              >
                파일 업로드
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 회의록 수정 모달 */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[500px] max-w-[90vw] max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">회의록 수정</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">🎯 회의 목적</label>
                <textarea
                  value={editedSummary.purpose}
                  onChange={(e) => setEditedSummary({...editedSummary, purpose: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg h-24 resize-none"
                  placeholder="회의의 목적과 배경을 입력하세요..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">💬 주요 논의 내용</label>
                <textarea
                  value={editedSummary.mainContent}
                  onChange={(e) => setEditedSummary({...editedSummary, mainContent: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg h-32 resize-none"
                  placeholder="회의에서 논의된 주요 내용들을 상세히 입력하세요..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">✅ 결정 사항 및 액션 아이템</label>
                <textarea
                  value={editedSummary.decisions}
                  onChange={(e) => setEditedSummary({...editedSummary, decisions: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg h-28 resize-none"
                  placeholder="회의에서 결정된 사항과 향후 액션 아이템을 입력하세요..."
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  // 회의록 수정 시 파생업무도 자동 업데이트
                  const newDerivedTasks = generateDerivedTasksFromContent(editedSummary.decisions);
                  setDerivedTasks(newDerivedTasks);
                  setShowEditModal(false);
                  toast.success('회의록이 수정되었습니다! 파생업무도 업데이트되었어요! 📝✨');
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 새 업무 생성 모달 */}
      {showNewTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-[90vw]">
            <h3 className="text-lg font-semibold mb-4">새 업무 생성</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">업무명</label>
                <input
                  type="text"
                  placeholder="업무명을 입력하세요"
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">담당자</label>
                <input
                  type="text"
                  placeholder="담당자를 입력하세요"
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">마감일</label>
                  <input
                    type="date"
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">우선순위</label>
                  <select className="w-full p-2 border border-gray-300 rounded-lg">
                    <option value="상">상</option>
                    <option value="중">중</option>
                    <option value="하">하</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">업무 설명</label>
                <textarea
                  placeholder="업무에 대한 설명을 입력하세요"
                  className="w-full p-2 border border-gray-300 rounded-lg h-20 resize-none"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNewTaskModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  setShowNewTaskModal(false);
                  toast.success('새 업무가 생성되었습니다! ✨');
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                생성
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 다음 회의 편집 모달 */}
      {showEditNextMeetingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-[90vw]">
            <h3 className="text-lg font-semibold mb-4">다음 회의 정보 수정</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">회의 제목</label>
                <input
                  type="text"
                  value={nextMeetingInfo.title}
                  onChange={(e) => setNextMeetingInfo(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="예: ▶ 다음 회의: 07.19 (수)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">진행자</label>
                <input
                  type="text"
                  value={nextMeetingInfo.host}
                  onChange={(e) => setNextMeetingInfo(prev => ({ ...prev, host: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="진행자 이름을 입력하세요"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">준비사항</label>
                <textarea
                  value={nextMeetingInfo.preparations}
                  onChange={(e) => setNextMeetingInfo(prev => ({ ...prev, preparations: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent h-20 resize-none"
                  placeholder="회의 준비사항을 입력하세요"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditNextMeetingModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  setShowEditNextMeetingModal(false);
                  toast.success('다음 회의 정보가 수정되었습니다! 📅');
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 체크리스트 편집 모달 */}
      {showEditChecklistModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-[90vw] max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">체크리스트 편집</h3>
            <div className="space-y-3">
              {editingChecklist.map((item, index) => (
                <div key={item.id} className="flex items-center gap-2 p-2 border rounded-lg">
                  <input
                    type="text"
                    value={item.text}
                    onChange={(e) => updateChecklistItemText(item.id, e.target.value)}
                    className="flex-1 p-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="체크리스트 항목을 입력하세요"
                  />
                  <button
                    onClick={() => deleteChecklistItem(item.id)}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                    title="삭제"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              
              {/* 새 항목 추가 버튼 */}
              <button
                onClick={addChecklistItem}
                className="w-full p-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                새 항목 추가
              </button>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={cancelChecklistEdit}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                취소
              </button>
              <button
                onClick={saveChecklist}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingAnalysis; 