/**
 * AI 서비스 - Enhanced AI 서버와 연동
 * Triplet 파이프라인 및 BERT 분류 지원
 * WhisperX + Triplet + BERT + Qwen 통합 처리
 */
import axiosInstance from '../lib/axios';
import axios from 'axios';
import FormData from 'form-data';
import https from 'https';

interface TranscriptionResult {
  success: boolean;
  transcription?: {
    segments: any[];
    full_text: string;
    language: string;
    duration: number;
  };
  error?: string;
}

// 새로운 Enhanced 인터페이스들
interface EnhancedTranscriptionResult {
  success: boolean;
  transcription?: any;
  triplet_data?: {
    triplets: any[];
    conversation_segments: any[];
    statistics: {
      total_triplets: number;
      filtered_triplets: number;
      conversation_segments: number;
      speakers: string[];
      total_duration: number;
      average_context_quality: number;
    };
  };
  filtered_transcript?: string;
  processing_stats?: {
    processing_time: number;
    total_segments: number;
    total_triplets: number;
    conversation_segments: number;
  };
  error?: string;
}

interface TripletAnalysisResult {
  success: boolean;
  triplets?: any[];
  classification_stats?: {
    total_triplets: number;
    filtered_triplets: number;
    noise_triplets: number;
    noise_reduction_ratio: number;
    method: string;
  };
  conversation_segments?: any[];
  filtered_text?: string;
  error?: string;
}

interface EnhancedTwoStageResult {
  success: boolean;
  triplet_stats?: any;
  classification_stats?: any;
  stage1_notion?: any;
  stage2_prd?: any;
  stage3_tasks?: any;
  formatted_notion?: string;
  formatted_prd?: string;
  original_transcript_length?: number;
  filtered_transcript_length?: number;
  noise_reduction_ratio?: number;
  processing_time?: number;
  error?: string;
}

interface AnalysisResult {
  success: boolean;
  analysis?: {
    summary: string;
    action_items: Array<{
      task: string;
      assignee: string;
      deadline: string;
      priority: string;
    }>;
    decisions: string[];
    next_steps: string[];
    key_points: string[];
  };
  error?: string;
}

interface PipelineResult {
  success: boolean;
  transcription?: any;
  analysis?: any;
  analysis_success?: boolean;
  step?: string;
  error?: string;
}

interface NotionProjectResult {
  success: boolean;
  notion_project?: {
    title: string;
    overview: string;
    objectives: string[];
    key_deliverables: string[];
    timeline: string;
    stakeholders: string[];
    technical_requirements: string[];
    risks_and_mitigations: string[];
    success_metrics: string[];
    next_steps: string[];
  };
  error?: string;
}

interface TaskMasterPRDResult {
  success: boolean;
  prd?: {
    title: string;
    overview: string;
    scope: string;
    user_stories: Array<{
      title: string;
      description: string;
      acceptance_criteria: string[];
      priority: string;
      estimated_hours: number;
    }>;
    technical_requirements: string[];
    constraints: string[];
    success_metrics: string[];
  };
  error?: string;
}

interface GeneratedTasksResult {
  success: boolean;
  tasks?: Array<{
    title: string;
    description: string;
    priority: string;
    estimated_hours: number;
    complexity: string;
    startDate?: string | undefined; // YYYY-MM-DD 형식
    dueDate?: string | undefined; // YYYY-MM-DD 형식
    subtasks: Array<{
      title: string;
      description: string;
      estimated_hours: number;
      startDate?: string | undefined;
      dueDate?: string | undefined;
    }>;
    dependencies: string[];
    acceptance_criteria: string[];
    tags: string[];
  }>;
  error?: string;
}

interface TwoStagePipelineResult {
  success: boolean;
  stage1?: {
    transcript?: string;
    notion_project?: any;
  };
  stage2?: {
    task_master_prd?: any;
  };
  transcription?: any;
  notion_project?: any;
  prd?: any;
  tasks?: any;
  step?: string;
  error?: string;
  session_id?: string;
}

class AIService {
  private baseUrl: string;
  private timeout: number;
  private aiAxios: any;

  constructor() {
    this.baseUrl = process.env.RUNPOD_AI_URL || 'http://localhost:8000';
    // Localtunnel 등 시간 제한 없는 서비스 사용 시 10분으로 설정
    this.timeout = parseInt(process.env.AI_TIMEOUT || '600000'); // 10분
    
    // AI 서버 전용 axios 인스턴스 생성
    this.aiAxios = axios.create({
      baseURL: this.baseUrl,  // 중요: baseURL 설정 필수!
      timeout: this.timeout,
      headers: {
        'Connection': 'keep-alive',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Bypass-Tunnel-Reminder': 'true' // Localtunnel bypass 시도
      }
    });
  }

