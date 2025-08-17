"""
TtalKkak 최종 AI 서버 - Triplet + BERT 통합
회의록 → Triplet 필터링 → 기획안 → Task Master PRD → 업무생성
"""

import os
import io
import json
import tempfile
import logging
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager
import time
import httpx  # WhisperX 원격 서버 호출용

import torch
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException, Body, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# 로컬 모듈 임포트
from task_schemas import (
    TaskItem, SubTask, MeetingAnalysisResult, ComplexityAnalysis, 
    TaskExpansionRequest, TaskExpansionResult, PipelineRequest, PipelineResult,
    calculate_task_complexity_advanced, validate_task_dependencies, 
    generate_task_id_sequence, TASK_SCHEMA_EXAMPLE
)
from meeting_analysis_prompts import (
    generate_meeting_analysis_system_prompt,
    generate_meeting_analysis_user_prompt,
    generate_task_expansion_system_prompt,
    generate_complexity_analysis_prompt,
    validate_meeting_analysis
)
from prd_generation_prompts import (
    generate_notion_project_prompt,
    generate_task_master_prd_prompt,
    format_notion_project,
    format_task_master_prd,
    validate_notion_project,
    validate_task_master_prd,
    NOTION_PROJECT_SCHEMA,
    TASK_MASTER_PRD_SCHEMA
)

import uvicorn

# 로깅 설정 (모듈 임포트 전에 설정)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Triplet + BERT 모듈 임포트
try:
    from triplet_processor import get_triplet_processor
    from bert_classifier import get_bert_classifier
    TRIPLET_AVAILABLE = True
    print("✅ Triplet + BERT 모듈 로드 성공")
except ImportError as e:
    logger.warning(f"⚠️ Triplet + BERT 모듈 로드 실패: {e}")
    TRIPLET_AVAILABLE = False

# WhisperX 원격 서버 URL
WHISPERX_SERVER = "http://localhost:8002"

# 글로벌 모델 변수
whisper_model = None  # WhisperX는 원격 서버에서 처리
qwen_model = None
qwen_tokenizer = None

# Task Master 스타일 복잡도 기반 프로세스 함수들
async def generate_tasks_from_prd(prd_data: dict, num_tasks: int = 5) -> List[TaskItem]:
    """PRD에서 Task Master 스타일로 태스크 생성"""
    try:
        logger.info(f"🎯 Generating {num_tasks} tasks from PRD using Task Master approach...")
        
        # Task Master PRD → Task 생성 프롬프트
        from prd_generation_prompts import (
            generate_prd_to_tasks_system_prompt,
            generate_prd_to_tasks_user_prompt
        )
        
        system_prompt = generate_prd_to_tasks_system_prompt(num_tasks)
        user_prompt = generate_prd_to_tasks_user_prompt(prd_data, num_tasks)
        
        # JSON 응답 강제 프롬프트 추가
        json_enforced_prompt = f"""
{system_prompt}

**CRITICAL INSTRUCTIONS:**
- DO NOT use <think> or </think> tags
- DO NOT provide any explanations or thinking process
- START your response directly with a JSON object
- ONLY output valid JSON, nothing else
- ALL task titles, descriptions, and details MUST be in Korean (한국어)
- Technical terms can remain in English where appropriate

{user_prompt}

RESPOND WITH JSON ONLY (한국어로 작성):"""
        
        # Qwen 모델로 태스크 생성
        messages = [{"role": "user", "content": json_enforced_prompt}]
        
        if qwen_model and qwen_tokenizer:
            text = qwen_tokenizer.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=True
            )
            
            # VLLM 사용 (qwen_model이 실제로는 VLLM LLM 객체)
            from vllm import SamplingParams
            sampling_params = SamplingParams(
                temperature=0.3,
                max_tokens=2048,
                top_p=0.95
            )
            
            outputs = qwen_model.generate([text], sampling_params)
            response = outputs[0].outputs[0].text
            
            # 디버깅: 응답 내용 확인
            logger.info(f"📝 Raw response length: {len(response)} chars")
            logger.info(f"📝 Response preview: {response[:500]}...")
            
            # <think> 태그 제거
            if "<think>" in response:
                think_end = response.find("</think>")
                if think_end != -1:
                    response = response[think_end + 8:].strip()
                else:
                    # </think> 태그가 없으면 <think> 이후 전체 제거
                    think_start = response.find("<think>")
                    response = response[:think_start].strip()
            
            # JSON 파싱
            if "```json" in response:
                json_start = response.find("```json") + 7
                json_end = response.find("```", json_start)
                if json_end == -1:
                    json_content = response[json_start:].strip()
                else:
                    json_content = response[json_start:json_end].strip()
            else:
                # JSON 블록이 없으면 전체 응답을 JSON으로 간주
                json_content = response.strip()
                # 하지만 먼저 JSON 시작 부분 찾기
                if response.strip().startswith('{'):
                    json_content = response.strip()
                else:
                    # JSON이 중간에 시작하는 경우
                    json_start_idx = response.find('{')
                    if json_start_idx != -1:
                        json_content = response[json_start_idx:].strip()
                    else:
                        logger.error(f"❌ No JSON found in response")
                        return []
            
            # JSON 정리 및 일반적인 오류 수정
            import re
            
            # 1. 뒤따르는 쉼표 제거 (배열이나 객체 끝)
            json_content = re.sub(r',\s*}', '}', json_content)
            json_content = re.sub(r',\s*]', ']', json_content)
            
            # 2. 작은따옴표를 큰따옴표로 변경 (JSON은 큰따옴표만 허용)
            # 단, 값 내부의 작은따옴표는 유지
            json_content = re.sub(r"'([^']*)'(?=\s*:)", r'"\1"', json_content)
            
            # 3. 키에 따옴표가 없는 경우 추가 (예: {key: "value"} -> {"key": "value"})
            json_content = re.sub(r'([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'\1"\2":', json_content)
            
            # 4. undefined, null 처리
            json_content = json_content.replace('undefined', 'null')
            
            # 5. 불완전한 JSON 끝 처리
            open_braces = json_content.count('{') - json_content.count('}')
            open_brackets = json_content.count('[') - json_content.count(']')
            
            if open_braces > 0:
                json_content += '}' * open_braces
            if open_brackets > 0:
                json_content += ']' * open_brackets
            
            try:
                task_data = json.loads(json_content)
            except json.JSONDecodeError as e:
                logger.error(f"❌ JSON parse error after cleaning: {e}")
                logger.error(f"📝 Cleaned JSON content: {json_content[:500]}...")
                raise
            
            # TaskItem 객체로 변환
            task_items = []
            for task_info in task_data.get("tasks", []):
                task_item = TaskItem(
                    id=task_info.get("id", len(task_items) + 1),
                    title=task_info.get("title", f"Task {len(task_items) + 1}"),
                    description=task_info.get("description", ""),
                    details=task_info.get("details", ""),
                    priority=task_info.get("priority", "medium"),
                    status=task_info.get("status", "pending"),
                    assignee=task_info.get("assignee", None),
                    start_date=task_info.get("start_date", None),
                    deadline=task_info.get("deadline", None),
                    due_date=task_info.get("due_date", None),
                    estimated_hours=task_info.get("estimated_hours", 8),
                    complexity=task_info.get("complexity", 5),
                    dependencies=task_info.get("dependencies", []),
                    test_strategy=task_info.get("testStrategy", ""),
                    subtasks=[]  # 서브태스크는 나중에 복잡도 분석 후 생성
                )
                task_items.append(task_item)
            
            logger.info(f"✅ Generated {len(task_items)} tasks from PRD")
            return task_items
        else:
            logger.error("❌ Qwen model not available for task generation")
            return []
            
    except Exception as e:
        logger.error(f"❌ Error generating tasks from PRD: {e}")
        
        # Fallback: 더미 태스크 생성
        logger.info("⚠️ Using fallback dummy tasks")
        dummy_tasks = []
        for i in range(num_tasks):
            dummy_tasks.append(TaskItem(
                id=i + 1,
                title=f"Task {i + 1}: 시스템 구현",
                description=f"프로젝트의 주요 기능 {i + 1} 구현",
                details="상세 구현 내용",
                priority="high" if i == 0 else "medium",
                status="pending",
                assignee=None,
                start_date=None,
                deadline=None,
                due_date=None,
                estimated_hours=(i + 1) * 8,  # 태스크별로 다른 시간
                complexity=7 + i if i < 3 else 5,  # 복잡도도 다양하게
                dependencies=[],
                test_strategy="단위 테스트 및 통합 테스트",
                subtasks=[]
            ))
        return dummy_tasks

async def analyze_task_complexity(task_items: List[TaskItem]) -> dict:
    """Task Master 스타일 복잡도 분석"""
    try:
        logger.info("🔍 Analyzing task complexity using Task Master approach...")
        
        from prd_generation_prompts import (
            generate_complexity_analysis_system_prompt,
            generate_complexity_analysis_prompt
        )
        
        # 태스크 데이터 준비
        tasks_data = {
            "tasks": [
                {
                    "id": task.id,
                    "title": task.title,
                    "description": task.description,
                    "details": task.details,
                    "priority": task.priority
                }
                for task in task_items
            ]
        }
        
        system_prompt = generate_complexity_analysis_system_prompt()
        user_prompt = generate_complexity_analysis_prompt(tasks_data)
        
        # Qwen 모델로 복잡도 분석
        messages = [{"role": "user", "content": user_prompt}]
        
        if qwen_model and qwen_tokenizer:
            text = qwen_tokenizer.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=True
            )
            
            # VLLM 사용 (qwen_model이 실제로는 VLLM LLM 객체)
            from vllm import SamplingParams
            sampling_params = SamplingParams(
                temperature=0.3,
                max_tokens=2048,
                top_p=0.95
            )
            
            outputs = qwen_model.generate([text], sampling_params)
            response = outputs[0].outputs[0].text
            
            # JSON 파싱
            if "```json" in response:
                json_start = response.find("```json") + 7
                json_end = response.find("```", json_start)
                if json_end == -1:
                    json_content = response[json_start:].strip()
                else:
                    json_content = response[json_start:json_end].strip()
            else:
                # 배열 찾기
                first_bracket = response.find('[')
                last_bracket = response.rfind(']')
                if first_bracket != -1 and last_bracket > first_bracket:
                    json_content = response[first_bracket:last_bracket + 1]
                else:
                    json_content = response.strip()
            
            complexity_analysis = json.loads(json_content)
            
            # 분석 결과를 딕셔너리로 변환 (taskId를 키로)
            complexity_map = {}
            for analysis in complexity_analysis:
                task_id = analysis.get("taskId")
                if task_id:
                    complexity_map[task_id] = analysis
            
            logger.info(f"✅ Complexity analysis completed for {len(complexity_map)} tasks")
            return complexity_map
        else:
            logger.error("❌ Qwen model not available for complexity analysis")
            return {}
            
    except Exception as e:
        logger.error(f"❌ Error analyzing task complexity: {e}")
        return {}

