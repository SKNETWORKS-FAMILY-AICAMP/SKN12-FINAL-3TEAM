"""
TtalKkak PRD 생성 프롬프트 시스템
회의록 → 기획안 → Task Master PRD 형식 변환
"""

import json
from datetime import datetime

# 노션용 기획안 템플릿
NOTION_PROJECT_TEMPLATE = """
## 프로젝트 개요

**프로젝트명**: {project_name}

**목적**: {project_purpose}

**수행기간**: {project_period}

**담당자**: {project_manager}

## 핵심 목표

{core_objectives}

## 세부 내용

- **핵심 아이디어**
    
    {core_idea}
    
- **아이디어 기술**
    
    {idea_description}
    
- **실행 계획**
    
    {execution_plan}

## 기대 효과

{expected_effects}
"""

# Task Master PRD 템플릿
TASK_MASTER_PRD_TEMPLATE = """
# Overview  
{overview}

# Core Features  
{core_features}

# User Experience  
{user_experience}

# Technical Architecture  
{technical_architecture}

# Development Roadmap  
{development_roadmap}

# Logical Dependency Chain
{logical_dependency_chain}

# Risks and Mitigations  
{risks_and_mitigations}

# Appendix  
{appendix}
"""

def generate_notion_project_prompt(meeting_transcript: str) -> str:
    """노션 기획안 생성 프롬프트"""
    return f"""
다음 회의 전사본을 바탕으로 노션에 업로드할 프로젝트 기획안을 작성하세요.

**회의 전사본:**
{meeting_transcript}

**작성 지침:**
1. 회의에서 논의된 내용을 바탕으로 체계적인 기획안을 작성
2. 프로젝트명은 회의 내용을 바탕으로 적절히 명명
3. 목적과 목표는 명확하고 구체적으로 작성
4. 실행 계획은 실현 가능한 단계별로 구성
5. 기대 효과는 정량적/정성적 결과를 포함
6. 모든 내용은 한국어로 작성

**응답 형식:**
다음 JSON 형식으로 응답하세요:
{{
    "project_name": "프로젝트명",
    "project_purpose": "프로젝트의 주요 목적",
    "project_period": "예상 수행 기간 (예: 2025.01.01 ~ 2025.03.31)",
    "project_manager": "담당자명 (회의에서 언급된 경우)",
    "core_objectives": [
        "목표 1: 구체적인 목표",
        "목표 2: 구체적인 목표",
        "목표 3: 구체적인 목표"
    ],
    "core_idea": "핵심 아이디어 설명",
    "idea_description": "아이디어의 기술적/비즈니스적 설명",
    "execution_plan": "단계별 실행 계획과 일정",
    "expected_effects": [
        "기대효과 1: 자세한 설명",
        "기대효과 2: 자세한 설명",
        "기대효과 3: 자세한 설명"
    ]
}}
"""

def generate_task_master_prd_prompt(notion_project: dict) -> str:
    """Task Master PRD 변환 프롬프트"""
    return f"""
다음 기획안을 Task Master가 사용하는 PRD 형식으로 변환하세요.

**기획안 정보:**
- 프로젝트명: {notion_project.get('project_name', '')}
- 목적: {notion_project.get('project_purpose', '')}
- 핵심 아이디어: {notion_project.get('core_idea', '')}
- 실행 계획: {notion_project.get('execution_plan', '')}
- 핵심 목표: {', '.join(notion_project.get('core_objectives', []))}
- 기대 효과: {', '.join(notion_project.get('expected_effects', []))}

**변환 지침:**
1. Overview: 프로젝트의 전체적인 개요, 해결하는 문제, 타겟 사용자, 가치 제안
2. Core Features: 주요 기능들을 구체적으로 나열하고 각각의 중요성과 작동 방식 설명
3. User Experience: 사용자 여정, 페르소나, 주요 플로우, UI/UX 고려사항
4. Technical Architecture: 시스템 구성요소, 데이터 모델, API, 인프라 요구사항
5. Development Roadmap: MVP 요구사항, 향후 개선사항, 단계별 개발 범위
6. Logical Dependency Chain: 개발 순서, 기초 기능 우선순위, 점진적 개발 방식
7. Risks and Mitigations: 기술적 도전, MVP 정의, 자원 제약사항
8. Appendix: 추가 정보, 연구 결과, 기술 사양

**응답 형식:**
다음 JSON 형식으로 응답하세요:
{{
    "overview": "프로젝트 전체 개요",
    "core_features": "주요 기능들 상세 설명",
    "user_experience": "사용자 경험 설계",
    "technical_architecture": "기술 아키텍처 설명",
    "development_roadmap": "개발 로드맵",
    "logical_dependency_chain": "논리적 의존성 체인",
    "risks_and_mitigations": "위험 요소 및 완화 방안",
    "appendix": "추가 정보 및 참고 자료"
}}
"""

