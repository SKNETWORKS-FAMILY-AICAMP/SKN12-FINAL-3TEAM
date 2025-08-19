# 딸깍 : 회의 분석 기반 지능형 AI 프로젝트 관리 시스템

## 👨‍👩‍👧‍👦 조원 명단

| 박슬기                  | 노명구                  | 이주영               | 이준석                  | 황차해                   |
| ----------------------- | ----------------------- | -------------------- | ----------------------- | ------------------------ |
| ![](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN12-FINAL-3TEAM/blob/main/%EC%82%B0%EC%B6%9C%EB%AC%BC/%EB%B0%9C%ED%91%9C%EC%9E%90%EB%A3%8C/img/%EC%8A%AC%EA%B8%B0%EB%8B%98.png?raw=true)    | ![](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN12-FINAL-3TEAM/blob/main/%EC%82%B0%EC%B6%9C%EB%AC%BC/%EB%B0%9C%ED%91%9C%EC%9E%90%EB%A3%8C/img/%EB%AA%85%EA%B5%AC%EB%8B%98.png?raw=true)    | ![](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN12-FINAL-3TEAM/blob/main/%EC%82%B0%EC%B6%9C%EB%AC%BC/%EB%B0%9C%ED%91%9C%EC%9E%90%EB%A3%8C/img/%EC%A3%BC%EC%98%81%EB%8B%98.png?raw=true) | ![](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN12-FINAL-3TEAM/blob/main/%EC%82%B0%EC%B6%9C%EB%AC%BC/%EB%B0%9C%ED%91%9C%EC%9E%90%EB%A3%8C/img/%EC%A4%80%EC%84%9D%EB%8B%98.png?raw=true)    | ![](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN12-FINAL-3TEAM/blob/main/%EC%82%B0%EC%B6%9C%EB%AC%BC/%EB%B0%9C%ED%91%9C%EC%9E%90%EB%A3%8C/img/%EC%B0%A8%ED%95%B4%EB%8B%98.png?raw=true)     |
| PM 겸 풀스택 | AI/ML 엔지니어 | 백엔드/프론트 개발자 | 데이터 엔지니어 | AI/ML 엔지니어 |

## 🔍 프로젝트 개요

## 🎯프로젝트 목표

## 핵심 기능

## 기술 스텍
| Category              | Badges |
|------------------------|--------|
| Programming Languages | <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=Python&logoColor=white"> <img src="https://img.shields.io/badge/javascript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=white"> <img src="https://img.shields.io/badge/typescript-3178C6?style=for-the-badge&logo=typescript&logoColor=white"> <img src="https://img.shields.io/badge/CSS-663399?style=for-the-badge&logo=CSS&logoColor=white"> <img src="https://img.shields.io/badge/html5-E34F26?style=for-the-badge&logo=html5&logoColor=white"> |
| Frameworks & Libraries | <img src="https://img.shields.io/badge/fastapi-009688?style=for-the-badge&logo=fastapi&logoColor=white"> <img src="https://img.shields.io/badge/prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white"> <img src="https://img.shields.io/badge/pandas-150458?style=for-the-badge&logo=pandas&logoColor=white"> <img src="https://img.shields.io/badge/numpy-013243?style=for-the-badge&logo=numpy&logoColor=white"> <img src="https://img.shields.io/badge/scipy-8CAAE6?style=for-the-badge&logo=scipy&logoColor=white"> <img src="https://img.shields.io/badge/scikitlearn-F7931E?style=for-the-badge&logo=scikitlearn&logoColor=white"> |
| AI & ML             | <img src="https://img.shields.io/badge/openai-412991?style=for-the-badge&logo=openai&logoColor=white"> <img src="https://img.shields.io/badge/Qwen3-1ED760?style=for-the-badge&logo=alibabadotcom&logoColor=white"> <img src="https://img.shields.io/badge/RunPod-46C1F6?style=for-the-badge"/> <img src="https://img.shields.io/badge/KoBERT-F1007E?style=for-the-badge&logo="> <img src="https://img.shields.io/badge/WhisperX-8A2BE2?style=for-the-badge&logo=openai&logoColor=white"> <img src="https://img.shields.io/badge/gpt--4o-BC52EE?style=for-the-badge&logo=openai&logoColor=white"> <img src="https://img.shields.io/badge/tensorflow-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white"> <img src="https://img.shields.io/badge/huggingface-FFD21E?style=for-the-badge&logo=huggingface&logoColor=white"> <img src="https://img.shields.io/badge/pytorch-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white"> |
| Databases & Cache   | <img src="https://img.shields.io/badge/postgresql-4169E1?style=for-the-badge&logo=postgresql&logoColor=white"> <img src="https://img.shields.io/badge/redis-FF4438?style=for-the-badge&logo=redis&logoColor=white"> |
| Infra & Tools       | <img src="https://img.shields.io/badge/github-181717?style=for-the-badge&logo=github&logoColor=white"> <img src="https://img.shields.io/badge/amazonaws-orange?style=for-the-badge&logo=amazonaws&logoColor=white"> <img src="https://img.shields.io/badge/docker-2496ED?style=for-the-badge&logo=docker&logoColor=white"> <img src="https://img.shields.io/badge/runpod-DDDF72?style=for-the-badge&logo=runpod&logoColor=white">