  /**
   * AI 서버 헬스 체크
   */
  async healthCheck(): Promise<any> {
  try {
    const response = await axiosInstance.get(`${this.baseUrl}/health`, {
      timeout: 10000
    });
    return response.data;
  } catch (error) {
    console.error('[AIService.healthCheck] 실패:', error);
    throw error;
  }
}

  /**
   * 음성 파일 전사
   */
  async transcribeAudio(audioBuffer: Buffer, filename?: string): Promise<TranscriptionResult> {
    try {
      console.log(`🎤 Transcribing audio: ${filename || 'unknown'} (${audioBuffer.length} bytes)`);

      const formData = new FormData();
      formData.append('audio', audioBuffer, {
        filename: filename || 'audio.wav',
        contentType: 'audio/wav'
      });

      const response = await axiosInstance.post<TranscriptionResult>(`${this.baseUrl}/transcribe`, formData, {
        timeout: this.timeout,
        headers: formData.getHeaders()
      });

      const result: TranscriptionResult = response.data;

      if (result.success) {
        console.log(`✅ Transcription completed: ${result.transcription?.full_text?.length || 0} characters`);
      } else {
        console.error(`❌ Transcription failed: ${result.error}`);
      }

      return result;

    } catch (error: any) {
      console.error('❌ Transcription error:', error);

      return {
        success: false,
        error: error?.response?.data?.error || error.message || 'Unknown error'
      };
    }
  }

  /**
   * 회의 내용 분석
   */
  async analyzeMeeting(transcript: string): Promise<AnalysisResult> {
    try {
      console.log(`🧠 Analyzing meeting: ${transcript.length} characters`);

      const response = await axiosInstance.post<AnalysisResult>(`${this.baseUrl}/analyze`, { transcript }, {
        timeout: this.timeout
      });

      const result: AnalysisResult = response.data;

      if (result.success) {
        console.log(`✅ Analysis completed`);
      } else {
        console.error(`❌ Analysis failed: ${result.error}`);
      }

      return result;

    } catch (error: any) {
      console.error('❌ Analysis error:', error);

      return {
        success: false,
        error: error?.response?.data?.error || error.message || 'Unknown error'
      };
    }
  }

  /**
   * 전체 파이프라인: 음성 → 전사 → 분석
   */
  async processFullPipeline(audioBuffer: Buffer, filename?: string): Promise<PipelineResult> {
    try {
      console.log(`🚀 Starting full pipeline: ${filename || 'unknown'}`);

      const formData = new FormData();
      formData.append('audio', audioBuffer, {
        filename: filename || 'audio.wav',
        contentType: 'audio/wav'
      });

      const response = await axiosInstance.post<PipelineResult>(`${this.baseUrl}/pipeline`, formData, {
        timeout: this.timeout,
        headers: formData.getHeaders()
      });

      const result: PipelineResult = response.data;

      if (result.success) {
        console.log(`✅ Pipeline completed successfully`);
      } else {
        console.error(`❌ Pipeline failed at ${result.step}: ${result.error}`);
      }

      return result;

    } catch (error: any) {
      console.error('❌ Pipeline error:', error);

      return {
        success: false,
        error: error?.response?.data?.error || error.message || 'Unknown error'
      };
    }
  }

  /**
   * 회의 내용을 노션 프로젝트 문서로 변환
   */
  async generateNotionProject(transcript: string): Promise<NotionProjectResult> {
    try {
      console.log(`📋 Generating Notion project: ${transcript.length} characters`);

      const response = await axiosInstance.post<NotionProjectResult>(`${this.baseUrl}/generate-notion-project`, { transcript }, {
        timeout: this.timeout
      });

      const result: NotionProjectResult = response.data;

      if (result.success) {
        console.log(`✅ Notion project generated successfully`);
      } else {
        console.error(`❌ Notion project generation failed: ${result.error}`);
      }

      return result;

    } catch (error: any) {
      console.error('❌ Notion project generation error:', error);

      return {
        success: false,
        error: error?.response?.data?.error || error.message || 'Unknown error'
      };
    }
  }