def format_notion_project(project_data: dict) -> str:
    """노션 기획안 포맷팅"""
    
    # 핵심 목표 포맷팅
    core_objectives_formatted = "\n".join([f"- {obj}" for obj in project_data.get('core_objectives', [])])
    
    # 기대 효과 포맷팅
    expected_effects_formatted = "\n".join([f"- {effect}" for effect in project_data.get('expected_effects', [])])
    
    return f"""## 프로젝트 개요

**프로젝트명**: {project_data.get('project_name', '[프로젝트명 입력]')}

**목적**: {project_data.get('project_purpose', '[프로젝트의 주요 목적]')}

**수행기간**: {project_data.get('project_period', '[시작일] ~ [종료일]')}

**담당자**: {project_data.get('project_manager', '[담당자명]')}

## 핵심 목표

{core_objectives_formatted}

## 세부 내용

- **핵심 아이디어**
    
    {project_data.get('core_idea', '핵심아이디어')}
    
- **아이디어 기술**
    
    {project_data.get('idea_description', '아이디어의 기술')}
    
- **실행 계획**
    
    {project_data.get('execution_plan', '단계별 실행 계획과 일정을 작성하세요.')}

## 기대 효과

{expected_effects_formatted}
"""

def format_task_master_prd(prd_data: dict) -> str:
    """Task Master PRD 포맷팅"""
    # 백슬래시 문제 해결을 위해 문자열 변수 사용
    apostrophe = "'"
    overview_default = f"[Provide a high-level overview of your product here. Explain what problem it solves, who it{apostrophe}s for, and why it{apostrophe}s valuable.]"
    features_default = f"[List and describe the main features of your product. For each feature, include: What it does, Why it{apostrophe}s important, How it works at a high level]"
    risks_default = f"[Identify potential risks and how they{apostrophe}ll be addressed: Technical challenges, Figuring out the MVP that we can build upon, Resource constraints]"
    
    return f"""# Overview  
{prd_data.get('overview', overview_default)}

# Core Features  
{prd_data.get('core_features', features_default)}

# User Experience  
{prd_data.get('user_experience', '[Describe the user journey and experience. Include: User personas, Key user flows, UI/UX considerations]')}

# Technical Architecture  
{prd_data.get('technical_architecture', '[Outline the technical implementation details: System components, Data models, APIs and integrations, Infrastructure requirements]')}

# Development Roadmap  
{prd_data.get('development_roadmap', '[Break down the development process into phases: MVP requirements, Future enhancements, Do not think about timelines whatsoever -- all that matters is scope and detailing exactly what needs to be build in each phase so it can later be cut up into tasks]')}

# Logical Dependency Chain
{prd_data.get('logical_dependency_chain', '[Define the logical order of development: Which features need to be built first (foundation), Getting as quickly as possible to something usable/visible front end that works, Properly pacing and scoping each feature so it is atomic but can also be built upon and improved as development approaches]')}

# Risks and Mitigations  
{prd_data.get('risks_and_mitigations', risks_default)}

# Appendix  
{prd_data.get('appendix', '[Include any additional information: Research findings, Technical specifications]')}
"""

