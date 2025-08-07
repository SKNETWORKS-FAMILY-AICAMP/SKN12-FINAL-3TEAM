# 📊 TtalKkak AI Pipeline 단계별 테스트 가이드

## 🔬 처리 단계 상세 설명

### **전체 파이프라인 플로우**
```
음성 파일 (test.MP3)
    ↓
[Step 1] WhisperX 전사
    ↓
[Step 2] BERT 전처리 (Triplet 추출)
    ↓
[Step 3] BERT 분류 (노이즈 필터링)
    ↓
[Step 4] LLM 입력 후처리 ← 🆕 추가된 중요 단계!
    ↓
[Step 5] 회의록 생성 (노션 형식)
    ↓
[Step 6] Task & SubTask 생성
```

---

## 📁 각 단계별 저장 파일 설명

### **Step 1: WhisperX 전사 (`step1_whisperx_transcription`)**
```json
{
  "success": true,
  "full_text": "전체 전사된 텍스트",
  "segments": [
    {
      "text": "문장 단위 텍스트",
      "start": 0.0,
      "end": 2.5
    }
  ],
  "duration": 120.5,
  "language": "ko"
}
```
- **원본 음성의 전체 전사 결과**
- 타임스탬프 포함 세그먼트
- 노이즈, 침묵, 중복 발화 모두 포함

---

### **Step 2: BERT 전처리 (`step2_bert_preprocessing`)**
```json
{
  "original_text": "전사된 원본 텍스트",
  "triplet_data": {
    "triplets": [
      {
        "subject": "개발팀",
        "predicate": "구현",
        "object": "API"
      }
    ]
  },
  "segments": ["문장1", "문장2", "..."],
  "processing_stats": {
    "total_segments": 150,
    "triplet_count": 45
  }
}
```
- **Triplet 추출 결과** (주체-행동-대상)
- 문장 단위로 분할된 세그먼트
- BERT 분류 전 데이터 준비

---

### **Step 3: BERT 분류 (`step3_bert_classification`)**
```json
{
  "filtered_transcript": "유효한 발화만 포함된 텍스트",
  "valid_segments": ["유효 문장1", "유효 문장2"],
  "noise_segments": ["음...", "그래서...", "아 그거"],
  "filtering_ratio": 0.35,
  "statistics": {
    "original_count": 150,
    "valid_count": 98,
    "noise_count": 52
  }
}
```
- **노이즈 필터링 완료된 깨끗한 텍스트**
- 유효/노이즈 분류 결과
- 35% 정도의 노이즈 제거 효과

---

### **Step 4: LLM 후처리 (`step4_llm_postprocessing`)** 🆕
```json
{
  "original_filtered_text": "BERT 필터링된 텍스트",
  "refined_text": "LLM에 최적화된 정제된 텍스트",
  "structured_input": {
    "context": "회의 녹취록 분석",
    "content": "정제된 본문",
    "paragraphs": ["단락1", "단락2", "..."],
    "chunks": ["청크1", "청크2"]  // 긴 텍스트의 경우
  },
  "postprocessing_stats": {
    "original_length": 15000,
    "refined_length": 12000,
    "sentence_count": 120,
    "paragraph_count": 15,
    "chunk_count": 1,
    "estimated_tokens": 18000,
    "chunking_required": false
  },
  "optimization": {
    "duplicate_removal": true,     // 중복 제거
    "sentence_cleaning": true,      // 문장 정리
    "paragraph_structuring": true,  // 단락 구성
    "token_optimization": true      // 토큰 최적화
  }
}
```

#### **후처리 상세 작업:**
1. **텍스트 정제**
   - 연속된 공백 제거
   - 불완전한 문장 제거 (5자 미만)
   - 문장 부호 정리

2. **구조화**
   - 의미 단위로 단락 구성
   - 주제별 그룹핑
   - 논리적 흐름 정리

3. **토큰 최적화**
   - 불필요한 반복 제거
   - 동의어 통합
   - 토큰 수 추정 및 관리

4. **청킹 처리**
   - 28,000 토큰 초과 시 자동 분할
   - 문맥 유지를 위한 오버랩
   - 각 청크별 독립 처리 가능

---

### **Step 5: 회의록 생성 (`step5_meeting_minutes`)**
```json
{
  "success": true,
  "notion_project": {
    "projectName": "프로젝트명",
    "summary": "회의 요약",
    "keyPoints": ["핵심1", "핵심2"],
    "decisions": ["결정사항1", "결정사항2"],
    "actionItems": ["실행항목1", "실행항목2"]
  },
  "formatted_notion": "노션 마크다운 형식 텍스트"
}
```
- **구조화된 회의록**
- 노션 페이지 형식
- 핵심 사항 추출

