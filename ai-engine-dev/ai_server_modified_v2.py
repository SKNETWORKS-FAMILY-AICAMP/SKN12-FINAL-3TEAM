#!/usr/bin/env python3
"""
TtalKkak 메인 AI 서버 - WhisperX 분리 버전
WhisperX는 원격 서버(8001)로 호출, 나머지는 로컬 처리
원본 ai_server_final_with_triplets.py에서 WhisperX 부분만 수정
"""

import os
import io
import json
import tempfile
import logging
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager
import time
import httpx
import asyncio

import torch
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException, Body, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# 로컬 모듈 임포트 (원본과 동일)
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

# WhisperX 서버 URL
WHISPERX_SERVER = "http://localhost:8001"

# 글로벌 모델 변수 (WhisperX 제외)
qwen_model = None
qwen_tokenizer = None
triplet_processor = None
bert_classifier = None

# === 원본 파일의 모든 함수들 (WhisperX 관련 제외) ===

async def generate_tasks_from_prd(prd_data: dict, num_tasks: int = 5) -> List[TaskItem]:
    """PRD에서 Task Master 스타일로 태스크 생성 (원본과 동일)"""
    try:
        logger.info(f"🎯 Generating {num_tasks} tasks from PRD using Task Master approach...")
        
        from prd_generation_prompts import (
            generate_prd_to_tasks_system_prompt,
            generate_prd_to_tasks_user_prompt
        )
        
        system_prompt = generate_prd_to_tasks_system_prompt(num_tasks)
        user_prompt = generate_prd_to_tasks_user_prompt(prd_data, num_tasks)
        
        messages = [{"role": "user", "content": user_prompt}]
        
        if qwen_model and qwen_tokenizer:
            text = qwen_tokenizer.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=True
            )
            
            inputs = qwen_tokenizer([text], return_tensors="pt").to(qwen_model.device)
            
            with torch.no_grad():
                outputs = qwen_model.generate(
                    **inputs,
                    max_new_tokens=2048,
                    temperature=0.3,
                    do_sample=True,
                    pad_token_id=qwen_tokenizer.eos_token_id
                )
            
            response = qwen_tokenizer.decode(
                outputs[0][len(inputs["input_ids"][0]):], 
                skip_special_tokens=True
            )
            
            if "```json" in response:
                json_start = response.find("```json") + 7
                json_end = response.find("```", json_start)
                if json_end == -1:
                    json_content = response[json_start:].strip()
                else:
                    json_content = response[json_start:json_end].strip()
            else:
                json_content = response.strip()
            
            task_data = json.loads(json_content)
            
            task_items = []
            for task_info in task_data.get("tasks", []):
                task_item = TaskItem(
                    id=task_info.get("id", len(task_items) + 1),
                    title=task_info.get("title", f"Task {len(task_items) + 1}"),
                    description=task_info.get("description", ""),
                    details=task_info.get("details", ""),
                    priority=task_info.get("priority", "medium"),
                    status=task_info.get("status", "pending"),
                    dependencies=task_info.get("dependencies", []),
                    test_strategy=task_info.get("testStrategy", ""),
                    subtasks=[]
                )
                task_items.append(task_item)
            
            logger.info(f"✅ Generated {len(task_items)} tasks from PRD")
            return task_items
        else:
            logger.error("❌ Qwen model not available for task generation")
            return []
            
    except Exception as e:
        logger.error(f"❌ Error generating tasks from PRD: {e}")
        return []

async def analyze_task_complexity(task_items: List[TaskItem]) -> dict:
    """Task Master 스타일 복잡도 분석 (원본과 동일)"""
    try:
        logger.info("🔍 Analyzing task complexity using Task Master approach...")
        
        from prd_generation_prompts import (
            generate_complexity_analysis_system_prompt,
            generate_complexity_analysis_prompt
        )
        
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
        
        messages = [{"role": "user", "content": user_prompt}]
        
        if qwen_model and qwen_tokenizer:
            text = qwen_tokenizer.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=True
            )
            
            inputs = qwen_tokenizer([text], return_tensors="pt").to(qwen_model.device)
            
            with torch.no_grad():
                outputs = qwen_model.generate(
                    **inputs,
                    max_new_tokens=2048,
                    temperature=0.3,
                    do_sample=True,
                    pad_token_id=qwen_tokenizer.eos_token_id
                )
            
            response = qwen_tokenizer.decode(
                outputs[0][len(inputs["input_ids"][0]):], 
                skip_special_tokens=True
            )
            
            if "```json" in response:
                json_start = response.find("```json") + 7
                json_end = response.find("```", json_start)
                if json_end == -1:
                    json_content = response[json_start:].strip()
                else:
                    json_content = response[json_start:json_end].strip()
            else:
                first_bracket = response.find('[')
                last_bracket = response.rfind(']')
                if first_bracket != -1 and last_bracket > first_bracket:
                    json_content = response[first_bracket:last_bracket + 1]
                else:
                    json_content = response.strip()
            
            complexity_analysis = json.loads(json_content)
            
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