# Task Master 스타일 복잡도 기반 서브태스크 생성
async def generate_subtasks_for_all_tasks(task_items: List[TaskItem], complexity_analysis: dict = None) -> List[TaskItem]:
    """Task Master 스타일: 복잡도 분석 기반 서브태스크 생성"""
    try:
        logger.info("🔧 Generating subtasks using Task Master complexity-based approach...")
        
        from prd_generation_prompts import (
            generate_complexity_based_subtask_prompt,
            generate_complexity_based_subtask_system_prompt
        )
        
        for task in task_items:
            try:
                # 복잡도 분석 정보 가져오기
                task_analysis = complexity_analysis.get(task.id, {}) if complexity_analysis else {}
                
                # 기본값 설정
                complexity_score = task_analysis.get('complexityScore', 5)
                recommended_subtasks = task_analysis.get('recommendedSubtasks', 3)
                
                # 태스크에 복잡도 정보 업데이트
                task.complexity = complexity_score
                task.estimated_hours = task_analysis.get('estimatedHours', complexity_score * 8)
                
                # 날짜 설정 (시작일과 마감일)
                from datetime import datetime, timedelta
                today = datetime.now()
                task.start_date = today.strftime('%Y-%m-%d')
                task.due_date = (today + timedelta(days=7 * complexity_score)).strftime('%Y-%m-%d')
                task.deadline = task.due_date
                
                # 서브태스크 ID 시작점
                next_subtask_id = 1
                
                # Task Master 스타일 프롬프트 생성
                system_prompt = generate_complexity_based_subtask_system_prompt(
                    recommended_subtasks, next_subtask_id
                )
                user_prompt = generate_complexity_based_subtask_prompt(
                    {
                        'id': task.id,
                        'title': task.title,
                        'description': task.description,
                        'details': task.details
                    },
                    task_analysis,
                    next_subtask_id
                )
                
                # Qwen 모델로 서브태스크 생성
                # JSON 응답 강제 프롬프트
                json_prompt = f"""
{system_prompt}

**CRITICAL: RESPOND ONLY WITH JSON. NO THINKING, NO EXPLANATIONS.**
- DO NOT use <think> tags
- START directly with JSON
- Output valid JSON ONLY

{user_prompt}

RESPOND WITH JSON ONLY:"""
                
                messages = [{"role": "user", "content": json_prompt}]
                
                if qwen_model and qwen_tokenizer:
                    text = qwen_tokenizer.apply_chat_template(
                        messages, tokenize=False, add_generation_prompt=True
                    )
                    
                    # VLLM 사용
                    from vllm import SamplingParams
                    sampling_params = SamplingParams(
                        temperature=0.3,
                        max_tokens=2048,  # 증가: 서브태스크는 더 긴 응답 필요
                        top_p=0.95
                    )
                    
                    outputs = qwen_model.generate([text], sampling_params)
                    response = outputs[0].outputs[0].text
                    
                    # <think> 태그 제거
                    if "<think>" in response:
                        think_end = response.find("</think>")
                        if think_end != -1:
                            response = response[think_end + 8:].strip()
                        else:
                            json_start_idx = response.find('{')
                            if json_start_idx != -1:
                                response = response[json_start_idx:].strip()
                    
                    # JSON 파싱
                    if "```json" in response:
                        json_start = response.find("```json") + 7
                        json_end = response.find("```", json_start)
                        if json_end == -1:
                            json_content = response[json_start:].strip()
                        else:
                            json_content = response[json_start:json_end].strip()
                    else:
                        json_content = response.strip()
                    
                    subtask_data = json.loads(json_content)
                    
                    # SubTask 객체로 변환 (Task Master 필드 포함)
                    subtasks = []
                    for i, subtask_info in enumerate(subtask_data.get("subtasks", [])):
                        subtask = SubTask(
                            id=subtask_info.get("id", i + 1),
                            title=subtask_info.get("title", f"서브태스크 {i+1}"),
                            description=subtask_info.get("description", ""),
                            priority=subtask_info.get("priority", "medium"),
                            estimated_hours=subtask_info.get("estimated_hours", 4),
                            status=subtask_info.get("status", "pending")
                        )
                        subtasks.append(subtask)
                    
                    task.subtasks = subtasks
                    logger.info(f"✅ '{task.title}' 복잡도 기반 서브태스크 {len(subtasks)}개 생성 (복잡도: {complexity_score}/10)")
                    
                else:
                    logger.warning("⚠️ Qwen 모델 없음, 복잡도 기반 기본 서브태스크 생성")
                    task.subtasks = create_complexity_based_default_subtasks(task, task_analysis)
                    
            except Exception as e:
                logger.warning(f"⚠️ '{task.title}' 서브태스크 생성 실패: {e}")
                if 'response' in locals():
                    logger.error(f"   Response length: {len(response)}")
                    logger.error(f"   Response preview: {response[:200]}...")
                # 복잡도 기반 기본 서브태스크 생성
                task_analysis = complexity_analysis.get(task.id, {}) if complexity_analysis else {}
                task.subtasks = create_complexity_based_default_subtasks(task, task_analysis)
        
        total_subtasks = sum(len(task.subtasks) for task in task_items)
        logger.info(f"✅ Task Master 스타일 서브태스크 생성 완료: 총 {total_subtasks}개")
        return task_items
        
    except Exception as e:
        logger.error(f"❌ Task Master 서브태스크 생성 중 오류: {e}")
        return task_items

def create_complexity_based_default_subtasks(task: TaskItem, task_analysis: dict) -> List[SubTask]:
    """Task Master 스타일: 복잡도 기반 기본 서브태스크 생성"""
    default_subtasks = []
    
    # 복잡도 분석 정보
    complexity_score = task_analysis.get('complexityScore', 5)
    recommended_subtasks = task_analysis.get('recommendedSubtasks', 3)
    
    # 복잡도에 따른 Task Master 스타일 템플릿
    if complexity_score >= 8:  # 고복잡도 (8-10)
        templates = [
            {
                "title": "Architecture Design & Planning",
                "desc": f"Design system architecture and create detailed technical specifications for {task.title}",
                "details": "Create technical design documents, API specifications, database schemas, and implementation roadmap",
                "hours": 12,
                "priority": "high"
            },
            {
                "title": "Core Implementation",
                "desc": f"Implement the main functionality and core features of {task.title}",
                "details": "Develop core business logic, implement primary user flows, and establish data processing pipeline",
                "hours": 20,
                "priority": "high"
            },
            {
                "title": "Integration & Testing",
                "desc": f"Integrate components and conduct comprehensive testing for {task.title}",
                "details": "Perform unit testing, integration testing, and end-to-end testing with comprehensive test coverage",
                "hours": 10,
                "priority": "medium"
            },
            {
                "title": "Performance Optimization",
                "desc": f"Optimize performance and conduct security review for {task.title}",
                "details": "Profile application performance, implement caching strategies, and conduct security audit",
                "hours": 8,
                "priority": "medium"
            }
        ]
    elif complexity_score >= 5:  # 중복잡도 (5-7)
        templates = [
            {
                "title": "Requirements Analysis & Design",
                "desc": f"Analyze requirements and create implementation plan for {task.title}",
                "details": "Define functional requirements, create wireframes, and establish development approach",
                "hours": 6,
                "priority": "high"
            },
            {
                "title": "Implementation & Development",
                "desc": f"Develop and implement the main features of {task.title}",
                "details": "Code implementation following best practices, implement business logic, and create user interfaces",
                "hours": 12,
                "priority": "high"
            },
            {
                "title": "Testing & Documentation",
                "desc": f"Test functionality and create documentation for {task.title}",
                "details": "Write unit tests, conduct manual testing, and create user and technical documentation",
                "hours": 6,
                "priority": "medium"
            }
        ]
    else:  # 저복잡도 (1-4)
        templates = [
            {
                "title": "Setup & Preparation",
                "desc": f"Set up environment and prepare resources for {task.title}",
                "details": "Configure development environment, gather required resources, and create initial project structure",
                "hours": 3,
                "priority": "medium"
            },
            {
                "title": "Implementation",
                "desc": f"Implement the required functionality for {task.title}",
                "details": "Code implementation with focus on clean, maintainable code following established patterns",
                "hours": 6,
                "priority": "high"
            },
            {
                "title": "Validation & Cleanup",
                "desc": f"Validate implementation and finalize {task.title}",
                "details": "Test implementation, review code quality, and ensure all requirements are met",
                "hours": 3,
                "priority": "medium"
            }
        ]
    
    # 추천된 서브태스크 수만큼 생성
    for i in range(min(recommended_subtasks, len(templates))):
        template = templates[i]
        subtask = SubTask(
            id=i + 1,
            title=template["title"],
            description=template["desc"],
            priority=template["priority"],
            estimated_hours=template["hours"],
            status="pending"
        )
        default_subtasks.append(subtask)
    
    return default_subtasks

# 기존 함수도 유지 (호환성을 위해)
def create_default_subtasks(task: TaskItem, num_subtasks: int = 3) -> List[SubTask]:
    """기본 서브태스크 생성 (하위 호환성)"""
    # Task Master 방식으로 리다이렉트
    task_analysis = {
        'complexityScore': getattr(task, 'complexity', 5),
        'recommendedSubtasks': num_subtasks
    }
    return create_complexity_based_default_subtasks(task, task_analysis)

# 새로운 응답 모델들
class NotionProjectResponse(BaseModel):
    success: bool
    notion_project: Optional[Dict[str, Any]] = None
    formatted_notion: Optional[str] = None
    error: Optional[str] = None

class TaskMasterPRDResponse(BaseModel):
    success: bool
    prd_data: Optional[Dict[str, Any]] = None
    formatted_prd: Optional[str] = None
    error: Optional[str] = None

class TwoStageAnalysisRequest(BaseModel):
    transcript: str
    generate_notion: bool = True
    generate_tasks: bool = True
    generate_subtasks: bool = True  # Stage 4 서브태스크 생성 여부
    num_tasks: int = 5
    additional_context: Optional[str] = None
    auto_expand_tasks: bool = True  # 🚀 자동 서브태스크 생성 기본값을 True로 설정

class TwoStageAnalysisResponse(BaseModel):
    success: bool
    stage1_notion: Optional[Dict[str, Any]] = None
    stage2_prd: Optional[Dict[str, Any]] = None
    stage3_tasks: Optional[MeetingAnalysisResult] = None
    stage4_subtasks: Optional[List[Dict[str, Any]]] = None  # Stage 4 서브태스크 결과
    formatted_notion: Optional[str] = None
    formatted_prd: Optional[str] = None
    processing_time: Optional[float] = None
    error: Optional[str] = None