  /**
   * 노션 프로젝트 문서를 Task Master PRD 형식으로 변환
   */
  async generateTaskMasterPRD(notionProject: any): Promise<TaskMasterPRDResult> {
    try {
      console.log(`📝 Generating Task Master PRD`);

      const response = await axiosInstance.post<TaskMasterPRDResult>(`${this.baseUrl}/generate-task-master-prd`, notionProject, {
        timeout: this.timeout
      });

      const result: TaskMasterPRDResult = response.data;

      if (result.success) {
        console.log(`✅ Task Master PRD generated successfully`);
      } else {
        console.error(`❌ PRD generation failed: ${result.error}`);
      }

      return result;

    } catch (error: any) {
      console.error('❌ PRD generation error:', error);

      return {
        success: false,
        error: error?.response?.data?.error || error.message || 'Unknown error'
      };
    }
  }

  /**
   * Task Master PRD를 기반으로 세부 업무 생성
   */
  async generateTasks(prd: any): Promise<GeneratedTasksResult> {
    try {
      console.log(`⚡ Generating tasks from PRD using VLLM AI server`);

      try {
        // AI 서버는 prd 필드를 요구함
        const requestBody = {
          prd: typeof prd === 'string' ? prd : JSON.stringify(prd),
          num_tasks: 5
        };
        
        // 비동기 엔드포인트 사용 (/generate-tasks-async)
        const asyncResponse = await this.aiAxios.post('/generate-tasks-async', requestBody, {
          timeout: 20000 // 20초로 증가
        });
        
        if (asyncResponse.data.success && asyncResponse.data.job_id) {
          console.log(`✅ Async task generation job created: ${asyncResponse.data.job_id}`);
          const result = await this.pollJobResult(asyncResponse.data.job_id);
          
          if (result.success) {
            console.log(`✅ Tasks generated successfully via VLLM: ${result.tasks?.length || 0} tasks`);
            return result;
          }
        }

      } catch (error: any) {
        console.warn(`AI 서버 비동기 실패, 동기 방식 시도: ${error.message}`);
        
        // 폴백: 동기 방식 시도
        try {
          const requestBody = {
            prd: typeof prd === 'string' ? prd : JSON.stringify(prd),
            num_tasks: 5
          };
          
          const response = await this.aiAxios.post('/generate-tasks', requestBody, {
            timeout: 90000 // 90초 제한
          });

          const result: GeneratedTasksResult = response.data;

          if (result.success) {
            console.log(`✅ Tasks generated successfully via sync: ${result.tasks?.length || 0} tasks`);
            return result;
          }
        } catch (syncError: any) {
          console.warn(`AI 서버 연결 실패: ${syncError.message}`);
        }
      }

      // fallback dummy data
      console.log('⚠️ AI server failed, using fallback dummy tasks');

      const today = new Date();
      const formatDate = (daysFromToday: number) => {
        const date = new Date(today);
        date.setDate(date.getDate() + daysFromToday);
        return date.toISOString().split('T')[0];
      };
      
      console.log(`📅 일정 생성 기준일: ${today.toISOString().split('T')[0]} (사용자가 명령어 입력한 날짜)`);

      const dummyTasks = [
        {
          title: "사용자 인증 시스템 구현",
          description: "회원가입, 로그인, 로그아웃, 비밀번호 재설정 기능 구현. JWT 토큰 기반 인증 및 OAuth 소셜 로그인 연동.",
          priority: "high",
          estimated_hours: 24,
          complexity: "HIGH",
          startDate: formatDate(0), // 오늘부터 시작
          dueDate: formatDate(14), // 14일 후 완료 (2주)
          subtasks: [
            {
              title: "회원가입 API 개발",
              description: "이메일 인증을 포함한 회원가입 기능",
              estimated_hours: 8,
              startDate: formatDate(0),
              dueDate: formatDate(4)
            },
            {
              title: "로그인/로그아웃 구현",
              description: "JWT 토큰 기반 인증 시스템",
              estimated_hours: 8,
              startDate: formatDate(5),
              dueDate: formatDate(9)
            },
            {
              title: "OAuth 소셜 로그인",
              description: "구글, 페이스북, 카카오 로그인 연동",
              estimated_hours: 8,
              startDate: formatDate(10),
              dueDate: formatDate(14)
            }
          ],
          dependencies: [],
          acceptance_criteria: [
            "이메일 인증 후 회원가입 완료",
            "JWT 토큰으로 로그인 상태 유지",
            "소셜 로그인으로 간편 가입 가능"
          ],
          tags: ["backend", "authentication", "security"]
        },
        {
          title: "상품 관리 시스템 개발",
          description: "상품 등록, 수정, 삭제, 조회 기능. 카테고리 분류, 이미지 업로드, 재고 관리 포함.",
          priority: "high",
          estimated_hours: 32,
          complexity: "HIGH",
          startDate: formatDate(15), // 인증 시스템 완료 후
          dueDate: formatDate(34), // 20일간 진행
          subtasks: [
            {
              title: "상품 CRUD API",
              description: "상품 생성, 조회, 수정, 삭제 API",
              estimated_hours: 12,
              startDate: formatDate(15),
              dueDate: formatDate(21)
            },
            {
              title: "카테고리 관리",
              description: "상품 카테고리 분류 시스템",
              estimated_hours: 8,
              startDate: formatDate(22),
              dueDate: formatDate(26)
            },
            {
              title: "이미지 업로드",
              description: "상품 이미지 업로드 및 관리",
              estimated_hours: 8,
              startDate: formatDate(27),
              dueDate: formatDate(31)
            },
            {
              title: "재고 관리",
              description: "상품 재고 추적 및 알림",
              estimated_hours: 4,
              startDate: formatDate(32),
              dueDate: formatDate(34)
            }
          ],
          dependencies: ["사용자 인증 시스템"],
          acceptance_criteria: [
            "관리자가 상품을 등록/수정/삭제할 수 있음",
            "카테고리별 상품 분류 가능",
            "다중 이미지 업로드 지원",
            "재고 부족 시 알림 발송"
          ],
          tags: ["backend", "product", "management"]
        },
        {
          title: "장바구니 및 주문 시스템",
          description: "장바구니 담기, 수량 변경, 주문 처리, 주문 내역 조회 기능 구현.",
          priority: "high",
          estimated_hours: 28,
          complexity: "HIGH",
          subtasks: [
            {
              title: "장바구니 기능",
              description: "상품 담기, 수량 변경, 삭제",
              estimated_hours: 10
            },
            {
              title: "주문 처리",
              description: "주문 생성 및 상태 관리",
              estimated_hours: 12
            },
            {
              title: "주문 내역",
              description: "사용자별 주문 이력 조회",
              estimated_hours: 6
            }
          ],
          dependencies: ["사용자 인증 시스템", "상품 관리 시스템"],
          acceptance_criteria: [
            "로그인 사용자가 장바구니에 상품 추가 가능",
            "장바구니에서 수량 변경 및 삭제 가능",
            "주문 완료 후 주문 내역 확인 가능"
          ],
          tags: ["backend", "cart", "order"]
        },
        {
          title: "결제 시스템 연동",
          description: "PG사 연동을 통한 온라인 결제 시스템. 카드결제, 계좌이체, 간편결제 지원.",
          priority: "high",
          estimated_hours: 20,
          complexity: "HIGH",
          subtasks: [
            {
              title: "PG사 연동",
              description: "토스페이먼츠, 아임포트 등 PG사 API 연동",
              estimated_hours: 12
            },
            {
              title: "결제 검증",
              description: "결제 완료 검증 및 보안 처리",
              estimated_hours: 8
            }
          ],
          dependencies: ["장바구니 및 주문 시스템"],
          acceptance_criteria: [
            "다양한 결제 수단 지원",
            "결제 완료 후 주문 상태 자동 업데이트",
            "결제 실패 시 적절한 오류 처리"
          ],
          tags: ["backend", "payment", "integration"]
        },
        {
          title: "리뷰 및 평점 시스템",
          description: "구매 고객의 상품 리뷰 작성, 평점 등록, 리뷰 관리 기능.",
          priority: "medium",
          estimated_hours: 16,
          complexity: "MEDIUM",
          subtasks: [
            {
              title: "리뷰 작성",
              description: "구매 확정 후 리뷰 작성 기능",
              estimated_hours: 8
            },
            {
              title: "평점 시스템",
              description: "5점 만점 평점 및 평균 평점 계산",
              estimated_hours: 4
            },
            {
              title: "리뷰 관리",
              description: "부적절한 리뷰 신고 및 관리",
              estimated_hours: 4
            }
          ],
          dependencies: ["주문 시스템", "상품 관리 시스템"],
          acceptance_criteria: [
            "구매 확정 후에만 리뷰 작성 가능",
            "상품별 평균 평점 표시",
            "부적절한 리뷰 신고 및 삭제 가능"
          ],
          tags: ["backend", "review", "rating"]
        },
        {
          title: "관리자 대시보드",
          description: "전체 시스템 관리를 위한 관리자 웹 대시보드. 통계, 주문 관리, 고객 관리 포함.",
          priority: "medium",
          estimated_hours: 24,
          complexity: "MEDIUM",
          subtasks: [
            {
              title: "대시보드 UI",
              description: "관리자 대시보드 프론트엔드",
              estimated_hours: 12
            },
            {
              title: "통계 API",
              description: "매출, 주문, 고객 통계 API",
              estimated_hours: 8
            },
            {
              title: "관리 기능",
              description: "주문, 상품, 고객 관리 기능",
              estimated_hours: 4
            }
          ],
          dependencies: ["모든 백엔드 시스템"],
          acceptance_criteria: [
            "실시간 매출 및 주문 통계 조회",
            "주문 상태 일괄 변경 가능",
            "고객 및 상품 정보 관리 가능"
          ],
          tags: ["frontend", "admin", "dashboard"]
        }
      ];

      console.log(`✅ Fallback tasks generated successfully: ${dummyTasks.length} tasks`);
      console.log('\n📋 생성된 업무 목록:');
      dummyTasks.forEach((task, index) => {
        console.log(`\n${index + 1}. 📌 ${task.title}`);
        console.log(`   📝 설명: ${task.description.substring(0, 100)}...`);
        console.log(`   ⚡ 복잡도: ${task.complexity}/10`);
        console.log(`   🎯 우선순위: ${task.priority}`);
        console.log(`   ⏱️ 예상시간: ${task.estimated_hours}시간`);
        if (task.subtasks && task.subtasks.length > 0) {
          console.log(`   📂 하위업무: ${task.subtasks.length}개`);
        }
      });
      console.log('\n🎉 업무 생성 완료!\n');
      
      return {
        success: true,
        tasks: dummyTasks
      };
    } catch (error) {
      console.error('❌ Task generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 2단계 전체 파이프라인: 음성 → 전사 → 노션 프로젝트 → PRD → 업무 생성
   */
  /**
   * Job 결과를 폴링으로 가져오기
   */
  private async pollJobResult(jobId: string, maxAttempts: number = 120): Promise<any> {
    console.log(`⏳ Polling job ${jobId}...`);
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        // 상태 확인
        const statusResponse = await this.aiAxios.get(`/job-status/${jobId}`, {
          timeout: 5000
        });
        
        const status = statusResponse.data.status;
        const progress = statusResponse.data.progress || 0;
        
        console.log(`📊 Job ${jobId}: ${status} (${progress}%)`);
        
        if (status === 'completed') {
          // 결과 가져오기
          const resultResponse = await this.aiAxios.get(`/job-result/${jobId}`, {
            timeout: 10000
          });
          console.log(`✅ Job ${jobId} completed successfully`);
          return resultResponse.data;
        }
        
        if (status === 'failed') {
          console.error(`❌ Job ${jobId} failed: ${statusResponse.data.error}`);
          throw new Error(statusResponse.data.error || 'Job failed');
        }
        
        // 5초 대기
        await new Promise(resolve => setTimeout(resolve, 5000));
        
      } catch (error: any) {
        console.error(`❌ Error polling job ${jobId}:`, error.message);
        // 계속 시도
      }
    }
    
    throw new Error(`Job ${jobId} timeout after ${maxAttempts * 5} seconds`);
  }

  async processTwoStagePipeline(audioBuffer: Buffer, filename?: string): Promise<TwoStagePipelineResult> {
    // 먼저 비동기 처리 시도
    try {
      console.log(`🚀 Starting async 2-stage pipeline: ${filename || 'unknown'}`);
      console.log(`📊 Audio buffer size: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`);
      
      const isTextInput = filename?.endsWith('.txt') || audioBuffer.toString('utf-8').length < 10000;
      
      if (isTextInput) {
        const transcript = audioBuffer.toString('utf-8');
        
        // 비동기 엔드포인트 호출 - Job ID 받기용 타임아웃 증가
        const response = await this.aiAxios.post('/pipeline-final-async', {
          transcript,
          generate_notion: true,
          generate_tasks: true,
          num_tasks: 5
        }, { timeout: 30000 }); // 30초로 증가
        
        if (response.data.success && response.data.job_id) {
          console.log(`✅ Async job created: ${response.data.job_id}`);
          const result = await this.pollJobResult(response.data.job_id);
          
          // 결과 포맷팅
          let tasks = [];
          if (result.stage3_tasks) {
            if (Array.isArray(result.stage3_tasks)) {
              tasks = result.stage3_tasks;
            } else if (result.stage3_tasks.action_items) {
              tasks = result.stage3_tasks.action_items;
            } else if (result.stage3_tasks.tasks) {
              tasks = result.stage3_tasks.tasks;
            }
          }
          
          return {
            success: result.success,
            stage1: {
              transcript: transcript,
              notion_project: result.stage1_notion
            },
            stage2: {
              task_master_prd: {
                ...result.stage2_prd,
                tasks: tasks
              }
            }
          };
        }
      } else {
        const formData = new FormData();
        formData.append('audio', audioBuffer, {
          filename: filename || 'audio.mp3',
          contentType: 'audio/mpeg'
        });
        formData.append('generate_notion', 'true');
        formData.append('generate_tasks', 'true');
        formData.append('num_tasks', '5');
        
        // 비동기 엔드포인트 호출 - Job ID 받기용 타임아웃 증가
        const response = await this.aiAxios.post('/pipeline-final-async', formData, {
          headers: formData.getHeaders(),
          timeout: 30000  // 30초로 증가 (대용량 파일 업로드 시간 고려)
        });
        
        if (response.data.success && response.data.job_id) {
          console.log(`✅ Async job created: ${response.data.job_id}`);
          const result = await this.pollJobResult(response.data.job_id);
          
          // 결과 포맷팅
          let tasks = [];
          if (result.stage3_tasks) {
            if (Array.isArray(result.stage3_tasks)) {
              tasks = result.stage3_tasks;
            } else if (result.stage3_tasks.action_items) {
              tasks = result.stage3_tasks.action_items;
            } else if (result.stage3_tasks.tasks) {
              tasks = result.stage3_tasks.tasks;
            }
          }
          
          return {
            success: result.success,
            stage1: {
              transcript: result.transcript || '',
              notion_project: result.stage1_notion
            },
            stage2: {
              task_master_prd: {
                ...result.stage2_prd,
                tasks: tasks
              }
            }
          };
        }
      }
    } catch (error: any) {
      console.log(`⚠️ Async pipeline failed: ${error.message}, falling back to sync...`);
    }
    
    // 폴백: 동기 처리
    try {
      console.log(`🚀 Starting sync 2-stage pipeline: ${filename || 'unknown'}`);
      console.log(`📊 Audio buffer size: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`);
      
      // 파일 크기 체크 제거 - AI 서버가 처리할 수 있는 크기까지 허용
      // const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
      // if (audioBuffer.length > MAX_FILE_SIZE) {
      //   console.error(`❌ File too large: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB (max: 100MB)`);
      //   return {
      //     success: false,
      //     error: `파일 크기가 너무 큽니다 (${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB). 최대 100MB까지 지원됩니다.`
      //   };
      // }

      try {
        const isTextInput = filename?.endsWith('.txt') || audioBuffer.toString('utf-8').length < 10000;

        let result: TwoStagePipelineResult;

        if (isTextInput) {
          const transcript = audioBuffer.toString('utf-8');

          const response = await this.aiAxios.post('/pipeline-final', {
            transcript,
            generate_notion: true,
            generate_tasks: true,
            num_tasks: 5
          });

          // AI 서버 응답을 백엔드 형식으로 변환
          const aiResponse = response.data;
          
          // stage3_tasks가 배열인 경우와 객체인 경우 모두 처리
          let tasks = [];
          if (aiResponse.stage3_tasks) {
            if (Array.isArray(aiResponse.stage3_tasks)) {
              tasks = aiResponse.stage3_tasks;
            } else if (aiResponse.stage3_tasks.action_items) {
              tasks = aiResponse.stage3_tasks.action_items;  // AI 서버가 실제로 보내는 키
            } else if (aiResponse.stage3_tasks.tasks) {
              tasks = aiResponse.stage3_tasks.tasks;
            } else if (aiResponse.stage3_tasks.task_items) {
              tasks = aiResponse.stage3_tasks.task_items;
            }
          }
          
          result = {
            success: aiResponse.success,
            stage1: {
              transcript: transcript,
              notion_project: aiResponse.stage1_notion
            },
            stage2: {
              task_master_prd: {
                ...aiResponse.stage2_prd,
                tasks: tasks
              }
            }
          };
          if (aiResponse.error) {
            result.error = aiResponse.error;
          }

        } else {
          const formData = new FormData();
          
          // 오디오 파일 추가
          formData.append('audio', audioBuffer, {
            filename: filename || 'audio.mp3',
            contentType: 'audio/mpeg'  // MP3 파일이므로 contentType 수정
          });
          
          // 다른 파라미터들 추가
          formData.append('generate_notion', 'true');
          formData.append('generate_tasks', 'true');
          formData.append('num_tasks', '5');
          
          console.log('📤 FormData 전송 정보:', {
            filename: filename || 'audio.mp3',
            bufferSize: audioBuffer.length,
            headers: formData.getHeaders()
          });

          const response = await this.aiAxios.post('/pipeline-final', formData, {
            headers: {
              ...formData.getHeaders(),
              'Accept': 'application/json'
            }
          });

          // AI 서버 응답을 백엔드 형식으로 변환
          let aiResponse = response.data;
          
          // 더 자세한 디버깅 로그 추가
          console.log('🔍 AI 서버 전체 응답 키:', Object.keys(aiResponse));
          console.log('🔍 AI 서버 success 값:', aiResponse.success);
          
          // AI 서버가 analysis 객체 안에 데이터를 보내는 경우 처리
          if (!aiResponse.stage3_tasks && aiResponse.analysis) {
            console.log('🔄 analysis 객체에서 데이터 추출 중...');
            
            // analysis 객체의 데이터를 최상위로 이동
            if (aiResponse.analysis.notion_project) {
              aiResponse.stage1_notion = aiResponse.analysis.notion_project;
              console.log('✅ stage1_notion 복원됨');
            }
            
            if (aiResponse.analysis.task_master_prd) {
              aiResponse.stage2_prd = aiResponse.analysis.task_master_prd;
              console.log('✅ stage2_prd 복원됨');
            }
            
            if (aiResponse.analysis.generated_tasks) {
              aiResponse.stage3_tasks = aiResponse.analysis.generated_tasks;
              console.log('✅ stage3_tasks 복원됨:', typeof aiResponse.analysis.generated_tasks);
            }
          }
          
          // stage3_tasks 상세 확인
          if (aiResponse.stage3_tasks) {
            console.log('📌 stage3_tasks 타입:', typeof aiResponse.stage3_tasks);
            console.log('📌 stage3_tasks 키들:', Object.keys(aiResponse.stage3_tasks));
            
            if (aiResponse.stage3_tasks.action_items) {
              console.log('✅ action_items 발견! 개수:', aiResponse.stage3_tasks.action_items.length);
              if (aiResponse.stage3_tasks.action_items.length > 0) {
                console.log('📋 첫 번째 태스크:', aiResponse.stage3_tasks.action_items[0]);
              }
            }
          } else {
            console.log('❌ 여전히 stage3_tasks가 없음!');
          }
          
          // 디버깅: AI 응답 구조 확인
          console.log('🔍 AI 서버 원본 응답 구조:', {
            hasStage1Notion: !!aiResponse.stage1_notion,
            hasStage2PRD: !!aiResponse.stage2_prd,
            hasStage3Tasks: !!aiResponse.stage3_tasks,
            stage3TasksType: typeof aiResponse.stage3_tasks,
            stage3TasksKeys: aiResponse.stage3_tasks ? Object.keys(aiResponse.stage3_tasks) : [],
            taskCount: aiResponse.stage3_tasks?.action_items?.length ||
                       aiResponse.stage3_tasks?.tasks?.length || 
                       aiResponse.stage3_tasks?.length || 0
          });
          
          // stage3_tasks가 배열인 경우와 객체인 경우 모두 처리
          let tasks = [];
          if (aiResponse.stage3_tasks) {
            if (Array.isArray(aiResponse.stage3_tasks)) {
              tasks = aiResponse.stage3_tasks;
            } else if (aiResponse.stage3_tasks.action_items) {
              tasks = aiResponse.stage3_tasks.action_items;  // AI 서버가 실제로 보내는 키
            } else if (aiResponse.stage3_tasks.tasks) {
              tasks = aiResponse.stage3_tasks.tasks;
            } else if (aiResponse.stage3_tasks.task_items) {
              tasks = aiResponse.stage3_tasks.task_items;
            }
          }
          
          console.log(`✅ 추출된 업무: ${tasks.length}개`);
          
          result = {
            success: aiResponse.success,
            stage1: {
              transcript: aiResponse.transcription?.full_text || '',
              notion_project: aiResponse.stage1_notion
            },
            stage2: {
              task_master_prd: {
                ...aiResponse.stage2_prd,
                tasks: tasks
              }
            }
          };
          if (aiResponse.error) {
            result.error = aiResponse.error;
          }
        }

        // AI 서버에서 BERT 필터링 후 유효한 내용이 없다고 판단한 경우
        if (!result.success && (result.error?.includes('유효한 회의 내용') || result.error?.includes('너무 짧거나 비어있습니다'))) {
          console.log('⚠️ No valid content detected after BERT filtering');
          return result; // 에러 메시지를 그대로 전달
        }

        console.log(`✅ 2-stage pipeline completed successfully via AI server`);
        return result;

      } catch (error: any) {
        // 특정 에러 메시지 체크 (BERT 필터링 관련)
        if (error?.response?.data?.step === 'bert_filtering' || error?.response?.data?.step === 'transcription_validation') {
          console.log('⚠️ Content validation failed:', error.response.data.error);
          return {
            success: false,
            error: error.response.data.error,
            step: error.response.data.step
          };
        }
        
        console.warn(`AI 서버 연결 실패: ${error?.response?.data?.error || error.message || 'Unknown error'}`);
      }

      // 🔁 fallback 더미 처리
      console.log(`⚠️ AI 서버 연결 실패, 더미 응답 사용`);

      const transcript = audioBuffer.toString('utf-8');
      
      // 더미 PRD 생성
      const dummyPrd = {
        overview: "AI 기반 프로젝트 관리 시스템 구축",
        core_features: [
          { name: "음성 인식 시스템", description: "회의 음성을 텍스트로 변환" },
          { name: "업무 자동 생성", description: "회의 내용을 분석하여 업무 자동 생성" },
          { name: "스마트 할당", description: "팀원 역량에 따른 업무 자동 할당" }
        ],
        user_experience: {
          target_users: ["개발팀", "기획팀", "디자인팀"],
          user_journey: "음성 업로드 → AI 분석 → 업무 생성 → 팀원 할당"
        },
        technical_architecture: {
          frontend: "React, TypeScript",
          backend: "Node.js, Express",
          database: "PostgreSQL, Prisma ORM",
          infrastructure: "AWS EC2, S3"
        },
        development_roadmap: [
          { phase: "1단계", period: "2주", details: "기본 시스템 구축" },
          { phase: "2단계", period: "2주", details: "AI 기능 통합" },
          { phase: "3단계", period: "1주", details: "테스트 및 배포" }
        ]
      };
      
      const tasksResult = await this.generateTasks(dummyPrd);

      if (!tasksResult.success || !tasksResult.tasks) {
        throw new Error('업무 생성 실패');
      }

      const dummyResult: TwoStagePipelineResult = {
        success: true,
        stage1: {
          transcript: transcript,
          notion_project: {
            title: "딸깍 프로젝트 기획서",
            overview: "AI 기반 프로젝트 관리 시스템 구축",
            sections: [
              {
                title: "프로젝트 개요",
                content: "효율적인 업무 관리를 위한 AI 시스템"
              },
              {
                title: "기술 스택",
                content: "React, Node.js, PostgreSQL, AI 엔진"
              }
            ]
          }
        },
        stage2: {
          task_master_prd: {
            title: "딸깍 시스템 개발",
            overview: "AI 기반 프로젝트 관리 시스템 구축",
            tasks: tasksResult.tasks
          }
        }
      };

      console.log(`✅ 2-stage pipeline completed successfully (dummy response)`);
      return dummyResult;

    } catch (error: any) {
      console.error('❌ 2-stage pipeline error:', error);

      return {
        success: false,
        error: error?.message || 'Unknown error'
      };
    }
  }


  /**
   * AI 서버 연결 테스트
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 슬랙에서 음성 파일 처리 (호환성을 위한 메서드)
   */
  async processAudioFile(params: {
    fileUrl: string;
    fileName: string;
    projectName: string;
    userId: string;
    tenantId?: string;
  }): Promise<any> {
    try {
      console.log(`🎤 Processing audio file from Slack: ${params.fileName}`);
      
      // 파일 다운로드
      const response = await axiosInstance.get(params.fileUrl, {
        responseType: 'arraybuffer',
        headers: {
          'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`
        }
      });
      
      const audioBuffer = Buffer.from(response.data as ArrayBuffer);
      
      // 2단계 파이프라인 실행 (음성 → 전사 → 노션 → PRD → 업무)
      const result = await this.processTwoStagePipeline(audioBuffer, params.fileName);
      
      if (result.success) {
        console.log(`✅ Audio processing completed for project: ${params.projectName}`);
        
        // 사용자의 실제 연동 정보를 반환 (DB 조회는 slack-handler에서 처리)
        return {
          projectName: params.projectName,
          needsIntegrationInfo: true, // slack-handler가 DB 조회하도록 플래그 설정
          ...result
        };
      } else {
        throw new Error(result.error || 'Processing failed');
      }
      
    } catch (error: any) {
      console.error('❌ Audio file processing error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error'
      };
    }
  }
}

export { AIService };
export type { 
  TranscriptionResult, 
  AnalysisResult, 
  PipelineResult,
  NotionProjectResult,
  TaskMasterPRDResult,
  GeneratedTasksResult,
  TwoStagePipelineResult
};