# 2단계 프로세스 검증 함수
def validate_notion_project(project_data: dict) -> dict:
    """노션 기획안 데이터 검증"""
    required_fields = [
        'project_name', 'project_purpose', 'core_objectives', 
        'core_idea', 'execution_plan', 'expected_effects'
    ]
    
    validated = {}
    for field in required_fields:
        if field not in project_data or not project_data[field]:
            if field == 'core_objectives':
                validated[field] = ["목표 1: 프로젝트 핵심 기능 구현", "목표 2: 시스템 안정성 확보", "목표 3: 사용자 경험 개선"]
            elif field == 'expected_effects':
                validated[field] = ["업무 효율성 30% 향상", "프로세스 자동화로 인한 시간 단축", "팀 협업 및 커뮤니케이션 개선"]
            else:
                validated[field] = f"[{field} 입력 필요]"
        else:
            # 빈 배열 체크 추가
            if field == 'expected_effects' and isinstance(project_data[field], list) and len(project_data[field]) == 0:
                validated[field] = ["업무 효율성 30% 향상", "프로세스 자동화로 인한 시간 단축", "팀 협업 및 커뮤니케이션 개선"]
            elif field == 'core_objectives' and isinstance(project_data[field], list) and len(project_data[field]) == 0:
                validated[field] = ["목표 1: 프로젝트 핵심 기능 구현", "목표 2: 시스템 안정성 확보", "목표 3: 사용자 경험 개선"]
            else:
                validated[field] = project_data[field]
    
    # 선택적 필드들
    optional_fields = ['project_period', 'project_manager', 'idea_description']
    for field in optional_fields:
        validated[field] = project_data.get(field, f"[{field} 입력 필요]")
    
    return validated

def validate_task_master_prd(prd_data: dict) -> dict:
    """Task Master PRD 데이터 검증"""
    required_sections = [
        'overview', 'core_features', 'user_experience', 
        'technical_architecture', 'development_roadmap',
        'logical_dependency_chain', 'risks_and_mitigations', 'appendix'
    ]
    
    validated = {}
    for section in required_sections:
        if section not in prd_data or not prd_data[section]:
            validated[section] = f"[{section} 섹션 내용 필요]"
        else:
            validated[section] = prd_data[section]
    
    return validated

# 프롬프트 생성 유틸리티
def generate_two_stage_prompts(meeting_transcript: str):
    """2단계 프로세스 프롬프트 생성"""
    return {
        "stage1_notion": generate_notion_project_prompt(meeting_transcript),
        "stage2_prd": None  # 1단계 결과를 받은 후 생성
    }

# Task Master 스타일 PRD → Task 생성 프롬프트
def generate_prd_to_tasks_system_prompt(num_tasks: int, next_id: int = 1) -> str:
    """PRD를 태스크로 변환하는 시스템 프롬프트 (Task Master 스타일)"""
    return f"""You are an AI assistant specialized in analyzing Product Requirements Documents (PRDs) and generating a structured, logically ordered, dependency-aware and sequenced list of development tasks in JSON format.

Analyze the provided PRD content and generate approximately {num_tasks} top-level development tasks. If the complexity or the level of detail of the PRD is high, generate more tasks relative to the complexity of the PRD

Each task should represent a logical unit of work needed to implement the requirements and focus on the most direct and effective way to implement the requirements without unnecessary complexity or overengineering. Include pseudo-code, implementation details, and test strategy for each task. Find the most up to date information to implement each task.

Assign sequential IDs starting from {next_id}. Infer title, description, details, and test strategy for each task based *only* on the PRD content.

Set status to 'pending', dependencies to an empty array [], and priority to 'medium' initially for all tasks.

IMPORTANT: All task titles, descriptions, details, and test strategies MUST be written in Korean (한국어). Technical terms can remain in English where appropriate.

Respond ONLY with a valid JSON object containing a single key "tasks", where the value is an array of task objects adhering to the provided schema. Do not include any explanation or markdown formatting.

Each task should follow this JSON structure:
{{
    "id": number,
    "title": string (한국어로 작성),
    "description": string (한국어로 작성),
    "status": "pending",
    "dependencies": number[] (IDs of tasks this depends on),
    "priority": "high" | "medium" | "low", 
    "details": string (한국어로 구현 세부사항 작성),
    "testStrategy": string (한국어로 검증 방법 작성)
}}

Guidelines:
1. Unless complexity warrants otherwise, create exactly {num_tasks} tasks, numbered sequentially starting from {next_id}
2. Each task should be atomic and focused on a single responsibility following the most up to date best practices and standards
3. Order tasks logically - consider dependencies and implementation sequence
4. Early tasks should focus on setup, core functionality first, then advanced features
5. Include clear validation/testing approach for each task
6. Set appropriate dependency IDs (a task can only depend on tasks with lower IDs, potentially including existing tasks with IDs less than {next_id} if applicable)
7. Assign priority (high/medium/low) based on criticality and dependency order
8. Include detailed implementation guidance in the "details" field
9. If the PRD contains specific requirements for libraries, database schemas, frameworks, tech stacks, or any other implementation details, STRICTLY ADHERE to these requirements in your task breakdown and do not discard them under any circumstance
10. Focus on filling in any gaps left by the PRD or areas that aren't fully specified, while preserving all explicit requirements
11. Always aim to provide the most direct path to implementation, avoiding over-engineering or roundabout approaches"""