def create_complexity_based_default_subtasks(task: TaskItem, task_analysis: dict) -> List[SubTask]:
    """Task Master 스타일: 복잡도 기반 기본 서브태스크 생성 (원본과 동일)"""
    default_subtasks = []
    
    complexity_score = task_analysis.get('complexityScore', 5)
    recommended_subtasks = task_analysis.get('recommendedSubtasks', 3)
    
    if complexity_score >= 8:
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
            }
        ]
    elif complexity_score >= 5:
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
            }
        ]
    else:
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
            }
        ]
    
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

# 응답 모델들 (원본과 동일)
class TranscriptionResponse(BaseModel):
    success: bool
    transcription: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class EnhancedTranscriptionResponse(BaseModel):
    success: bool
    transcription: Optional[Dict[str, Any]] = None
    triplet_data: Optional[Dict[str, Any]] = None
    filtered_transcript: Optional[str] = None
    processing_stats: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class AnalysisRequest(BaseModel):
    transcript: str
    num_tasks: int = 5
    additional_context: Optional[str] = None

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
    num_tasks: int = 5
    additional_context: Optional[str] = None
    auto_expand_tasks: bool = True

class TwoStageAnalysisResponse(BaseModel):
    success: bool
    stage1_notion: Optional[Dict[str, Any]] = None
    stage2_prd: Optional[Dict[str, Any]] = None
    stage3_tasks: Optional[MeetingAnalysisResult] = None
    formatted_notion: Optional[str] = None
    formatted_prd: Optional[str] = None
    processing_time: Optional[float] = None
    error: Optional[str] = None

class EnhancedTwoStageResult(BaseModel):
    success: bool
    triplet_stats: Optional[Dict[str, Any]] = None
    classification_stats: Optional[Dict[str, Any]] = None
    stage1_notion: Optional[Dict[str, Any]] = None
    stage2_prd: Optional[Dict[str, Any]] = None
    stage3_tasks: Optional[MeetingAnalysisResult] = None
    formatted_notion: Optional[str] = None
    formatted_prd: Optional[str] = None
    original_transcript_length: Optional[int] = None
    filtered_transcript_length: Optional[int] = None
    noise_reduction_ratio: Optional[float] = None
    processing_time: Optional[float] = None
    error: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    gpu_available: bool
    gpu_count: int
    models_loaded: Dict[str, bool]
    memory_info: Optional[Dict[str, float]] = None

def load_qwen3():
    """Qwen3-4B LoRA 모델 로딩 (원본과 동일)"""
    global qwen_model, qwen_tokenizer
    
    if qwen_model is None or qwen_tokenizer is None:
        logger.info("🚀 Loading Qwen3-4B LoRA...")
        try:
            logger.info("📚 Using Transformers")
            from transformers import AutoTokenizer, AutoModelForCausalLM
            
            if os.path.exists("/workspace"):
                model_name = "/workspace/SKN12-FINAL-3TEAM/ai-engine-dev/qwen3_lora_ttalkkac_4b"
            else:
                model_name = "C:/Users/SH/Desktop/TtalKkac/ai-engine-dev/qwen3_lora_ttalkkac_4b"
            
            # 토크나이저 로드
            try:
                qwen_tokenizer = AutoTokenizer.from_pretrained(
                    model_name, 
                    trust_remote_code=True,
                    use_fast=True
                )
                logger.info("✅ 로컬 Qwen3 토크나이저 로드 성공")
            except Exception as e:
                logger.warning(f"로컬 토크나이저 실패: {e}")
                qwen_tokenizer = AutoTokenizer.from_pretrained(
                    "Qwen/Qwen2-1.5B-Instruct", 
                    trust_remote_code=True,
                    use_fast=True
                )
                logger.info("✅ Qwen2 토크나이저 로드 성공 (fallback)")
            
            # Qwen 모델 로드
            try:
                # config.json이 qwen2로 수정된 상태 가정
                qwen_model = AutoModelForCausalLM.from_pretrained(
                    model_name,
                    torch_dtype=torch.float16,
                    trust_remote_code=True,
                    device_map="auto" if torch.cuda.is_available() else None
                )
                logger.info("✅ 로컬 Qwen3 모델 로드 성공")
            except Exception as e:
                logger.warning(f"로컬 모델 로드 실패: {e}")
                # Fallback to base model
                base_model_name = "Qwen/Qwen2-1.5B-Instruct"
                qwen_model = AutoModelForCausalLM.from_pretrained(
                    base_model_name,
                    torch_dtype=torch.float16,
                    trust_remote_code=True
                )
                if torch.cuda.is_available():
                    qwen_model = qwen_model.cuda()
                logger.info("✅ Qwen2 base 모델 로드 성공 (fallback)")
            
            logger.info("✅ Qwen 모델 로드 완료")
            
        except Exception as e:
            logger.error(f"❌ Qwen3-4B LoRA loading failed: {e}")
            raise e
    
    return qwen_model, qwen_tokenizer

