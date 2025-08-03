# 🚀 TtalKkac 배포 체크리스트

## 📋 배포 전 필수 확인사항

### 1. **ngrok 설정**
```bash
# ngrok 실행 (새 터미널)
ngrok http 3500
```
- 생성된 URL을 기록 (예: `https://abcd1234.ngrok-free.app`)

### 2. **환경변수 업데이트**

#### A. `backend/.env` 파일 수정
```bash
# APP_URL을 ngrok URL로 변경
APP_URL=https://YOUR-NGROK-URL.ngrok-free.app

# AI 서버 URL 설정 (로컬 AI 서버 사용시)
RUNPOD_AI_URL=http://localhost:8000
# 또는 다른 ngrok AI 서버
RUNPOD_AI_URL=https://YOUR-AI-NGROK-URL.ngrok-free.app
```

#### B. 메인 `.env` 파일 수정
```bash
# APP_URL을 백엔드와 동일하게 설정
APP_URL=https://YOUR-NGROK-URL.ngrok-free.app
```

### 3. **OAuth 앱 설정 업데이트**

각 서비스에서 Redirect URL을 새 ngrok URL로 변경:

#### A. Slack OAuth App
- 위치: https://api.slack.com/apps
- Redirect URL: `https://YOUR-NGROK-URL.ngrok-free.app/auth/slack/callback`
- Event Request URL: `https://YOUR-NGROK-URL.ngrok-free.app/api/slack/events`

#### B. Notion OAuth App  
- 위치: https://developers.notion.com/my-integrations
- Redirect URI: `https://YOUR-NGROK-URL.ngrok-free.app/auth/notion/callback`

#### C. Jira OAuth App
- 위치: https://developer.atlassian.com/console/myapps/
- Callback URL: `https://YOUR-NGROK-URL.ngrok-free.app/auth/jira/callback`

### 4. **데이터베이스 설정**

#### PostgreSQL 설정
```bash
# PostgreSQL 서비스 시작
# Windows: PostgreSQL 서비스 시작
# macOS: brew services start postgresql
# Ubuntu: sudo systemctl start postgresql

# 데이터베이스 생성
createdb ddalkkak_new
# 또는 psql에서
# CREATE DATABASE ddalkkak_new;
```

#### Redis 설정
```bash
# Redis 서버 시작
# Windows: Redis 서비스 시작
# macOS: brew services start redis
# Ubuntu: sudo systemctl start redis
```

### 5. **의존성 설치**

```bash
# 메인 프로젝트
npm install

# 백엔드
cd backend
npm install

# 프론트엔드
cd ../frontend/web-dashboard
npm install
```

### 6. **서버 실행 순서**

```bash
# 1. AI 서버 실행 (별도 터미널)
cd ai-engine-dev
python app.py

# 2. 백엔드 서버 실행 (별도 터미널)  
cd backend
npm run dev

# 3. 프론트엔드 실행 (별도 터미널)
cd frontend/web-dashboard
npm start

# 4. ngrok 실행 (별도 터미널)
ngrok http 3500
```

## 🔧 자주 발생하는 문제 해결

### 문제 1: OAuth 콜백 오류
**증상**: "redirect_uri_mismatch" 오류
**해결**: 각 OAuth 앱의 Redirect URL이 현재 ngrok URL과 일치하는지 확인

### 문제 2: AI 서버 연결 실패
**증상**: AI 추론 요청 실패
**해결**: 
- `RUNPOD_AI_URL`이 실제 AI 서버 주소와 일치하는지 확인
- AI 서버가 실행 중인지 확인

### 문제 3: 데이터베이스 연결 실패
**증상**: "connection refused" 오류
**해결**:
- PostgreSQL 서비스가 실행 중인지 확인
- `DATABASE_URL`의 호스트/포트/계정정보 확인
- 데이터베이스가 존재하는지 확인

### 문제 4: CORS 오류
**증상**: 브라우저에서 API 요청 실패
**해결**:
- `WEBSOCKET_CORS_ORIGIN`을 프론트엔드 URL로 설정
- `FRONTEND_URL` 환경변수 확인

### 문제 5: Slack 이벤트 수신 실패
**증상**: Slack 메시지가 앱에 전달되지 않음
**해결**:
- Slack 앱의 Event Subscriptions에서 Request URL 업데이트
- ngrok URL + `/api/slack/events`로 설정

## 📝 배포 완료 체크리스트

- [ ] ngrok 실행 및 URL 확인
- [ ] 모든 환경변수 파일 업데이트
- [ ] OAuth 앱 Redirect URL 업데이트
- [ ] 데이터베이스 서비스 실행
- [ ] AI 서버 실행 확인
- [ ] 백엔드 서버 실행 및 로그 확인
- [ ] 프론트엔드 실행 및 접속 확인
- [ ] Slack 앱 연동 테스트
- [ ] Notion 연동 테스트
- [ ] Jira 연동 테스트

## 🆘 문제 발생시 확인사항

1. **로그 확인**
   ```bash
   # 백엔드 로그
   cd backend && npm run dev
   
   # AI 서버 로그
   cd ai-engine-dev && python app.py
   ```

2. **환경변수 일치 확인**
   - 메인 `.env`와 `backend/.env`의 `APP_URL` 일치
   - OAuth 앱 설정과 환경변수 일치

3. **네트워크 연결 확인**
   ```bash
   # AI 서버 연결 테스트
   curl http://localhost:8000/health
   
   # 백엔드 서버 연결 테스트  
   curl http://localhost:3500/api/health
   ```

4. **포트 충돌 확인**
   ```bash
   # 사용 중인 포트 확인
   netstat -tulpn | grep :3500
   netstat -tulpn | grep :8000
   ```