def generate_prd_to_tasks_user_prompt(prd_data: dict, num_tasks: int, next_id: int = 1) -> str:
    """PRD를 태스크로 변환하는 사용자 프롬프트"""
    prd_content = format_task_master_prd(prd_data)
    
    return f"""Here's the Product Requirements Document (PRD) to break down into approximately {num_tasks} tasks, starting IDs from {next_id}:

{prd_content}

Return your response in this format (모든 내용은 한국어로 작성):
{{
    "tasks": [
        {{
            "id": {next_id},
            "title": "프로젝트 저장소 설정", 
            "description": "Git 저장소 초기화 및 기본 구조 설정",
            "status": "pending",
            "dependencies": [],
            "priority": "high",
            "details": "Git 저장소 생성, .gitignore 설정, README 작성, 브랜치 전략 수립...",
            "testStrategy": "저장소 접근 권한 확인, 브랜치 생성 테스트..."
        }},
        ...
    ],
    "metadata": {{
        "projectName": "PRD 구현",
        "totalTasks": {num_tasks},
        "sourceFile": "PRD",
        "generatedAt": "{datetime.now().isoformat()}"
    }}
}}"""

# 복잡도 분석 프롬프트 (Task Master 스타일)
def generate_complexity_analysis_system_prompt() -> str:
    """복잡도 분석 시스템 프롬프트"""
    return 'You are an expert software architect and project manager analyzing task complexity. Respond only with the requested valid JSON array.'

def generate_complexity_analysis_prompt(tasks_data: dict) -> str:
    """복잡도 분석 프롬프트 생성"""
    tasks_string = json.dumps(tasks_data.get('tasks', []), ensure_ascii=False, indent=2)
    return f"""Analyze the following tasks to determine their complexity (1-10 scale) and recommend the number of subtasks for expansion. Provide a brief reasoning and an initial expansion prompt for each.

Tasks:
{tasks_string}

Respond ONLY with a valid JSON array matching the schema:
[
  {{
    "taskId": <number>,
    "taskTitle": "<string>",
    "complexityScore": <number 1-10>,
    "recommendedSubtasks": <number>,
    "expansionPrompt": "<string>",
    "reasoning": "<string>"
  }},
  ...
]

Do not include any explanatory text, markdown formatting, or code block markers before or after the JSON array."""