## 데이터
### 1) 수집 대상 & 규모 </br>
</br>
국회 상임·특별위원회 회의록: 52개 세션 / 약 49,003 발화, 정제 JSONL</br>
→ 공식 회의 발언을 timestamp, timestamp_order, speaker, text로 구조화. </br> 공개 회의록으로 개인정보 민감정보 없음. </br>
</br>
AMI 다자 대화록(한글 번역): 154개 세션 / 89,773 발화, 정제 JSONL </br>
→ 시간 순/화자 구분 완전, LLM 요약·역할분류·흐름분석에 적합. </br>
</br>
ICSI 다자 대화록(한글 번역): 75개 세션 / 94,793 발화, 정제 JSONL </br>
→ 일부 빈 발화 제거 규칙 적용, 나머지 정상 구조화. </br>
</br>

### 2) 공통 스키마 (정제 후 JSONL) </br>
</br>
각 라인은 아래 4개 필드를 갖습니다. </br>

```
{
  "timestamp": "00:11",               // 발화 시점(또는 None)
  "timestamp_order": "5-1",           // 같은 시점 내 순번
  "speaker": "Speaker_A",             // 화자
  "text": "발화 내용"                 // 텍스트
}
```

</br>
국회 회의록은 공식 문서 특성상 장문·논리적 흐름 → 요약/의제전이 실험 적합. </br>
AMI/ICSI는 구어체·짧은 발화 다수 → 역할 분류/대화흐름 모델 검증에 적합.  </br>
</br>

### 3) 전처리/정합성 </br>
</br>
형식 통일: PDF/XML/CSV → JSONL로 변환 (정규표현식 + 스크립트) </br>
결측/노이즈 처리 </br>
국회: speaker/text 누락 시 행 제거. </br>
AMI: 구조 완전, 추가 보간 불필요. </br> 
ICSI: "@", ".", "" 등 빈/무의미 발화 제거.  </br>
품질 점검: 시간/화자/내용 필드 누락 자동 점검, 중복 제거.  </br>
</br>

### 4) 저장 위치 </br>
</br>
저장 경로(예): </br>
데이터/국회 회의록 (전처리 후) </br>
데이터/영어 회의록 (AMI Corpus, 전처리 후) </br>
데이터/영어 회의록 (ICSI Corpus, 전처리 후) </br>
모두 JSONL, 인코딩은(해당되는 경우) UTF-8 with BOM.  </br>