def generate_structured_response(
    system_prompt: str, 
    user_prompt: str, 
    response_schema: Dict[str, Any],
    temperature: float = 0.3,
    max_input_tokens: int = 28000,
    enable_chunking: bool = True
) -> Dict[str, Any]:
    """구조화된 응답 생성 (원본과 동일)"""
    
    try:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        text = qwen_tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        
        inputs = qwen_tokenizer([text], return_tensors="pt")
        if torch.cuda.is_available():
            inputs = inputs.to("cuda")
        
        with torch.no_grad():
            outputs = qwen_model.generate(
                **inputs,
                max_new_tokens=4096,
                temperature=temperature,
                do_sample=True,
                top_p=0.9,
                pad_token_id=qwen_tokenizer.eos_token_id
            )
        
        response = qwen_tokenizer.decode(
            outputs[0][len(inputs["input_ids"][0]):], 
            skip_special_tokens=True
        )
        
        if "```json" in response:
            json_start = response.find("```json") + 7
            json_end = response.find("```", json_start)
            if json_end == -1:
                json_content = response[json_start:].strip()
            else:
                json_content = response[json_start:json_end].strip()
        else:
            json_content = response.strip()
        
        result = json.loads(json_content)
        return result
        
    except Exception as e:
        logger.error(f"❌ Response generation error: {e}")
        return {"error": str(e)}

@asynccontextmanager
async def lifespan(app: FastAPI):
    """서버 생명주기 관리"""
    logger.info("🚀 Starting TtalKkak AI Server (WhisperX Remote)...")
    logger.info("🔧 Model preloading: Enabled")
    
    global triplet_processor, bert_classifier
    
    # WhisperX 서버 체크
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{WHISPERX_SERVER}/health")
            if response.status_code == 200:
                logger.info("✅ WhisperX server connected")
            else:
                logger.warning("⚠️ WhisperX server not responding")
    except:
        logger.warning("⚠️ WhisperX server not available at startup")
    
    # Qwen3 모델 로딩
    start_time = time.time()
    try:
        load_qwen3()
        logger.info(f"✅ Qwen3-4B LoRA loaded in {time.time() - start_time:.2f} seconds")
    except Exception as e:
        logger.error(f"❌ Qwen3 loading failed: {e}")
    
    # BERT/Triplet 로딩
    if TRIPLET_AVAILABLE:
        try:
            triplet_processor = get_triplet_processor()
            bert_classifier = get_bert_classifier()
            logger.info("✅ BERT + Triplet loaded")
        except Exception as e:
            logger.error(f"❌ BERT/Triplet loading failed: {e}")
    
    logger.info(f"⏱️ Total loading time: {time.time() - start_time:.2f} seconds")
    
    yield
    
    logger.info("👋 Shutting down server...")
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