# Task Master 스타일 서브태스크 확장 프롬프트 (복잡도 기반)
def generate_complexity_based_subtask_prompt(task: dict, task_analysis: dict, next_subtask_id: int = 1) -> str:
    """복잡도 분석 기반 서브태스크 생성 프롬프트"""
    num_subtasks = task_analysis.get('recommendedSubtasks', 3)
    custom_prompt = task_analysis.get('expansionPrompt', '')
    
    if custom_prompt:
        # 복잡도 분석에서 제공된 커스텀 프롬프트 사용
        return f"""
{custom_prompt}

**태스크 정보:**
- ID: {task.get('id')}
- 제목: {task.get('title', '')}
- 설명: {task.get('description', '')}
- 복잡도: {task_analysis.get('complexityScore', 5)}/10
- 추천 서브태스크 수: {num_subtasks}개

**복잡도 분석 근거:**
{task_analysis.get('reasoning', '')}

**응답 형식:**
다음 JSON 형식으로 정확히 {num_subtasks}개의 서브태스크를 생성하세요 (모든 내용은 한국어로 작성):
{{
    "subtasks": [
        {{
            "id": {next_subtask_id},
            "title": "서브태스크 제목 (한국어)",
            "description": "구체적인 작업 내용 (한국어)",
            "priority": "high/medium/low",
            "estimated_hours": 숫자,
            "dependencies": [],
            "details": "구현 세부사항",
            "status": "pending",
            "required_skills": ["JavaScript", "React", "Node.js"],  // 이 작업에 필요한 기술 스택
            "work_type": "frontend/backend/fullstack/mobile/design/database/devops/cloud/data/ai/testing/documentation/pm/security/optimization"  // 작업 유형
        }}
    ]
}}
"""
    else:
        # 기본 서브태스크 생성 프롬프트
        return f"""
다음 태스크를 {num_subtasks}개의 구체적인 서브태스크로 분해하세요:

**태스크 정보:**
- ID: {task.get('id')}
- 제목: {task.get('title', '')}
- 설명: {task.get('description', '')}
- 복잡도: {task_analysis.get('complexityScore', 5)}/10
- 세부사항: {task.get('details', '')}

**서브태스크 분해 가이드라인:**
1. 각 서브태스크는 독립적으로 실행 가능해야 함
2. 논리적 순서에 따라 배열
3. 구체적이고 측정 가능한 결과물 정의
4. 예상 소요 시간을 현실적으로 설정
5. 복잡도 {task_analysis.get('complexityScore', 5)}/10에 맞는 세분화 수준 적용

**응답 형식:**
{{
    "subtasks": [
        {{
            "id": {next_subtask_id},
            "title": "서브태스크 제목",
            "description": "구체적인 작업 내용",
            "priority": "high/medium/low",
            "estimated_hours": 숫자,
            "dependencies": [],
            "details": "구현 세부사항",
            "status": "pending",
            "required_skills": ["필요한", "기술", "목록"],
            "work_type": "frontend/backend/fullstack/mobile/design/database/devops/cloud/data/ai/testing/documentation/pm/security/optimization 중 하나"
        }}
    ]
}}
"""

def generate_complexity_based_subtask_system_prompt(num_subtasks: int, next_id: int) -> str:
    """복잡도 기반 서브태스크 시스템 프롬프트"""
    return f"""You are an AI assistant helping with task breakdown. Generate exactly {num_subtasks} subtasks based on the provided prompt and context. 

Respond ONLY with a valid JSON object containing a single key "subtasks" whose value is an array of the generated subtask objects. Each subtask object in the array must have keys: "id", "title", "description", "dependencies", "details", "status", "priority", "estimated_hours", "required_skills", "work_type". 

- 'required_skills': Must be an array of technology/skill strings like ["JavaScript", "React", "Node.js", "Python", "AWS", etc.]
- 'work_type': Must be one of: "frontend", "backend", "fullstack", "mobile", "design", "database", "devops", "cloud", "data", "ai", "testing", "documentation", "pm", "security", "optimization"

Ensure the 'id' starts from {next_id} and is sequential. Ensure 'dependencies' only reference valid prior subtask IDs generated in this response (starting from {next_id}). Ensure 'status' is 'pending'. Do not include any other text or explanation."""

# 응답 스키마
NOTION_PROJECT_SCHEMA = {
    "project_name": "프로젝트명",
    "project_purpose": "프로젝트의 주요 목적",
    "project_period": "예상 수행 기간",
    "project_manager": "담당자명",
    "core_objectives": [
        "목표 1: 구체적인 목표",
        "목표 2: 구체적인 목표",
        "목표 3: 구체적인 목표"
    ],
    "core_idea": "핵심 아이디어 설명",
    "idea_description": "아이디어의 기술적/비즈니스적 설명",
    "execution_plan": "단계별 실행 계획과 일정",
    "expected_effects": [
        "기대효과 1: 자세한 설명",
        "기대효과 2: 자세한 설명",
        "기대효과 3: 자세한 설명"
    ]
}

TASK_MASTER_PRD_SCHEMA = {
    "overview": "프로젝트 전체 개요",
    "core_features": "주요 기능들 상세 설명",
    "user_experience": "사용자 경험 설계",
    "technical_architecture": "기술 아키텍처 설명",
    "development_roadmap": "개발 로드맵",
    "logical_dependency_chain": "논리적 의존성 체인",
    "risks_and_mitigations": "위험 요소 및 완화 방안",
    "appendix": "추가 정보 및 참고 자료"
}