# Triplet 관련 새로운 응답 모델들
class EnhancedTranscriptionResponse(BaseModel):
    success: bool
    transcription: Optional[Dict[str, Any]] = None
    triplet_data: Optional[Dict[str, Any]] = None
    filtered_transcript: Optional[str] = None
    processing_stats: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class EnhancedTwoStageResult(BaseModel):
    success: bool
    triplet_stats: Optional[Dict[str, Any]] = None
    classification_stats: Optional[Dict[str, Any]] = None
    stage1_notion: Optional[Dict[str, Any]] = None
    stage2_prd: Optional[Dict[str, Any]] = None
    stage3_tasks: Optional[MeetingAnalysisResult] = None
    stage4_subtasks: Optional[List[Dict[str, Any]]] = None  # Stage 4 서브태스크 결과
    formatted_notion: Optional[str] = None
    formatted_prd: Optional[str] = None
    original_transcript_length: Optional[int] = None
    filtered_transcript_length: Optional[int] = None
    noise_reduction_ratio: Optional[float] = None
    processing_time: Optional[float] = None
    error: Optional[str] = None

# 기존 모델들
class TranscriptionResponse(BaseModel):
    success: bool
    transcription: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class AnalysisRequest(BaseModel):
    transcript: str
    num_tasks: int = 5
    additional_context: Optional[str] = None

class AnalysisResponse(BaseModel):
    success: bool
    analysis: Optional[MeetingAnalysisResult] = None
    error: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    gpu_available: bool
    gpu_count: int
    models_loaded: Dict[str, bool]
    memory_info: Optional[Dict[str, float]] = None

def load_whisperx():
    """WhisperX 모델 로딩 - 원격 서버 사용"""
    # WhisperX는 이제 원격 서버(포트 8001)에서 처리
    # 이 함수는 호환성을 위해 유지하되 실제 로딩은 하지 않음
    logger.info("🎤 WhisperX will be handled by remote server (port 8001)")
    return None

def load_qwen3():
    """Qwen3-4B LoRA 모델 로딩 (VLLM 최적화)"""
    global qwen_model, qwen_tokenizer
    
    if qwen_model is None or qwen_tokenizer is None:
        logger.info("🚀 Loading Qwen3-4B LoRA with VLLM...")
        try:
            # VLLM 사용 여부 체크
            use_vllm = os.getenv("USE_VLLM", "true").lower() == "true"
            
            if use_vllm:
                try:
                    logger.info("⚡ Using VLLM for ultra-fast inference")
                    from vllm import LLM
                    from transformers import AutoTokenizer
                except ImportError as e:
                    logger.warning(f"⚠️ VLLM import failed: {e}")
                    logger.info("🔄 Falling back to Transformers...")
                    use_vllm = False
                
            if use_vllm:
                # LoRA 어댑터 경로
                if os.path.exists("/workspace"):
                    lora_path = "/workspace/SKN12-FINAL-3TEAM/ai-engine-dev/qwen3_lora_ttalkkac_4b"
                else:
                    lora_path = "C:/Users/SH/Desktop/TtalKkac/ai-engine-dev/qwen3_lora_ttalkkac_4b"
                
                # 병합된 모델이 있는지 확인
                merged_model_path = "/workspace/SKN12-FINAL-3TEAM/ai-engine-dev/qwen3-4b-merged"
                
                # 병합된 모델이 없으면 즉시 병합 수행
                if not os.path.exists(merged_model_path):
                    logger.info("🔄 LoRA 어댑터를 베이스 모델과 병합 중...")
                    try:
                        from transformers import AutoModelForCausalLM, AutoTokenizer
                        from peft import PeftModel
                        
                        # 베이스 모델 로드
                        base_model = AutoModelForCausalLM.from_pretrained(
                            "Qwen/Qwen3-4B",
                            torch_dtype=torch.float16,
                            trust_remote_code=True,
                            device_map="auto"
                        )
                        
                        # LoRA 어댑터 적용
                        if os.path.exists(lora_path) and os.path.exists(f"{lora_path}/adapter_config.json"):
                            logger.info(f"📎 LoRA 어댑터 적용: {lora_path}")
                            model_with_lora = PeftModel.from_pretrained(base_model, lora_path)
                            
                            # 병합 및 저장
                            merged_model = model_with_lora.merge_and_unload()
                            merged_model.save_pretrained(merged_model_path)
                            
                            # 토크나이저도 저장
                            tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen3-4B", trust_remote_code=True)
                            tokenizer.save_pretrained(merged_model_path)
                            
                            logger.info(f"✅ 병합 완료: {merged_model_path}")
                            del base_model, model_with_lora, merged_model  # 메모리 정리
                        else:
                            logger.warning("⚠️ LoRA 어댑터 파일 없음, 베이스 모델 사용")
                            merged_model_path = "Qwen/Qwen3-4B"
                    except Exception as e:
                        logger.error(f"❌ 병합 실패: {e}")
                        merged_model_path = "Qwen/Qwen3-4B"
                
                try:
                    # VLLM으로 병합된 모델 로딩
                    logger.info(f"🚀 VLLM으로 모델 로딩: {merged_model_path}")
                    qwen_model = LLM(
                        model=merged_model_path,
                        tensor_parallel_size=1,
                        gpu_memory_utilization=0.7,  # GPU 메모리 70%
                        trust_remote_code=True,
                        max_model_len=16384,  # 토큰 길이
                        enforce_eager=True,  # CUDA 그래프 비활성화 (메모리 절약)
                        swap_space=4,  # 4GB swap space
                        max_num_seqs=64  # 동시 시퀀스 수
                    )
                    
                    # 토크나이저는 별도 로딩 (템플릿 적용용)
                    qwen_tokenizer = AutoTokenizer.from_pretrained(
                        merged_model_path if os.path.exists(merged_model_path) else "Qwen/Qwen3-4B", 
                        trust_remote_code=True
                    )
                    
                    logger.info("🎉 VLLM Qwen3-4B LoRA loaded successfully")
                except Exception as e:
                    logger.error(f"❌ VLLM model loading failed: {e}")
                    logger.info("🔄 Falling back to Transformers...")
                    use_vllm = False
                
            if not use_vllm:
                # 기존 Transformers 방식 (백업용)
                try:
                    logger.info("📚 Using Transformers (fallback mode)")
                    from transformers import AutoTokenizer, AutoModelForCausalLM
                except ImportError as e:
                    logger.error(f"❌ Transformers import failed: {e}")
                    raise RuntimeError("Both VLLM and Transformers unavailable!")
                
                # RunPod에서 사용할 경로 설정
                if os.path.exists("/workspace"):
                    model_name = "/workspace/SKN12-FINAL-3TEAM/ai-engine-dev/qwen3_lora_ttalkkac_4b"
                else:
                    model_name = "C:/Users/SH/Desktop/TtalKkac/ai-engine-dev/qwen3_lora_ttalkkac_4b"
                
                # Qwen3-4B 토크나이저 로드
                try:
                    # 먼저 로컬 모델에서 토크나이저 시도
                    qwen_tokenizer = AutoTokenizer.from_pretrained(
                        model_name, 
                        trust_remote_code=True,
                        use_fast=True
                    )
                    logger.info("✅ 로컬 Qwen3-4B 토크나이저 로드 성공")
                except Exception as e:
                    logger.warning(f"로컬 토크나이저 실패: {e}")
                    # Qwen3-4B 토크나이저 사용
                    try:
                        qwen_tokenizer = AutoTokenizer.from_pretrained(
                            "Qwen/Qwen3-4B", 
                            trust_remote_code=True,
                            use_fast=True
                        )
                        logger.info("✅ Qwen3-4B 토크나이저 로드 성공")
                    except Exception as e2:
                        logger.error(f"Qwen3-4B 토크나이저 로드 실패: {e2}")
                        raise
                
                # Qwen3-4B 모델 로드
                model_loaded = False
                
                # 먼저 로컬 모델 시도
                if os.path.exists(model_name):
                    logger.info("🔄 로컬 모델 직접 로드 시도...")
                    config_path = os.path.join(model_name, "config.json")
                    if os.path.exists(config_path):
                        try:
                            # 로컬 Qwen3-4B 모델 로드
                            qwen_model = AutoModelForCausalLM.from_pretrained(
                                model_name,
                                torch_dtype=torch.float16,
                                trust_remote_code=True,
                                local_files_only=True
                            )
                            if torch.cuda.is_available():
                                qwen_model = qwen_model.cuda()
                            
                            model_loaded = True
                            logger.info("✅ 로컬 Qwen3 모델 로드 성공")
                            
                        except Exception as e:
                            logger.warning(f"로컬 모델 로드 실패: {e}")
                
                # 로컬 모델 실패시 HuggingFace에서 Qwen3-4B 다운로드
                if not model_loaded:
                    try:
                        logger.info("🎯 Qwen3-4B 베이스 모델 다운로드 시도...")
                        base_model_name = "Qwen/Qwen3-4B"
                        
                        # 베이스 모델 로드
                        base_model = AutoModelForCausalLM.from_pretrained(
                            base_model_name,
                            torch_dtype=torch.float16,
                            trust_remote_code=True
                        )
                        if torch.cuda.is_available():
                            base_model = base_model.cuda()
                        logger.info("✅ Qwen3-4B 베이스 모델 로드 성공")
                        
                        # LoRA 어댑터 적용 (있는 경우)
                        if os.path.exists(model_name) and os.path.exists(os.path.join(model_name, "adapter_config.json")):
                            try:
                                from peft import PeftModel
                                qwen_model = PeftModel.from_pretrained(base_model, model_name)
                                logger.info("✅ Qwen3 LoRA 어댑터 적용 성공")
                            except Exception as e:
                                logger.warning(f"LoRA 적용 실패: {e}, 베이스 모델 사용")
                                qwen_model = base_model
                        else:
                            qwen_model = base_model
                            logger.info("🔔 LoRA 어댑터 없음, Qwen3-4B 베이스 모델 사용")
                        
                        model_loaded = True
                    
                    except Exception as e:
                        logger.error(f"Qwen3-4B 로드 실패: {e}")
                    
                    # Fallback: 로컬 모델 시도 (config.json 수정 필요)
                    if os.path.exists(model_name):
                        logger.info("🔄 로컬 모델 로드 시도 (config 수정)...")
                        config_path = os.path.join(model_name, "config.json")
                        if os.path.exists(config_path):
                            try:
                                # Qwen3-4B LoRA 어댑터 로드 시도
                                qwen_model = AutoModelForCausalLM.from_pretrained(
                                    model_name,
                                    torch_dtype=torch.float16,
                                    trust_remote_code=True,
                                    ignore_mismatched_sizes=True
                                )
                                if torch.cuda.is_available():
                                    qwen_model = qwen_model.cuda()
                                model_loaded = True
                                logger.info("✅ 로컬 Qwen3 모델 로드 성공 (config 수정)")
                                
                                # 원래대로 복구
                                config['model_type'] = original_type
                                with open(config_path, 'w') as f:
                                    json.dump(config, f, indent=2)
                                    
                            except Exception as e2:
                                logger.error(f"로컬 모델 로드 실패: {e2}")
                
                logger.info("✅ Transformers Qwen3-4B LoRA loaded successfully")
            
        except Exception as e:
            logger.error(f"❌ Qwen3-4B LoRA loading failed: {e}")
            # VLLM 실패 시 Transformers로 대체
            if 'vllm' in str(e).lower():
                logger.warning("🔄 VLLM failed, falling back to Transformers...")
                os.environ["USE_VLLM"] = "false"
                return load_qwen3()  # 재귀 호출로 Transformers 로딩
            raise e
    
    return qwen_model, qwen_tokenizer