### 5) 라이선스/출처 </br>
</br>
국회 회의록: 대한민국 국회 정보공개포털 공개 자료. </br>
AMI/ICSI: The University of Edinburgh 공개 데이터셋(허가 라이선스 포함).  </br>

## 모델 구성
아래 그림은 전체 모델 파이프라인을 나타냅니다.

## ERD
서비스의 데이터베이스 구조는 아래와 같습니다.

![ERD](https://raw.githubusercontent.com/SKNETWORKS-FAMILY-AICAMP/SKN12-FINAL-3TEAM/refs/heads/main/%EC%82%B0%EC%B6%9C%EB%AC%BC/%EB%B0%9C%ED%91%9C%EC%9E%90%EB%A3%8C/img/ERD.webp)

## 시스템 아키텍쳐
아래 그림은 **TtalKkak AI 프로젝트 관리 시스템**의 전체 아키텍처를 보여줍니다.  
클라이언트 → 백엔드 API → AI 처리 엔진 → 데이터 레이어 → 비즈니스 서비스 → 외부 연동 API 로 이어지는 흐름을 한눈에 확인할 수 있습니다.
![시스템 아키텍처](https://github.com/SKNETWORKS-FAMILY-AICAMP/SKN12-FINAL-3TEAM/blob/main/%EC%82%B0%EC%B6%9C%EB%AC%BC/%EB%B0%9C%ED%91%9C%EC%9E%90%EB%A3%8C/img/%EC%8B%9C%EC%8A%A4%ED%85%9C%EC%95%84%ED%82%A4%ED%85%8D%EC%B2%98.png?raw=true)
### 주요 구성 요소
- **클라이언트 레이어**: 웹 대시보드(React), Slack App, 모바일 앱
- **백엔드 API 레이어**: Express 서버, Slack 핸들러, 멀티테넌트 지원
- **AI 처리 엔진**: FastAPI, WhisperX STT, BERT 분류기, Qwen3-32B-AWQ
- **데이터 레이어**: PostgreSQL, Prisma ORM, Redis, 사용자·프로젝트 데이터
- **비즈니스 서비스**: Notion API, JIRA API, 스마트 태스크 배정
- **외부 서비스 연동**: Slack/Notion/JIRA/AI 서버

## 시퀀스 다이어그램
아래 그림은 **TtalKkak AI 프로젝트 관리 시스템**에서 회의 발화 → AI 분석 → 태스크 자동 생성/배정 → Notion/JIRA 연동으로 이어지는 주요 시나리오의 흐름을 나타냅니다.  
![시퀀스 다이어그램](https://raw.githubusercontent.com/SKNETWORKS-FAMILY-AICAMP/SKN12-FINAL-3TEAM/refs/heads/main/%EC%82%B0%EC%B6%9C%EB%AC%BC/%EB%B0%9C%ED%91%9C%EC%9E%90%EB%A3%8C/img/%EC%8B%9C%ED%80%80%EC%8A%A4%EB%8B%A4%EC%9D%B4%EC%96%B4%EA%B7%B8%EB%9E%A8.webp)
### 주요 Phase
- **Phase 1: 음성 입력 및 회의록 처리**
  - 사용자가 회의 발화를 입력 → WhisperX STT → 텍스트 변환
- **Phase 2: 요약/의도 분석**
  - BERT 분류기 & Qwen3 모델이 요약 및 태스크 후보 생성
- **Phase 3: 스마트 태스크 생성 및 할당**
  - Express 서버 → Notion/JIRA API 호출 → 업무 자동 등록
- **Phase 4: 결과 전달**
  - 사용자에게 Slack/웹 대시보드로 피드백 제공

---

## 💬 팀원 한 줄 회고

| 이름   | 한 줄 회고                                                                                                                                    |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 박슬기 |                |
| 노명구 |                |
| 이주영 |                |
| 이준석 |                |
| 황차해 |                |

---