---

### **Step 6: Task 생성 (`step6_tasks_and_subtasks`)**
```json
{
  "success": true,
  "tasks": [
    {
      "id": 1,
      "title": "API 개발",
      "description": "REST API 구현",
      "priority": "high",
      "complexity_score": 8,
      "subtasks": [
        {
          "id": 1,
          "title": "스키마 설계",
          "estimated_hours": 4
        }
      ]
    }
  ],
  "task_count": 5,
  "subtask_count": 15,
  "complexity_analysis": {
    "average_complexity": 6.5,
    "total_estimated_hours": 120
  }
}
```
- **Task Master 스타일 업무 분해**
- 복잡도 기반 서브태스크
- 시간 추정 포함

---

## 🚀 실행 방법

### **방법 1: 로컬 테스트 (서버 없이)**
```bash
cd ai-engine-dev
python test_local_pipeline.py
```
- 서버 없이 직접 모듈 로드
- 빠른 테스트 가능
- GPU 없어도 부분 실행

### **방법 2: 서버 API 테스트**
```bash
# Terminal 1: AI 서버 실행
python ai_server_final_with_triplets.py

# Terminal 2: 테스트 실행
python test_pipeline_with_logging.py
```
- 완전한 파이프라인 테스트
- 실제 서비스와 동일한 환경

### **방법 3: 배치 파일**
```bash
run_test_pipeline.bat
```
- 자동 환경 체크
- 결과 폴더 자동 열기

---

## 📊 결과 확인

### **결과 저장 위치**
```
pipeline_results/
└── session_20241207_150000/
    ├── step1_whisperx_transcription.json
    ├── step1_whisperx_transcription.txt
    ├── step2_bert_preprocessing.json
    ├── step3_bert_classification.json
    ├── step3_bert_classification.txt
    ├── step4_llm_postprocessing.json    # 🆕 후처리 결과
    ├── step4_llm_postprocessing.txt     # 🆕 정제된 텍스트
    ├── step5_meeting_minutes.json
    ├── step6_tasks_and_subtasks.json
    └── pipeline_summary.json
```

### **주요 확인 포인트**

1. **노이즈 제거 효과**
   - Step 1 → Step 3: 얼마나 줄었는지
   - `filtering_ratio` 확인

2. **텍스트 정제 효과**
   - Step 3 → Step 4: 구조화 개선
   - 문장/단락 구성 확인

3. **토큰 최적화**
   - `estimated_tokens` 확인
   - 청킹 필요 여부

4. **최종 품질**
   - Step 5: 회의록 품질
   - Step 6: 업무 분해 적절성

---

## 🔍 디버깅 팁

### **각 단계별 문제 해결**

| 단계 | 일반적인 문제 | 해결 방법 |
|------|-------------|-----------|
| Step 1 | WhisperX 메모리 부족 | batch_size 줄이기 (16→8) |
| Step 2-3 | BERT 모듈 없음 | `test_local_pipeline.py` 사용 |
| Step 4 | 토큰 초과 | 자동 청킹 확인 |
| Step 5-6 | LLM 응답 없음 | 서버 상태 확인 |

### **로그 레벨 조정**
```python
# 더 상세한 로그를 원할 때
logging.basicConfig(level=logging.DEBUG)
```

---

## 📈 성능 지표

### **일반적인 처리 시간**
- Step 1 (WhisperX): 실시간의 0.5배
- Step 2-3 (BERT): 1-2초
- Step 4 (후처리): < 1초
- Step 5-6 (LLM): 10-30초

### **텍스트 감소 효과**
- 원본 → BERT 필터링: 30-40% 감소
- BERT → LLM 후처리: 10-20% 추가 감소
- 전체: 40-50% 감소 (노이즈 제거 + 최적화)

---

## 💡 활용 예시

### **품질 개선 확인**
1. `step1_*.txt` vs `step4_*.txt` 비교
2. 노이즈가 제거되고 구조화된 것 확인
3. LLM 입력으로 최적화된 것 확인

### **파라미터 튜닝**
- 노이즈 필터링 강도 조절
- 단락 크기 조정
- 청킹 임계값 변경

### **커스텀 처리 추가**
- 도메인 특화 용어 처리
- 화자 분리
- 감정 분석

---

## 📞 문의 및 지원

문제 발생 시 다음 파일들을 확인하세요:
- `pipeline_summary.json`: 전체 실행 요약
- `step*_*.json`: 각 단계별 상세 결과
- 로그 파일: 실행 중 출력된 메시지

테스트 파일 준비:
- 파일명: `test.MP3`
- 위치: `ai-engine-dev/` 폴더
- 권장: 1-5분 길이의 회의 녹음