def generate_structured_response(
    system_prompt: str, 
    user_prompt: str, 
    response_schema: Dict[str, Any],
    temperature: float = 0.3,
    max_input_tokens: int = 28000,  # Qwen3 안전 마진 적용
    enable_chunking: bool = True
) -> Dict[str, Any]:
    """구조화된 응답 생성 (청킹 지원)"""
    
    # 청킹 필요 여부 확인       
    if enable_chunking:
        try:
            from chunking_processor import get_chunking_processor
            chunking_processor = get_chunking_processor(max_context_tokens=32768)
            
            # 전체 프롬프트 토큰 수 추정
            total_prompt = f"{system_prompt}\n{user_prompt}"
            estimated_tokens = chunking_processor.estimate_tokens(total_prompt)
            
            if estimated_tokens > max_input_tokens:
                logger.info(f"🔄 청킹 필요 감지 (토큰: {estimated_tokens} > {max_input_tokens})")
                return generate_chunked_response(
                    system_prompt, user_prompt, response_schema, 
                    temperature, chunking_processor
                )
            else:
                logger.info(f"📝 단일 처리 (토큰: {estimated_tokens})")
        except ImportError:
            logger.warning("⚠️ 청킹 프로세서를 불러올 수 없습니다. 기본 처리로 진행합니다.")
    
    # 모델 로딩
    qwen_model, qwen_tokenizer = load_qwen3()
    
    # 스키마 예시 포함 프롬프트
    schema_prompt = f"""
{system_prompt}

**CRITICAL: RESPOND ONLY WITH JSON. NO THINKING, NO EXPLANATIONS, JUST JSON.**

**Response Schema:**
You must respond with a JSON object following this exact structure:
```json
{json.dumps(response_schema, indent=2, ensure_ascii=False)}
```

**Important Rules:**
1. DO NOT use <think> tags or any other markup
2. START your response directly with ```json
3. Always return valid JSON format ONLY
4. Use Korean for all text content unless technical terms require English
5. Follow the exact schema structure
6. Include all required fields
7. NO explanations before or after the JSON

{user_prompt}

**Response (JSON ONLY):**
```json
"""
    
    # 메시지 구성
    messages = [{"role": "user", "content": schema_prompt}]
    
    # 추론 실행 (VLLM vs Transformers)
    use_vllm = os.getenv("USE_VLLM", "true").lower() == "true"
    
    if use_vllm and hasattr(qwen_model, 'generate'):
        # VLLM 추론 (초고속!)
        logger.info("⚡ VLLM 추론 실행...")
        start_time = time.time()
        
        from vllm import SamplingParams
        
        # 샘플링 파라미터 설정
        sampling_params = SamplingParams(
            max_tokens=4096,  # 증가
            temperature=temperature,
            top_p=0.9,
            repetition_penalty=1.1,
            stop=None
        )
        
        # 메시지를 텍스트로 변환
        text = qwen_tokenizer.apply_chat_template(
            messages, 
            tokenize=False, 
            add_generation_prompt=True
        )
        
        # VLLM 추론 실행
        outputs = qwen_model.generate([text], sampling_params)
        response = outputs[0].outputs[0].text
        
        inference_time = time.time() - start_time
        logger.info(f"🎉 VLLM 추론 완료: {inference_time:.3f}초")
        
    else:
        # Transformers 추론 (기존 방식)
        logger.info("📚 Transformers 추론 실행...")
        start_time = time.time()
        
        # 토큰화
        text = qwen_tokenizer.apply_chat_template(
            messages, 
            tokenize=False, 
            add_generation_prompt=True
        )
        
        # VLLM 사용
        from vllm import SamplingParams
        sampling_params = SamplingParams(
            temperature=temperature,
            max_tokens=4096,  # 증가
            top_p=0.9,
            repetition_penalty=1.1
        )
        
        outputs = qwen_model.generate([text], sampling_params)
        response = outputs[0].outputs[0].text
        
        inference_time = time.time() - start_time
        logger.info(f"✅ Transformers 추론 완료: {inference_time:.3f}초")
    
    # <think> 태그 제거
    if "<think>" in response:
        think_end = response.find("</think>")
        if think_end != -1:
            response = response[think_end + 8:].strip()
        else:
            # </think> 태그가 없으면 JSON 시작 찾기
            json_start_idx = response.find('{')
            if json_start_idx != -1:
                response = response[json_start_idx:].strip()
    
    # JSON 추출 및 파싱
    try:
        # JSON 부분만 추출
        if "```json" in response:
            json_start = response.find("```json") + 7
            json_end = response.find("```", json_start)
            if json_end == -1:
                json_content = response[json_start:].strip()
            else:
                json_content = response[json_start:json_end].strip()
        else:
            # JSON 마커가 없으면 전체 응답에서 JSON 찾기
            json_content = response.strip()
        
        # JSON 파싱 전 정리
        # 끝에 있는 ``` 제거
        if json_content.endswith('```'):
            json_content = json_content[:-3].strip()
        
        # JSON 파싱
        parsed_result = json.loads(json_content)
        return parsed_result
        
    except json.JSONDecodeError as e:
        logger.error(f"❌ JSON 파싱 실패: {e}")
        logger.error(f"Raw response length: {len(response)}")
        logger.error(f"Raw response: {response}")
        
        # Fallback: 부분적으로 파싱 가능한 부분 찾기
        try:
            # JSON 끝 부분 정리
            # 마지막 }를 찾아서 그 이후 제거
            last_brace = json_content.rfind('}')
            if last_brace != -1:
                json_content_cleaned = json_content[:last_brace + 1]
                logger.info(f"⚠️ Attempting to fix JSON by trimming after last }}")
                parsed_result = json.loads(json_content_cleaned)
                return parsed_result
                
            # 불완전한 JSON 복구 시도
            if json_content.count('{') > json_content.count('}'):
                # 닫는 중괄호 추가
                json_content += '}' * (json_content.count('{') - json_content.count('}'))
                logger.info("⚠️ Attempting to fix incomplete JSON by adding closing braces")
                parsed_result = json.loads(json_content)
                return parsed_result
        except:
            pass
            
        return {
            "error": f"JSON parsing failed: {str(e)}",
            "raw_response": response[:1000]
        }
    except Exception as e:
        logger.error(f"❌ 응답 처리 실패: {e}")
        return {
            "error": f"Response processing failed: {str(e)}",
            "raw_response": response[:1000] if 'response' in locals() else "No response"
        }

def generate_chunked_response(
    system_prompt: str,
    user_prompt: str, 
    response_schema: Dict[str, Any],
    temperature: float,
    chunking_processor
) -> Dict[str, Any]:
    """청킹된 프롬프트 처리"""
    try:
        logger.info("🚀 청킹 기반 처리 시작...")
        start_time = time.time()
        
        # 1. user_prompt를 청킹
        chunks = chunking_processor.create_chunks_with_overlap(user_prompt)
        logger.info(f"📊 총 {len(chunks)}개 청크 생성")
        
        # 2. 각 청크별로 처리
        chunk_results = []
        for i, chunk in enumerate(chunks):
            logger.info(f"🔄 청크 {i+1}/{len(chunks)} 처리 중... (토큰: {chunk['estimated_tokens']})")
            
            # 청크별 시스템 프롬프트 수정
            chunk_system_prompt = f"""{system_prompt}

**청킹 처리 정보:**
- 현재 청크: {i+1}/{len(chunks)}
- 이 청크는 전체 회의의 일부입니다
- 이 청크에서 발견되는 내용만 분석하세요
- 다른 청크의 내용은 나중에 통합됩니다"""

            chunk_user_prompt = f"""다음은 전체 회의록의 일부입니다:

{chunk['text']}

위 내용을 분석하여 이 부분에서 발견되는 액션 아이템, 결정사항, 핵심 포인트를 추출하세요."""
            
            # 단일 청크 처리
            chunk_result = generate_structured_response(
                system_prompt=chunk_system_prompt,
                user_prompt=chunk_user_prompt,
                response_schema=response_schema,
                temperature=temperature,
                enable_chunking=False  # 재귀 방지
            )
            
            chunk_results.append(chunk_result)
            logger.info(f"✅ 청크 {i+1} 처리 완료")
        
        # 3. 결과 통합
        logger.info("🔄 청크 결과 통합 중...")
        merged_result = chunking_processor.merge_chunk_results(chunk_results)
        
        processing_time = time.time() - start_time
        logger.info(f"✅ 청킹 처리 완료 (소요시간: {processing_time:.2f}초)")
        
        # 메타데이터 추가
        merged_result["metadata"] = merged_result.get("metadata", {})
        merged_result["metadata"].update({
            "chunking_applied": True,
            "total_chunks": len(chunks),
            "processing_time": processing_time,
            "original_tokens": chunking_processor.estimate_tokens(user_prompt),
            "chunks_info": [
                {
                    "chunk_id": chunk["chunk_id"],
                    "tokens": chunk["estimated_tokens"],
                    "has_overlap": chunk["has_overlap"]
                }
                for chunk in chunks
            ]
        })
        
        return merged_result
        
    except Exception as e:
        logger.error(f"❌ 청킹 처리 실패: {e}")
        return {
            "error": f"Chunking processing failed: {str(e)}",
            "fallback_message": "청킹 처리에 실패했습니다. 기본 처리를 시도하세요."
        }