# FastAPI 앱 생성 (원본과 동일)
app = FastAPI(
    title="TtalKkak Final AI Server with Triplets",
    description="WhisperX (Remote) + Triplet + BERT + Qwen3-4B + 2-Stage PRD Process",
    version="3.2.0",
    lifespan=lifespan
)

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
        "version": "3.2.0",
        "features": [
            "WhisperX Speech-to-Text (Remote)",
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
    
    # WhisperX 서버 상태 체크
    whisperx_loaded = False
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(f"{WHISPERX_SERVER}/health")
            if response.status_code == 200:
                whisperx_loaded = response.json().get("whisperx_loaded", False)
    except:
        pass
    
    return HealthResponse(
        status="healthy",
        gpu_available=gpu_available,
        gpu_count=gpu_count,
        models_loaded={
            "whisperx": whisperx_loaded,
            "qwen3": qwen_model is not None,
            "triplet_bert": TRIPLET_AVAILABLE
        },
        memory_info=memory_info
    )

@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(audio: UploadFile = File(...)):
    """음성 파일 전사 (WhisperX 원격 호출)"""
    try:
        logger.info(f"🎤 Transcribing audio via remote: {audio.filename}")
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            files = {"audio": (audio.filename, await audio.read(), audio.content_type)}
            response = await client.post(f"{WHISPERX_SERVER}/transcribe", files=files)
            
            if response.status_code == 200:
                return TranscriptionResponse(**response.json())
            else:
                return TranscriptionResponse(
                    success=False,
                    error=f"WhisperX server error: {response.status_code}"
                )
                
    except httpx.TimeoutException:
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
        
        # 1. WhisperX 원격 전사
        basic_result = await transcribe_audio(audio)
        if not basic_result.success:
            return EnhancedTranscriptionResponse(
                success=False,
                error=basic_result.error
            )
        
        # 2. Triplet 프로세서로 처리 (로컬)
        if TRIPLET_AVAILABLE and enable_bert_filtering:
            try:
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

# === 나머지 엔드포인트들은 원본과 동일 (로컬 처리) ===

@app.post("/generate-notion-project", response_model=NotionProjectResponse)
async def generate_notion_project(request: AnalysisRequest):
    """1단계: 회의록 → 노션 기획안 생성"""
    try:
        logger.info("📝 Stage 1: Generating Notion project document...")
        
        system_prompt = generate_meeting_analysis_system_prompt()
        user_prompt = generate_meeting_analysis_user_prompt(request.transcript)
        
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
        
        validated_result = validate_notion_project(result)
        formatted_notion = format_notion_project(validated_result)
        
        logger.info("✅ Notion project document generated successfully")
        
        return NotionProjectResponse(
            success=True,
            notion_project=validated_result,
            formatted_notion=formatted_notion
        )
        
    except Exception as e:
        logger.error(f"❌ Notion generation error: {e}")
        return NotionProjectResponse(
            success=False,
            error=str(e)
        )

@app.post("/generate-task-master-prd", response_model=TaskMasterPRDResponse)
async def generate_task_master_prd(notion_data: Dict[str, Any] = Body(...)):
    """2단계: 노션 → Task Master PRD 생성"""
    try:
        logger.info("📋 Stage 2: Generating Task Master PRD...")
        
        system_prompt = generate_task_master_prd_prompt()
        user_prompt = generate_notion_project_prompt(notion_data)
        
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
        
        validated_result = validate_task_master_prd(result)
        formatted_prd = format_task_master_prd(validated_result)
        
        logger.info("✅ Task Master PRD generated successfully")
        
        return TaskMasterPRDResponse(
            success=True,
            prd_data=validated_result,
            formatted_prd=formatted_prd
        )
        
    except Exception as e:
        logger.error(f"❌ PRD generation error: {e}")
        return TaskMasterPRDResponse(
            success=False,
            error=str(e)
        )

@app.post("/two-stage-analysis", response_model=TwoStageAnalysisResponse)
async def two_stage_analysis(request: TwoStageAnalysisRequest):
    """2단계 분석 파이프라인"""
    try:
        start_time = time.time()
        
        # Stage 1: 노션 프로젝트 생성
        if request.generate_notion:
            logger.info("📝 Stage 1: Generating Notion project...")
            
            notion_request = AnalysisRequest(
                transcript=request.transcript,
                num_tasks=request.num_tasks,
                additional_context=request.additional_context
            )
            
            notion_result = await generate_notion_project(notion_request)
            
            if not notion_result.success:
                return TwoStageAnalysisResponse(
                    success=False,
                    error=notion_result.error
                )
            
            # Stage 2: Task Master PRD 생성
            logger.info("📋 Stage 2: Generating Task Master PRD...")
            
            prd_result = await generate_task_master_prd(notion_result.notion_project)
            
            if not prd_result.success:
                return TwoStageAnalysisResponse(
                    success=False,
                    stage1_notion=notion_result.notion_project,
                    formatted_notion=notion_result.formatted_notion,
                    error=prd_result.error
                )
            
            # Stage 3: 태스크 생성 (선택적)
            tasks_result = None
            if request.generate_tasks:
                logger.info("🎯 Stage 3: Generating tasks...")
                
                task_items = await generate_tasks_from_prd(
                    prd_result.prd_data,
                    request.num_tasks
                )
                
                if request.auto_expand_tasks and task_items:
                    complexity_map = await analyze_task_complexity(task_items)
                    
                    for task in task_items:
                        task_analysis = complexity_map.get(task.id, {})
                        task.subtasks = create_complexity_based_default_subtasks(task, task_analysis)
                
                tasks_result = MeetingAnalysisResult(
                    tasks=task_items,
                    metadata={
                        "total_tasks": len(task_items),
                        "auto_expanded": request.auto_expand_tasks
                    }
                )
            
            processing_time = time.time() - start_time
            
            return TwoStageAnalysisResponse(
                success=True,
                stage1_notion=notion_result.notion_project,
                stage2_prd=prd_result.prd_data,
                stage3_tasks=tasks_result,
                formatted_notion=notion_result.formatted_notion,
                formatted_prd=prd_result.formatted_prd,
                processing_time=processing_time
            )
        
        return TwoStageAnalysisResponse(
            success=False,
            error="No analysis requested"
        )
        
    except Exception as e:
        logger.error(f"❌ Two-stage analysis error: {e}")
        return TwoStageAnalysisResponse(
            success=False,
            error=str(e)
        )

@app.post("/two-stage-pipeline", response_model=EnhancedTwoStageResult)
async def two_stage_pipeline(
    audio: UploadFile = File(...),
    num_tasks: int = 5,
    enable_bert_filtering: bool = True,
    save_noise_log: bool = True,
    auto_expand_tasks: bool = True
):
    """음성 파일 기반 전체 파이프라인"""
    try:
        start_time = time.time()
        
        # 1. 향상된 전사 (WhisperX 원격 + Triplet 로컬)
        enhanced_result = await transcribe_audio_enhanced(
            audio=audio,
            enable_bert_filtering=enable_bert_filtering,
            save_noise_log=save_noise_log
        )
        
        if not enhanced_result.success:
            return EnhancedTwoStageResult(
                success=False,
                error=enhanced_result.error
            )
        
        # 2. 필터링된 텍스트로 2단계 분석
        filtered_text = enhanced_result.filtered_transcript or enhanced_result.transcription["full_text"]
        
        analysis_request = TwoStageAnalysisRequest(
            transcript=filtered_text,
            num_tasks=num_tasks,
            auto_expand_tasks=auto_expand_tasks
        )
        
        analysis_result = await two_stage_analysis(analysis_request)
        
        processing_time = time.time() - start_time
        
        # 통계 계산
        original_length = len(enhanced_result.transcription["full_text"])
        filtered_length = len(filtered_text)
        noise_ratio = 1 - (filtered_length / original_length) if original_length > 0 else 0
        
        return EnhancedTwoStageResult(
            success=analysis_result.success,
            triplet_stats=enhanced_result.triplet_data,
            classification_stats=enhanced_result.processing_stats,
            stage1_notion=analysis_result.stage1_notion,
            stage2_prd=analysis_result.stage2_prd,
            stage3_tasks=analysis_result.stage3_tasks,
            formatted_notion=analysis_result.formatted_notion,
            formatted_prd=analysis_result.formatted_prd,
            original_transcript_length=original_length,
            filtered_transcript_length=filtered_length,
            noise_reduction_ratio=noise_ratio,
            processing_time=processing_time
        )
        
    except Exception as e:
        logger.error(f"❌ Full pipeline error: {e}")
        return EnhancedTwoStageResult(
            success=False,
            error=str(e)
        )

@app.get("/models/status")
async def model_status():
    """모델 상태 확인"""
    whisperx_status = {"loaded": False, "server": "offline"}
    
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(f"{WHISPERX_SERVER}/health")
            if response.status_code == 200:
                whisperx_status = {
                    "loaded": response.json().get("whisperx_loaded", False),
                    "server": "online"
                }
    except:
        pass
    
    return {
        "whisperx": whisperx_status,
        "qwen3": {
            "loaded": qwen_model is not None,
            "tokenizer_loaded": qwen_tokenizer is not None
        },
        "bert": {
            "loaded": TRIPLET_AVAILABLE and bert_classifier is not None
        },
        "triplet": {
            "loaded": TRIPLET_AVAILABLE and triplet_processor is not None
        }
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)