@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 시 모델 로딩/정리"""
    logger.info("🚀 Starting TtalKkak Final AI Server with Triplets...")
    
    # 모델들을 미리 로딩 (기본 활성화로 변경)
    preload_enabled = os.getenv("PRELOAD_MODELS", "true").lower() == "true"
    logger.info(f"🔧 Model preloading: {'Enabled' if preload_enabled else 'Disabled'}")
    
    if preload_enabled:
        try:
            logger.info("📦 Starting parallel model preloading...")
            import asyncio
            
            # 병렬 로딩을 위한 비동기 래퍼 함수들 (시간 측정 포함)
            async def load_whisperx_async():
                # WhisperX 원격 서버 체크
                start_time = time.time()
                logger.info("🎤 Checking WhisperX remote server...")
                try:
                    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
                        response = await client.get(f"{WHISPERX_SERVER}/health")
                        if response.status_code == 200:
                            logger.info("✅ WhisperX server connected")
                        else:
                            logger.warning("⚠️ WhisperX server not responding")
                except:
                    logger.warning("⚠️ WhisperX server not available")
                elapsed = time.time() - start_time
                return elapsed
            
            async def load_qwen3_async():
                start_time = time.time()
                logger.info("🧠 Loading Qwen3-4B LoRA...")
                load_qwen3()
                elapsed = time.time() - start_time
                logger.info(f"✅ Qwen3-4B LoRA loaded in {elapsed:.2f} seconds")
                return elapsed
            
            async def load_bert_async():
                if TRIPLET_AVAILABLE:
                    start_time = time.time()
                    logger.info("🔍 Loading BERT classifier...")
                    get_bert_classifier()
                    elapsed = time.time() - start_time
                    logger.info(f"✅ BERT classifier loaded in {elapsed:.2f} seconds")
                    return elapsed
                return 0
            
            # 병렬 로딩 실행 (총 시간 측정)
            total_start_time = time.time()
            
            results = await asyncio.gather(
                load_whisperx_async(),
                load_qwen3_async(), 
                load_bert_async(),
                return_exceptions=True
            )
            
            total_elapsed = time.time() - total_start_time
            
            # 결과 정리
            whisperx_time, qwen3_time, bert_time = results
            if isinstance(whisperx_time, Exception):
                whisperx_time = 0
                logger.error(f"❌ WhisperX loading failed: {whisperx_time}")
            if isinstance(qwen3_time, Exception):
                qwen3_time = 0
                logger.error(f"❌ Qwen3 loading failed: {qwen3_time}")
            if isinstance(bert_time, Exception):
                bert_time = 0
                logger.error(f"❌ BERT loading failed: {bert_time}")
            
            logger.info("🎉 All models preloaded successfully!")
            logger.info("⏱️  Loading Time Summary:")
            logger.info(f"   - WhisperX: {whisperx_time:.2f}s")
            logger.info(f"   - Qwen3-4B: {qwen3_time:.2f}s") 
            logger.info(f"   - BERT: {bert_time:.2f}s")
            logger.info(f"   - Total (parallel): {total_elapsed:.2f}s")
            logger.info(f"   - Sequential would take: {whisperx_time + qwen3_time + bert_time:.2f}s")
            logger.info(f"   - Time saved: {(whisperx_time + qwen3_time + bert_time) - total_elapsed:.2f}s")
            
        except Exception as e:
            logger.error(f"❌ Model preloading failed: {e}")
            logger.info("⚠️ Server will continue with lazy loading")
    else:
        logger.info("📝 Using lazy loading (models load on first request)")
    
    yield
    
    logger.info("🛑 Shutting down TtalKkak Final AI Server...")

# FastAPI 앱 생성
app = FastAPI(
    title="TtalKkak Final AI Server with Triplets",
    description="WhisperX (Remote) + Triplet + BERT + Qwen3-4B + 2-Stage PRD Process",
    version="3.2.0",
    lifespan=lifespan
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """루트 엔드포인트"""
    return {
        "message": "TtalKkak Final AI Server with Triplets",
        "version": "3.1.0",
        "features": [
            "WhisperX Speech-to-Text",
            "Triplet Context Analysis", 
            "BERT Noise Filtering",
            "2-Stage PRD Process",
            "Notion Project Generation", 
            "Task Master PRD Format",
            "Advanced Task Generation"
        ],
        "workflow": "회의록 → Triplet 필터링 → 기획안 → Task Master PRD → 업무생성",
        "docs": "/docs"
    }

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """헬스 체크"""
    gpu_available = torch.cuda.is_available()
    gpu_count = torch.cuda.device_count() if gpu_available else 0
    
    memory_info = None
    if gpu_available:
        try:
            memory_info = {
                "allocated_gb": torch.cuda.memory_allocated() / 1024**3,
                "reserved_gb": torch.cuda.memory_reserved() / 1024**3,
                "total_gb": torch.cuda.get_device_properties(0).total_memory / 1024**3
            }
        except:
            pass
    
    # WhisperX 원격 서버 상태 체크
    whisperx_loaded = False
    try:
        import httpx
        with httpx.Client(timeout=httpx.Timeout(5.0)) as client:
            response = client.get(f"{WHISPERX_SERVER}/health")
            if response.status_code == 200:
                whisperx_loaded = response.json().get("whisperx_loaded", False)
    except:
        pass
    
    return HealthResponse(
        status="healthy",
        gpu_available=gpu_available,
        gpu_count=gpu_count,
        models_loaded={
            "whisperx": whisperx_loaded,  # 원격 서버 상태
            "qwen3": qwen_model is not None,
            "triplet_bert": TRIPLET_AVAILABLE
        },
        memory_info=memory_info
    )

@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(audio: UploadFile = File(...)):
    """음성 파일 전사 (WhisperX 원격 서버)"""
    try:
        logger.info(f"🎤 Transcribing audio via remote server: {audio.filename}")
        
        # WhisperX 원격 서버로 전송
        # 타임아웃 설정: connect=30초, read=20분, write=60초, pool=30초
        timeout = httpx.Timeout(
            connect=30.0,
            read=1200.0,  # 20분
            write=60.0,
            pool=30.0
        )
        async with httpx.AsyncClient(timeout=timeout) as client:
            # 먼저 서버 상태 확인
            try:
                health_response = await client.get(f"{WHISPERX_SERVER}/health")
                if health_response.status_code != 200:
                    logger.error(f"❌ WhisperX server not healthy: {health_response.status_code}")
                    return TranscriptionResponse(
                        success=False,
                        error="WhisperX server not available"
                    )
            except Exception as e:
                logger.error(f"❌ Cannot connect to WhisperX server: {e}")
                return TranscriptionResponse(
                    success=False,
                    error=f"Cannot connect to WhisperX server: {str(e)}"
                )
            
            # 오디오 파일 전송
            files = {"audio": (audio.filename, await audio.read(), audio.content_type)}
            response = await client.post(f"{WHISPERX_SERVER}/transcribe", files=files)
            
            if response.status_code == 200:
                result = response.json()
                logger.info(f"✅ Remote transcription completed")
                return TranscriptionResponse(**result)
            else:
                logger.error(f"❌ WhisperX server error: {response.status_code}")
                return TranscriptionResponse(
                    success=False,
                    error=f"WhisperX server error: {response.status_code}"
                )
                
    except httpx.TimeoutException:
        logger.error("❌ WhisperX server timeout")
        return TranscriptionResponse(
            success=False,
            error="WhisperX server timeout"
        )
    except Exception as e:
        logger.error(f"❌ Transcription error: {e}")
        return TranscriptionResponse(
            success=False,
            error=str(e)
        )

@app.post("/transcribe-enhanced", response_model=EnhancedTranscriptionResponse)
async def transcribe_audio_enhanced(
    audio: UploadFile = File(...),
    enable_bert_filtering: bool = True,
    save_noise_log: bool = True
):
    """향상된 음성 파일 전사 (Triplet + BERT 필터링)"""
    try:
        logger.info(f"🎤 Enhanced transcribing: {audio.filename}")
        
        # 1. 기본 WhisperX 전사
        basic_result = await transcribe_audio(audio)
        if not basic_result.success:
            return EnhancedTranscriptionResponse(
                success=False,
                error=basic_result.error
            )
        
        # 2. Triplet 프로세서로 처리 (사용 가능한 경우)
        if TRIPLET_AVAILABLE and enable_bert_filtering:
            try:
                triplet_processor = get_triplet_processor()
                
                enhanced_result = triplet_processor.process_whisperx_result(
                    whisperx_result=basic_result.transcription,
                    enable_bert_filtering=enable_bert_filtering,
                    save_noise_log=save_noise_log
                )
                
                if enhanced_result["success"]:
                    logger.info("✅ Enhanced transcription with Triplets completed")
                    
                    return EnhancedTranscriptionResponse(
                        success=True,
                        transcription=basic_result.transcription,
                        triplet_data=enhanced_result.get("triplet_data"),
                        filtered_transcript=enhanced_result.get("filtered_transcript"),
                        processing_stats=enhanced_result.get("processing_stats")
                    )
                else:
                    logger.warning("⚠️ Triplet processing failed, using basic transcription")
            except Exception as e:
                logger.warning(f"⚠️ Triplet processing error: {e}")
        
        # 3. Triplet 사용 불가능 시 기본 결과 반환
        return EnhancedTranscriptionResponse(
            success=True,
            transcription=basic_result.transcription,
            filtered_transcript=basic_result.transcription["full_text"],
            processing_stats={"triplet_available": TRIPLET_AVAILABLE}
        )
        
    except Exception as e:
        logger.error(f"❌ Enhanced transcription error: {e}")
        return EnhancedTranscriptionResponse(
            success=False,
            error=str(e)
        )

@app.post("/generate-notion-project", response_model=NotionProjectResponse)
async def generate_notion_project(request: AnalysisRequest):
    """1단계: 회의록 → 노션 기획안 생성"""
    try:
        logger.info("📝 Stage 1: Generating Notion project document...")
        
        # 프롬프트 생성 - generate_meeting_analysis_prompts 사용
        from meeting_analysis_prompts import (
            generate_meeting_analysis_system_prompt,
            generate_meeting_analysis_user_prompt
        )
        
        # 회의 분석용 프롬프트 생성
        system_prompt = generate_meeting_analysis_system_prompt()
        user_prompt = generate_meeting_analysis_user_prompt(
            request.transcript, 
            request.additional_context or ""
        )
        
        # 구조화된 응답 생성
        result = generate_structured_response(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            response_schema=NOTION_PROJECT_SCHEMA,
            temperature=0.3
        )
        
        if "error" in result:
            return NotionProjectResponse(
                success=False,
                error=result["error"]
            )
        
        # 데이터 검증
        validated_result = validate_notion_project(result)
        
        # 노션 형식으로 포맷팅
        formatted_notion = format_notion_project(validated_result)
        
        logger.info("✅ Stage 1 completed: Notion project generated")
        
        return NotionProjectResponse(
            success=True,
            notion_project=validated_result,
            formatted_notion=formatted_notion
        )
        
    except Exception as e:
        logger.error(f"❌ Notion project generation error: {e}")
        return NotionProjectResponse(
            success=False,
            error=str(e)
        )

@app.post("/generate-task-master-prd", response_model=TaskMasterPRDResponse)
async def generate_task_master_prd(notion_project: Dict[str, Any]):
    """2단계: 노션 기획안 → Task Master PRD 변환"""
    try:
        logger.info("🔄 Stage 2: Converting to Task Master PRD format...")
        
        # 프롬프트 생성
        system_prompt = "당신은 기획안을 Task Master PRD 형식으로 변환하는 전문가입니다."
        user_prompt = generate_task_master_prd_prompt(notion_project)
        
        # 구조화된 응답 생성
        result = generate_structured_response(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            response_schema=TASK_MASTER_PRD_SCHEMA,
            temperature=0.3
        )
        
        if "error" in result:
            return TaskMasterPRDResponse(
                success=False,
                error=result["error"]
            )
        
        # 데이터 검증
        validated_result = validate_task_master_prd(result)
        
        # Task Master PRD 형식으로 포맷팅
        formatted_prd = format_task_master_prd(validated_result)
        
        logger.info("✅ Stage 2 completed: Task Master PRD generated")
        
        return TaskMasterPRDResponse(
            success=True,
            prd_data=validated_result,
            formatted_prd=formatted_prd
        )
        
    except Exception as e:
        logger.error(f"❌ Task Master PRD generation error: {e}")
        return TaskMasterPRDResponse(
            success=False,
            error=str(e)
        )

@app.post("/two-stage-analysis", response_model=TwoStageAnalysisResponse)
async def two_stage_analysis(request: TwoStageAnalysisRequest):
    """2단계 프로세스 통합 분석"""
    try:
        logger.info("🚀 Starting 2-stage analysis process...")
        
        start_time = time.time()
        
        # 1단계: 노션 기획안 생성
        stage1_result = None
        if request.generate_notion:
            logger.info("📝 Stage 1: Generating Notion project...")
            notion_request = AnalysisRequest(
                transcript=request.transcript,
                additional_context=request.additional_context
            )
            stage1_response = await generate_notion_project(notion_request)
            
            if not stage1_response.success:
                return TwoStageAnalysisResponse(
                    success=False,
                    error=f"Stage 1 failed: {stage1_response.error}"
                )
            
            stage1_result = stage1_response.notion_project
        
        # 2단계: Task Master PRD 변환
        stage2_result = None
        if request.generate_tasks and stage1_result:
            logger.info("🔄 Stage 2: Converting to Task Master PRD...")
            stage2_response = await generate_task_master_prd(stage1_result)
            
            if not stage2_response.success:
                return TwoStageAnalysisResponse(
                    success=False,
                    error=f"Stage 2 failed: {stage2_response.error}"
                )
            
            stage2_result = stage2_response.prd_data
        
        # 3단계: Task Master 워크플로우 (PRD → Task → 복잡도 분석 → 서브태스크)
        stage3_result = None
        if request.generate_tasks and stage2_result:
            logger.info("🎯 Stage 3: Task Master workflow - PRD to Tasks...")
            
            try:
                # Step 3-1: PRD에서 태스크 생성 (Task Master 방식)
                logger.info("   Step 3-1: Generating tasks from PRD...")
                task_items = await generate_tasks_from_prd(stage2_result, request.num_tasks)
                
                if not task_items:
                    logger.error("❌ No tasks generated from PRD")
                    stage3_result = {
                        "success": False,
                        "summary": "Failed to generate tasks from PRD",
                        "error": "Failed to generate tasks from PRD",
                        "tasks": [],
                        "complexity_analysis": {},
                        "total_tasks": 0
                    }
                else:
                    logger.info(f"   ✅ Generated {len(task_items)} tasks")
                    
                    # Step 3-2: 복잡도 분석 (Task Master 방식)
                    logger.info("   Step 3-2: Analyzing task complexity...")
                    complexity_analysis = await analyze_task_complexity(task_items)
                    
                    # Step 3-3: 복잡도 기반 서브태스크 생성
                    logger.info("   Step 3-3: Generating complexity-based subtasks...")
                    task_items_with_subtasks = await generate_subtasks_for_all_tasks(
                        task_items, 
                        complexity_analysis=complexity_analysis
                    )
                    
                    # Stage 3 결과 구성
                    stage3_result = {
                        "success": True,
                        "summary": f"Generated {len(task_items_with_subtasks)} tasks with {sum(len(task.subtasks) for task in task_items_with_subtasks)} subtasks",
                        "action_items": [task.dict() for task in task_items_with_subtasks],  # tasks → action_items로 변경
                        "tasks": [task.dict() for task in task_items_with_subtasks],  # 호환성을 위해 tasks도 유지
                        "complexity_analysis": complexity_analysis,
                        "total_tasks": len(task_items_with_subtasks),
                        "total_subtasks": sum(len(task.subtasks) for task in task_items_with_subtasks),
                        "workflow_type": "task_master_3_step"
                    }
                    
                    logger.info(f"   ✅ Task Master workflow completed: {len(task_items_with_subtasks)} tasks, "
                              f"{stage3_result['total_subtasks']} subtasks")
                    
                    # 생성된 모든 태스크와 서브태스크 상세 로그 출력
                    try:
                        logger.info("\n" + "="*80)
                        logger.info("📋 생성된 태스크 및 서브태스크 전체 목록")
                        logger.info("="*80)
                        
                        for idx, task in enumerate(task_items_with_subtasks, 1):
                            try:
                                logger.info(f"\n📌 [{idx}] {task.title}")
                                logger.info(f"   📝 설명: {task.description[:100] if task.description else ''}{'...' if task.description and len(task.description) > 100 else ''}")
                                logger.info(f"   ⚡ 복잡도: {getattr(task, 'complexity', 'medium')}")
                                logger.info(f"   🎯 우선순위: {task.priority}")
                                logger.info(f"   ⏱️ 예상시간: {task.estimated_hours or 0}시간")
                                logger.info(f"   📅 시작일: {task.start_date or '미정'}")
                                logger.info(f"   📅 마감일: {task.due_date or '미정'}")
                                
                                if hasattr(task, 'dependencies') and task.dependencies:
                                    logger.info(f"   🔗 의존성: {', '.join(map(str, task.dependencies))}")
                                
                                if hasattr(task, 'acceptance_criteria') and task.acceptance_criteria:
                                    logger.info(f"   ✅ 수락 기준:")
                                    for criteria in task.acceptance_criteria[:3]:
                                        logger.info(f"      - {criteria}")
                                
                                if hasattr(task, 'tags') and task.tags:
                                    logger.info(f"   🏷️ 태그: {', '.join(map(str, task.tags))}")
                                
                                if hasattr(task, 'subtasks') and task.subtasks:
                                    logger.info(f"   📂 서브태스크 ({len(task.subtasks)}개):")
                                    for sub_idx, subtask in enumerate(task.subtasks, 1):
                                        try:
                                            logger.info(f"      [{idx}.{sub_idx}] {subtask.title}")
                                            if hasattr(subtask, 'description') and subtask.description:
                                                logger.info(f"         - 설명: {subtask.description[:60]}{'...' if len(subtask.description) > 60 else ''}")
                                            logger.info(f"         - 예상시간: {getattr(subtask, 'estimated_hours', 0) or 0}시간")
                                            if hasattr(subtask, 'start_date') and subtask.start_date:
                                                logger.info(f"         - 시작일: {subtask.start_date}")
                                            if hasattr(subtask, 'due_date') and subtask.due_date:
                                                logger.info(f"         - 마감일: {subtask.due_date}")
                                        except Exception as e:
                                            logger.error(f"      서브태스크 로그 출력 오류: {e}")
                                else:
                                    logger.info("   📂 서브태스크: 없음")
                            except Exception as e:
                                logger.error(f"태스크 {idx} 로그 출력 오류: {e}")
                        
                        logger.info("\n" + "="*80)
                        logger.info(f"📊 총 요약: 메인 태스크 {len(task_items_with_subtasks)}개, 서브태스크 {stage3_result['total_subtasks']}개")
                        logger.info("="*80 + "\n")
                    except Exception as e:
                        logger.error(f"상세 로그 출력 중 오류 발생: {e}")
                        logger.info(f"✅ 태스크 생성 완료: {len(task_items_with_subtasks)}개 태스크, {stage3_result['total_subtasks']}개 서브태스크")
                    
            except Exception as e:
                logger.error(f"❌ Task Master workflow failed: {str(e)}")
                stage3_result = {
                    "success": False,
                    "summary": f"Task generation failed: {str(e)}",
                    "error": f"Task Master workflow error: {str(e)}",
                    "tasks": [],
                    "complexity_analysis": {},
                    "total_tasks": 0
                }
        
        total_time = time.time() - start_time
        
        return TwoStageAnalysisResponse(
            success=True,
            stage1_notion=stage1_result,
            stage2_prd=stage2_result,
            stage3_tasks=stage3_result,
            formatted_notion=format_notion_project(stage1_result) if stage1_result else None,
            formatted_prd=format_task_master_prd(stage2_result) if stage2_result else None,
            processing_time=total_time
        )
        
    except Exception as e:
        logger.error(f"❌ 2-stage analysis error: {e}")
        return TwoStageAnalysisResponse(
            success=False,
            error=str(e)
        )

@app.post("/two-stage-pipeline-text", response_model=EnhancedTwoStageResult)
async def enhanced_two_stage_pipeline_text(request: dict):
    """텍스트 입력 전용 2단계 파이프라인: 텍스트 → Triplet 필터링 → 2단계 분석"""
    try:
        logger.info("🚀 Starting text-based 2-stage pipeline...")
        
        transcript = request.get("transcript", "")
        if not transcript:
            raise ValueError("transcript가 필요합니다")
            
        enable_bert_filtering = request.get("enable_bert_filtering", True)
        
        # VLLM 사용 여부 확인
        use_vllm = os.getenv("USE_VLLM", "true").lower() == "true"
        
        # 텍스트를 직접 처리하여 Triplet 생성 및 필터링
        if TRIPLET_AVAILABLE and enable_bert_filtering:
            try:
                triplet_processor = get_triplet_processor()
                # 텍스트를 WhisperX 형식으로 변환
                mock_whisperx_result = {
                    "segments": [{"text": transcript, "start": 0, "end": 60}],
                    "full_text": transcript,
                    "language": "ko"
                }
                
                enhanced_result = triplet_processor.process_whisperx_result(
                    whisperx_result=mock_whisperx_result,
                    enable_bert_filtering=enable_bert_filtering,
                    save_noise_log=False
                )
                
                if enhanced_result["success"]:
                    filtered_transcript = enhanced_result["filtered_transcript"]
                    triplet_stats = enhanced_result.get("triplet_stats", {})
                    classification_stats = enhanced_result.get("classification_stats", {})
                else:
                    filtered_transcript = transcript
                    triplet_stats = {}
                    classification_stats = {}
                    
            except Exception as e:
                logger.warning(f"Triplet 처리 실패, 원본 텍스트 사용: {e}")
                filtered_transcript = transcript
                triplet_stats = {}
                classification_stats = {}
        else:
            filtered_transcript = transcript
            triplet_stats = {}
            classification_stats = {}
        
        # Stage 1: Notion 프로젝트 생성
        stage1_notion = None
        if request.get("generate_notion", True):
            try:
                # generate_meeting_analysis_prompts 함수 사용
                from meeting_analysis_prompts import (
                    generate_meeting_analysis_system_prompt,
                    generate_meeting_analysis_user_prompt
                )
                
                # 회의 분석용 프롬프트 생성
                system_prompt = generate_meeting_analysis_system_prompt()
                user_prompt = generate_meeting_analysis_user_prompt(filtered_transcript)
                
                if use_vllm and qwen_model and qwen_tokenizer:
                    from vllm import SamplingParams
                    sampling_params = SamplingParams(
                        temperature=0.3,
                        max_tokens=2048,
                        stop=["<|im_end|>", "<|endoftext|>"]
                    )
                    
                    messages = [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ]
                    
                    formatted_prompt = qwen_tokenizer.apply_chat_template(
                        messages, tokenize=False, add_generation_prompt=True
                    )
                    
                    outputs = qwen_model.generate([formatted_prompt], sampling_params)
                    result_text = outputs[0].outputs[0].text.strip()
                    
                    try:
                        import json
                        stage1_notion = json.loads(result_text)
                    except:
                        stage1_notion = {"title": "AI 프로젝트", "overview": result_text}
                        
            except Exception as e:
                logger.error(f"Notion 생성 실패: {e}")
                stage1_notion = None
        
        # Stage 2: PRD 생성
        stage2_prd = None
        if stage1_notion and request.get("generate_prd", True):
            try:
                from prd_generation_prompts import generate_task_master_prd_prompt
                
                # generate_task_master_prd_prompt는 노션 프로젝트 딕셔너리를 받음
                full_prompt = generate_task_master_prd_prompt(stage1_notion)
                
                # 시스템 프롬프트와 사용자 프롬프트 분리
                system_prompt = "당신은 프로젝트 기획안을 상세한 PRD(Product Requirements Document)로 변환하는 전문가입니다."
                user_prompt = full_prompt
                
                if use_vllm and qwen_model and qwen_tokenizer:
                    from vllm import SamplingParams
                    sampling_params = SamplingParams(
                        temperature=0.3,
                        max_tokens=2048,
                        stop=["<|im_end|>", "<|endoftext|>"]
                    )
                    
                    messages = [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ]
                    
                    formatted_prompt = qwen_tokenizer.apply_chat_template(
                        messages, tokenize=False, add_generation_prompt=True
                    )
                    
                    outputs = qwen_model.generate([formatted_prompt], sampling_params)
                    result_text = outputs[0].outputs[0].text.strip()
                    
                    try:
                        stage2_prd = json.loads(result_text)
                    except:
                        stage2_prd = {"title": "PRD", "overview": result_text}
                        
            except Exception as e:
                logger.error(f"PRD 생성 실패: {e}")
                stage2_prd = None
        
        # Stage 3: 업무 생성
        stage3_tasks = None
        if stage2_prd and request.get("generate_tasks", True):
            try:
                # PRD를 태스크로 변환
                num_tasks = request.get("num_tasks", 5)
                system_prompt = generate_prd_to_tasks_system_prompt(num_tasks)
                user_prompt = generate_prd_to_tasks_user_prompt(stage2_prd, num_tasks)
                
                if use_vllm and qwen_model and qwen_tokenizer:
                    from vllm import SamplingParams
                    sampling_params = SamplingParams(
                        temperature=0.3,
                        max_tokens=4096,
                        stop=["<|im_end|>", "<|endoftext|>"]
                    )
                    
                    messages = [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ]
                    
                    formatted_prompt = qwen_tokenizer.apply_chat_template(
                        messages, tokenize=False, add_generation_prompt=True
                    )
                    
                    outputs = qwen_model.generate([formatted_prompt], sampling_params)
                    result_text = outputs[0].outputs[0].text.strip()
                    
                    try:
                        stage3_tasks = json.loads(result_text)
                    except:
                        stage3_tasks = {"tasks": []}
                        
            except Exception as e:
                logger.error(f"업무 생성 실패: {e}")
                stage3_tasks = None
        
        # Stage 4: 복잡도 분석 및 서브태스크 생성
        stage4_subtasks = None
        if stage3_tasks and stage3_tasks.get("tasks") and request.get("generate_subtasks", True):
            try:
                logger.info("🔍 Stage 4: 태스크 복잡도 분석 및 서브태스크 생성...")
                
                # 복잡도 분석
                complexity_system_prompt = generate_complexity_analysis_system_prompt()
                complexity_user_prompt = generate_complexity_analysis_prompt(stage3_tasks)
                
                if use_vllm and qwen_model and qwen_tokenizer:
                    from vllm import SamplingParams
                    sampling_params = SamplingParams(
                        temperature=0.2,
                        max_tokens=2048,
                        stop=["<|im_end|>", "<|endoftext|>"]
                    )
                    
                    messages = [
                        {"role": "system", "content": complexity_system_prompt},
                        {"role": "user", "content": complexity_user_prompt}
                    ]
                    
                    formatted_prompt = qwen_tokenizer.apply_chat_template(
                        messages, tokenize=False, add_generation_prompt=True
                    )
                    
                    outputs = qwen_model.generate([formatted_prompt], sampling_params)
                    complexity_result = outputs[0].outputs[0].text.strip()
                    
                    try:
                        complexity_analysis = json.loads(complexity_result)
                        logger.info(f"✅ 복잡도 분석 완료: {len(complexity_analysis)}개 태스크 분석됨")
                        
                        # 각 태스크에 대한 서브태스크 생성
                        stage4_subtasks = []
                        for task_idx, task in enumerate(stage3_tasks.get("tasks", [])):
                            # 해당 태스크의 복잡도 분석 찾기
                            task_analysis = next(
                                (a for a in complexity_analysis if a.get("taskId") == task.get("id")),
                                {"complexityScore": 5, "recommendedSubtasks": 3}
                            )
                            
                            # 복잡도가 높은 태스크만 서브태스크 생성 (복잡도 5 이상)
                            if task_analysis.get("complexityScore", 5) >= 5:
                                logger.info(f"📝 태스크 '{task.get('title', '')}' 서브태스크 생성 중...")
                                
                                # 서브태스크 생성
                                subtask_prompt = generate_complexity_based_subtask_prompt(
                                    task, 
                                    task_analysis, 
                                    next_subtask_id=task.get("id", 1) * 100 + 1
                                )
                                
                                subtask_system_prompt = generate_complexity_based_subtask_system_prompt(
                                    task_analysis.get("recommendedSubtasks", 3),
                                    task.get("id", 1) * 100 + 1
                                )
                                
                                messages = [
                                    {"role": "system", "content": subtask_system_prompt},
                                    {"role": "user", "content": subtask_prompt}
                                ]
                                
                                formatted_prompt = qwen_tokenizer.apply_chat_template(
                                    messages, tokenize=False, add_generation_prompt=True
                                )
                                
                                outputs = qwen_model.generate([formatted_prompt], sampling_params)
                                subtask_result = outputs[0].outputs[0].text.strip()
                                
                                try:
                                    subtasks = json.loads(subtask_result)
                                    task["subtasks"] = subtasks.get("subtasks", [])
                                    task["complexityScore"] = task_analysis.get("complexityScore")
                                    task["complexityReasoning"] = task_analysis.get("reasoning", "")
                                    stage4_subtasks.append({
                                        "taskId": task.get("id"),
                                        "taskTitle": task.get("title"),
                                        "subtasks": subtasks.get("subtasks", []),
                                        "complexityScore": task_analysis.get("complexityScore"),
                                        "reasoning": task_analysis.get("reasoning", "")
                                    })
                                    logger.info(f"✅ {len(subtasks.get('subtasks', []))}개 서브태스크 생성됨")
                                except Exception as e:
                                    logger.warning(f"서브태스크 파싱 실패: {e}")
                                    task["subtasks"] = []
                            else:
                                logger.info(f"⏭️ 태스크 '{task.get('title', '')}' 복잡도 낮음 ({task_analysis.get('complexityScore', 0)}) - 서브태스크 생략")
                    
                    except Exception as e:
                        logger.error(f"복잡도 분석 파싱 실패: {e}")
                        complexity_analysis = []
                        
            except Exception as e:
                logger.error(f"Stage 4 (서브태스크 생성) 실패: {e}")
                stage4_subtasks = None
        
        return EnhancedTwoStageResult(
            success=True,
            triplet_stats=triplet_stats,
            classification_stats=classification_stats,
            stage1_notion=stage1_notion,
            stage2_prd=stage2_prd,
            stage3_tasks=stage3_tasks,
            stage4_subtasks=stage4_subtasks if 'stage4_subtasks' in locals() else None,
            formatted_notion=format_notion_project(stage1_notion) if stage1_notion else None,
            formatted_prd=format_task_master_prd(stage2_prd) if stage2_prd else None,
            original_transcript_length=len(transcript),
            filtered_transcript_length=len(filtered_transcript),
            noise_reduction_ratio=1.0 - (len(filtered_transcript) / len(transcript)) if transcript else 0,
            processing_time=time.time() - time.time()
        )
        
    except Exception as e:
        logger.error(f"❌ Text-based 2-stage pipeline error: {e}")
        return EnhancedTwoStageResult(
            success=False,
            error=str(e)
        )

@app.post("/two-stage-pipeline", response_model=EnhancedTwoStageResult)
async def enhanced_two_stage_pipeline(
    audio: UploadFile = File(...),
    enable_bert_filtering: bool = True,
    save_noise_log: bool = True,
    generate_notion: bool = True,
    generate_tasks: bool = True,
    num_tasks: int = 5
):
    """최종 전체 파이프라인: 음성 → Triplet 필터링 → 2단계 분석"""
    try:
        logger.info("🚀 Starting enhanced 2-stage pipeline with Triplets...")
        
        start_time = time.time()
        
        # 1단계: 향상된 전사 (Triplet + BERT)
        logger.info("📝 Step 1: Enhanced transcription...")
        enhanced_transcribe_result = await transcribe_audio_enhanced(
            audio=audio,
            enable_bert_filtering=enable_bert_filtering,
            save_noise_log=save_noise_log
        )
        
        if not enhanced_transcribe_result.success:
            return EnhancedTwoStageResult(
                success=False,
                error=enhanced_transcribe_result.error
            )
        
        # 2단계: 필터링된 텍스트로 2단계 분석
        logger.info("🧠 Step 2: Running 2-stage analysis on filtered content...")
        filtered_text = enhanced_transcribe_result.filtered_transcript or \
                       enhanced_transcribe_result.transcription["full_text"]
        
        # 🔥 청킹 필요성 체크 및 처리
        try:
            from chunking_processor import get_chunking_processor
            chunking_processor = get_chunking_processor(max_context_tokens=32768)
            
            # 필터링된 텍스트 토큰 수 확인
            estimated_tokens = chunking_processor.estimate_tokens(filtered_text)
            logger.info(f"📊 필터링된 텍스트 토큰 수: {estimated_tokens}")
            
            # 노이즈 제거 효과 로그
            original_tokens = chunking_processor.estimate_tokens(
                enhanced_transcribe_result.transcription["full_text"]
            )
            token_reduction = ((original_tokens - estimated_tokens) / original_tokens * 100) if original_tokens > 0 else 0
            logger.info(f"🎯 토큰 감소 효과: {original_tokens} → {estimated_tokens} ({token_reduction:.1f}% 감소)")
            
        except ImportError:
            logger.warning("⚠️ 청킹 프로세서를 불러올 수 없습니다.")
            estimated_tokens = len(filtered_text) * 1.5  # 대략적 추정
        
        analysis_request = TwoStageAnalysisRequest(
            transcript=filtered_text,
            generate_notion=generate_notion,
            generate_tasks=generate_tasks,
            num_tasks=num_tasks
        )
        analysis_result = await two_stage_analysis(analysis_request)
        
        total_time = time.time() - start_time
        
        # 결과 통계 계산
        original_length = len(enhanced_transcribe_result.transcription["full_text"])
        filtered_length = len(filtered_text)
        noise_reduction = 1.0 - (filtered_length / original_length) if original_length > 0 else 0.0
        
        return EnhancedTwoStageResult(
            success=True,
            triplet_stats=enhanced_transcribe_result.triplet_data,
            classification_stats=enhanced_transcribe_result.processing_stats,
            stage1_notion=analysis_result.stage1_notion if analysis_result.success else None,
            stage2_prd=analysis_result.stage2_prd if analysis_result.success else None,
            stage3_tasks=analysis_result.stage3_tasks if analysis_result.success else None,
            formatted_notion=analysis_result.formatted_notion if analysis_result.success else None,
            formatted_prd=analysis_result.formatted_prd if analysis_result.success else None,
            original_transcript_length=original_length,
            filtered_transcript_length=filtered_length,
            noise_reduction_ratio=noise_reduction,
            processing_time=total_time
        )
        
    except Exception as e:
        logger.error(f"❌ Enhanced 2-stage pipeline error: {e}")
        return EnhancedTwoStageResult(
            success=False,
            error=str(e)
        )


@app.post("/pipeline-final", response_model=Dict[str, Any])
async def final_pipeline(
    request: Request,
    audio: UploadFile = File(None),  
    transcript: str = Form(None),
    generate_notion: bool = Form(True),
    generate_tasks: bool = Form(True),
    num_tasks: int = Form(5),
    apply_bert_filtering: bool = Form(False)  # 텍스트 입력시 BERT 필터링 여부
):
    """🚀 최종 전체 파이프라인: 음성/텍스트 자동 감지 → VLLM 초고속 분석"""
    try:
        logger.info("🚀 Starting final pipeline with 2-stage process...")
        
        start_time = time.time()
        
        # JSON 요청 처리
        if request.headers.get("content-type") == "application/json":
            body = await request.json()
            transcript = body.get('transcript')
            generate_notion = body.get('generate_notion', True)
            generate_tasks = body.get('generate_tasks', True)
            num_tasks = body.get('num_tasks', 5)
            apply_bert_filtering = body.get('apply_bert_filtering', False)
            logger.info("📝 JSON request detected")
        else:
            logger.info("📝 Form request detected")
        
        if transcript:
            # 텍스트 입력 - 이미 정리된 회의록이므로 BERT 필터링 생략
            logger.info("📝 Text input detected (clean transcript, skipping BERT filtering)")
            full_text = transcript
        elif audio and audio.filename:
            # 음성 파일 입력
            logger.info("📝 Step 1: Transcribing audio...")
            transcribe_result = await transcribe_audio(audio)
            if not transcribe_result.success:
                return {
                    "success": False,
                    "step": "transcription",
                    "error": transcribe_result.error
                }
            
            # 음성 전사 결과에 BERT 필터링 적용
            raw_text = transcribe_result.transcription["full_text"]
            if TRIPLET_AVAILABLE:
                try:
                    triplet_processor = get_triplet_processor()
                    enhanced_result = triplet_processor.process_whisperx_result(
                        whisperx_result=transcribe_result.transcription,
                        enable_bert_filtering=True,
                        save_noise_log=False
                    )
                    
                    if enhanced_result["success"]:
                        full_text = enhanced_result["filtered_transcript"]
                        logger.info(f"✅ BERT filtering applied to audio: {len(raw_text)} → {len(full_text)} chars")
                    else:
                        full_text = raw_text
                        logger.warning("BERT filtering failed on audio, using original transcription")
                except Exception as e:
                    logger.warning(f"BERT filtering error on audio: {e}, using original transcription")
                    full_text = raw_text
            else:
                full_text = raw_text
        else:
            return {
                "success": False,
                "step": "input",
                "error": "Either transcript or audio file is required"
            }
        
        # 2단계: 2단계 분석
        logger.info("🧠 Step 2: Running 2-stage analysis...")
        analysis_request = TwoStageAnalysisRequest(
            transcript=full_text,
            generate_notion=generate_notion,
            generate_tasks=generate_tasks,
            generate_subtasks=True,  # 서브태스크 생성 활성화
            num_tasks=num_tasks
        )
        analysis_result = await two_stage_analysis(analysis_request)
        
        total_time = time.time() - start_time
        
        # 텍스트 입력과 음성 입력에 따라 transcription 정보 다르게 처리
        if transcript:
            # 텍스트 입력의 경우 가짜 transcription 정보 생성
            transcription_info = {
                "full_text": full_text,
                "segments": [{"text": full_text, "start": 0, "end": 60}],
                "language": "ko"
            }
        else:
            # 음성 입력의 경우 실제 transcription 정보 사용
            transcription_info = transcribe_result.transcription

        # 🔥 생성 완료 로그 - 회의록과 태스크 상세 출력
        logger.info("=" * 80)
        logger.info("🎉 AI 파이프라인 처리 완료!")
        logger.info("=" * 80)
        
        # 1. 회의록 요약 출력 (stage1_notion에서 정보 추출)
        if analysis_result.stage1_notion:
            logger.info("\n📋 [Stage 1: Notion 프로젝트 분석]")
            logger.info(f"제목: {analysis_result.stage1_notion.get('title', 'N/A')}")
            logger.info(f"개요: {analysis_result.stage1_notion.get('overview', 'N/A')[:200]}...")
            if 'objectives' in analysis_result.stage1_notion:
                logger.info(f"목표: {len(analysis_result.stage1_notion.get('objectives', []))}개")
            if 'key_features' in analysis_result.stage1_notion:
                logger.info(f"주요 기능: {len(analysis_result.stage1_notion.get('key_features', []))}개")
        
        # 2. PRD 정보 출력
        if analysis_result.stage2_prd:
            logger.info("\n📄 [Stage 2: Task Master PRD]")
            logger.info(f"제목: {analysis_result.stage2_prd.get('title', 'N/A')}")
            logger.info(f"프로젝트 범위: {analysis_result.stage2_prd.get('scope', 'N/A')[:200]}...")
            if 'requirements' in analysis_result.stage2_prd:
                logger.info(f"요구사항: {len(analysis_result.stage2_prd.get('requirements', []))}개")
        
        # 3. 생성된 태스크 목록 출력
        if analysis_result.stage3_tasks:
            logger.info("\n📌 [Stage 3: 생성된 태스크 목록]")
            
            # stage3_tasks가 dict이고 action_items 키가 있는 경우
            if isinstance(analysis_result.stage3_tasks, dict) and 'action_items' in analysis_result.stage3_tasks:
                tasks = analysis_result.stage3_tasks['action_items']
                logger.info(f"총 {len(tasks)}개 태스크 생성")
                
                # 요약 정보가 있으면 출력
                if 'summary' in analysis_result.stage3_tasks:
                    logger.info(f"프로젝트 요약: {analysis_result.stage3_tasks['summary'][:100]}...")
            # stage3_tasks가 바로 리스트인 경우
            elif isinstance(analysis_result.stage3_tasks, list):
                tasks = analysis_result.stage3_tasks
                logger.info(f"총 {len(tasks)}개 태스크 생성")
            else:
                tasks = []
                logger.info("태스크 구조 확인 필요")
            
            logger.info("-" * 60)
            
            for idx, task in enumerate(tasks, 1):
                logger.info(f"\n태스크 {idx}: {task.get('title', 'N/A')}")
                logger.info(f"  📝 설명: {task.get('description', 'N/A')[:100]}...")
                logger.info(f"  🎯 우선순위: {task.get('priority', 'N/A')}")
                logger.info(f"  📅 시작일: {task.get('start_date', 'N/A')}")
                logger.info(f"  📅 마감일: {task.get('deadline', 'N/A')}")
                logger.info(f"  ⏱️ 예상시간: {task.get('estimated_hours', 0)}시간")
                logger.info(f"  💼 담당자: {task.get('assignee', '미배정')}")
                
                # 서브태스크가 있으면 표시
                subtasks = task.get('subtasks', [])
                if subtasks:
                    logger.info(f"  📂 서브태스크: {len(subtasks)}개")
                    for sub_idx, subtask in enumerate(subtasks[:3], 1):  # 처음 3개만 표시
                        logger.info(f"    - {subtask.get('title', 'N/A')}")
                    if len(subtasks) > 3:
                        logger.info(f"    ... 외 {len(subtasks)-3}개")
        
        # 4. 처리 시간 및 통계
        logger.info("\n⏰ [처리 시간 및 통계]")
        logger.info(f"총 처리시간: {total_time:.2f}초")
        
        # tasks 변수가 정의되어 있으면 통계 출력
        if 'tasks' in locals() and tasks:
            total_subtasks = sum(len(task.get('subtasks', [])) for task in tasks)
            logger.info(f"생성 항목: 태스크 {len(tasks)}개, 서브태스크 {total_subtasks}개")
            
            # 우선순위별 통계
            high_priority = sum(1 for task in tasks if task.get('priority', '').lower() == 'high')
            medium_priority = sum(1 for task in tasks if task.get('priority', '').lower() == 'medium')
            low_priority = sum(1 for task in tasks if task.get('priority', '').lower() == 'low')
            logger.info(f"우선순위: High({high_priority}), Medium({medium_priority}), Low({low_priority})")
            
            # 총 예상 시간
            total_hours = sum(task.get('estimated_hours', 0) for task in tasks)
            logger.info(f"총 예상 작업시간: {total_hours}시간")
        
        logger.info("=" * 80)
        
        # 결과 반환 - 백엔드가 기대하는 형식으로
        return {
            "success": True,
            "step": "completed",
            "transcription": transcription_info,
            # 백엔드가 기대하는 최상위 필드들
            "stage1_notion": analysis_result.stage1_notion,
            "stage2_prd": analysis_result.stage2_prd,
            "stage3_tasks": analysis_result.stage3_tasks,
            "formatted_notion": analysis_result.formatted_notion,
            "formatted_prd": analysis_result.formatted_prd,
            # 추가 정보
            "analysis": {
                "notion_project": analysis_result.stage1_notion,
                "task_master_prd": analysis_result.stage2_prd,
                "generated_tasks": analysis_result.stage3_tasks,
                "formatted_notion": analysis_result.formatted_notion,
                "formatted_prd": analysis_result.formatted_prd
            },
            "processing_time": total_time,
            "model_info": {
                "whisperx": "large-v3",
                "qwen3": "Qwen3-4B LoRA",
                "process": "2-stage-task-master",
                "triplet_available": TRIPLET_AVAILABLE
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Final pipeline error: {e}")
        return {
            "success": False,
            "step": "pipeline",
            "error": str(e)
        }

if __name__ == "__main__":
    # 환경 변수 설정
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    workers = int(os.getenv("WORKERS", "1"))
    
    logger.info(f"🚀 Starting final server with Triplets on {host}:{port}")
    
    uvicorn.run(
        "ai_server_final_with_triplets:app",
        host=host,
        port=port,
        workers=workers,
        reload=False,
        log_level="info"
    )