/**
 * TtalKkak Backend Server with AI Integration
 * Slack → AI 기획안 → 업무 생성 → 외부 연동
 */
import { Request, Response } from 'express';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import multer from 'multer';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as jsonwebtoken from 'jsonwebtoken';

import { SimpleTenantMiddleware } from './middleware/tenant';
import { AIService } from './services/ai-service';
import { JiraService } from './services/jira-service';
import { SmartTaskAssigner } from './services/smart-task-assigner';
import { authenticateUser, generateToken, createOrUpdateUser } from './middleware/auth';

// Slack 핸들러 import
const { slackApp } = require('./slack-handler');

// 환경 변수 로드
dotenv.config();

// Prisma 클라이언트 초기화
const prisma = new PrismaClient();

// Express 앱 생성
const app = express();
const server = createServer(app);

// Multi-tenant 미들웨어 초기화
const tenantMiddleware = new SimpleTenantMiddleware(prisma);

// AI 서비스 초기화
const aiService = new AIService();

// JIRA 서비스 초기화
const jiraService = new JiraService(prisma);

// 스마트 업무 배정 서비스 초기화
const smartAssigner = new SmartTaskAssigner(prisma);

// 파일 업로드 설정 (메모리 저장)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
  fileFilter: (req, file, cb) => {
    // 오디오 파일만 허용 (M4A, MP3, WAV, WEBM 등)
    const allowedMimeTypes = [
      'audio/mpeg',
      'audio/mp3', 
      'audio/wav',
      'audio/m4a',
      'audio/mp4',
      'audio/x-m4a',
      'audio/webm',
      'audio/ogg'
    ];
    
    const allowedExtensions = ['.mp3', '.wav', '.m4a', '.mp4', '.webm', '.ogg'];
    const fileExtension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    
    if (file.mimetype.startsWith('audio/') || 
        allowedMimeTypes.includes(file.mimetype) ||
        allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype} (${fileExtension}). Supported: MP3, WAV, M4A, WEBM, OGG`));
    }
  }
});

// Socket.IO 서버 설정
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3002",
    methods: ["GET", "POST"]
  }
});

const PORT = parseInt(process.env.PORT || '3500', 10);
const HOST = process.env.HOST || '0.0.0.0';

// 기본 미들웨어 설정
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3002",
  credentials: true
}));
app.use(compression());

// 모든 요청 로깅 (디버깅용)
app.use((req, res, next) => {
  console.log(`📨 요청: ${req.method} ${req.path}`);
  if (req.path.startsWith('/slack')) {
    console.log(`🔍 Slack 요청 상세:`, {
      method: req.method,
      path: req.path,
      userAgent: req.headers['user-agent'],
      contentType: req.headers['content-type']
    });
  }
  next();
});

// Slack 경로는 body parser를 건너뛰기 (Slack Bolt가 자체 처리)
app.use((req, res, next) => {
  if (req.path.startsWith('/slack')) {
    // /slack/events는 우리가 직접 처리하므로 제외
    if (req.path === '/slack/events') {
      return next();
    }
    // 나머지 /slack 경로는 Slack Bolt가 처리하도록 건너뛰기
    return next();
  }
  express.json({ limit: '50mb' })(req, res, next);
});

app.use((req, res, next) => {
  if (req.path.startsWith('/slack')) {
    return next();
  }
  express.urlencoded({ extended: true, limit: '50mb' })(req, res, next);
});

// 간단한 테스트 라우트
app.get('/slack/test', (req, res) => {
  console.log('✅ Slack 테스트 GET 요청 수신');
  res.json({ status: 'ok', message: 'Slack endpoint working' });
});

// Slack 슬래시 커맨드는 Bolt 앱에서 처리하도록 전달
// 이 라우트를 제거하고 Bolt 앱이 직접 처리하도록 함

// Slack Challenge 처리 및 버튼 액션 처리
// Slack은 application/x-www-form-urlencoded와 application/json 둘 다 사용
app.post('/slack/events', express.raw({ type: ['application/x-www-form-urlencoded', 'application/json'] }), async (req: any, res: any, next: any) => {
  console.log('🔍 Slack POST 요청 수신');
  console.log('Headers:', req.headers);
  console.log('Content-Type:', req.headers['content-type']);
  
  const contentType = req.headers['content-type'] || '';
  let body;
  
  // raw body를 문자열로 변환
  const rawBody = req.body.toString();
  
  // JSON 요청 처리 (URL verification 등)
  if (contentType.includes('application/json')) {
    try {
      body = JSON.parse(rawBody);
      console.log('📦 JSON Body 파싱:', body);
      
      // Slack Challenge 응답
      if (body.type === 'url_verification') {
        console.log('✅ URL Verification Challenge:', body.challenge);
        // 텍스트로 응답
        res.setHeader('Content-Type', 'text/plain');
        return res.status(200).send(body.challenge);
      }
      
      // 일반 이벤트 처리
      if (body.type === 'event_callback') {
        console.log('📨 이벤트:', body.event);
        return res.status(200).send('OK');
      }
    } catch (e) {
      console.error('❌ JSON 파싱 실패:', e);
      return res.status(400).send('Bad Request');
    }
  }
  
  // URL-encoded 요청 처리 (버튼 액션 등)
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(rawBody);
    
    // payload가 있으면 버튼 액션
    if (params.has('payload')) {
      console.log('🎯 버튼 액션 감지 - Slack Bolt로 전달');
      // rawBody를 req에 추가하고 Slack Bolt로 전달
      req.rawBody = rawBody;
      // body 파싱
      req.body = Object.fromEntries(params);
      
      if (slackApp && slackApp.receiver && slackApp.receiver.app) {
        return slackApp.receiver.app(req, res, next);
      }
    }
  }
  
  return res.status(200).send('OK');
});

// 헬스 체크 엔드포인트
app.get('/health', async (req, res) => {
  try {
    // AI 서버 연결 확인
    const aiConnected = await aiService.testConnection();
    
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      database: 'connected',
      ai_server: aiConnected ? 'connected' : 'disconnected',
      version: '1.0.0'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Slack OAuth 콜백 (테스트용 - 비활성화)
// 아래의 실제 OAuth 핸들러 사용을 위해 주석 처리
/*
app.get('/auth/slack/callback', (req: Request, res: Response) => {
  console.log('✅✅✅ /auth/slack/callback 라우트 직접 호출됨!');
  console.log('Query params:', req.query);
  
  const { code, error } = req.query;
  
  if (error) {
    console.error('❌ Slack OAuth 에러:', error);
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3002'}/login?error=slack_auth_failed`);
  }
  
  // 임시로 테스트 사용자 사용
  const testUser = {
    id: 'test-user-id-123',
    slackUserId: 'U123456',
    name: 'Test User',
    email: 'test@example.com',
    avatar: '',
    teamId: 'T123456',
    teamName: 'Test Team',
    tenantId: 'default-tenant-id',
    role: 'MEMBER'
  };
  
  const userToken = generateToken(testUser);
  const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3002'}/login/success?token=${encodeURIComponent(userToken)}`;
  return res.redirect(redirectUrl);
});
*/

// ===== OAuth 연동 엔드포인트 =====

// Notion OAuth 콜백 (구체적인 경로를 먼저 정의)
app.get('/auth/notion/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      console.error('❌ Notion OAuth 오류:', error);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/settings?notion=error&message=${encodeURIComponent(error as string)}`);
    }
    
    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }
    
    // state 디코딩
    const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    const { tenantId, tenantSlug, userId, slackUserId } = stateData;
    
    console.log('🔄 Notion OAuth 콜백 처리:', { tenantId, tenantSlug, userId, slackUserId });
    
    // tenantSlug로 실제 tenant 찾기
    let actualTenantId = tenantId;
    if (tenantSlug && !tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug }
      });
      if (tenant) {
        actualTenantId = tenant.id;
      }
    }
    
    // 토큰 교환
    const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.APP_URL + '/auth/notion/callback'
      })
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('❌ Notion 토큰 교환 실패:', errorData);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/settings?notion=error&message=token_exchange_failed`);
    }
    
    const tokens: any = await tokenResponse.json();
    console.log('✅ Notion 토큰 받음:', {
      workspace_name: tokens.workspace_name,
      bot_id: tokens.bot_id
    });
    
    // 암호화 함수 (간단한 버전)
    const encrypt = (text: string) => {
      // 실제로는 crypto 모듈 사용해야 함
      return Buffer.from(text).toString('base64');
    };
    
    // 실제 User 찾기 (userId가 실제 UUID인 경우)
    let user = null;
    
    // userId가 UUID 형식이면 직접 찾기
    if (userId && userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      user = await prisma.user.findUnique({
        where: { id: userId }
      });
    }
    
    // 못 찾았으면 slackUserId로 찾기
    if (!user && (slackUserId || userId)) {
      const searchId = slackUserId || userId;
      user = await prisma.user.findFirst({
        where: {
          tenantId: actualTenantId,
          slackUserId: searchId
        }
      });
    }

    if (!user) {
      console.error('❌ 사용자를 찾을 수 없음:', { 
        tenantId: actualTenantId, 
        userId, 
        slackUserId 
      });
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/settings?notion=error&message=user_not_found`);
    }

    console.log('👤 사용자 확인됨:', { userId: user.id, slackUserId: user.slackUserId });

    // 사용자별 토큰 저장 (실제 User UUID 사용)
    await prisma.integration.upsert({
      where: {
        tenantId_userId_serviceType: {
          tenantId: actualTenantId,
          userId: user.id, // Slack ID가 아닌 실제 User UUID 사용
          serviceType: 'NOTION'
        }
      },
      update: {
        accessToken: encrypt(tokens.access_token),
        isActive: true,
        config: {
          workspace_name: tokens.workspace_name,
          workspace_id: tokens.workspace_id,
          bot_id: tokens.bot_id,
          owner: tokens.owner
        }
      },
      create: {
        tenantId: actualTenantId,
        userId: user.id, // Slack ID가 아닌 실제 User UUID 사용
        serviceType: 'NOTION',
        accessToken: encrypt(tokens.access_token),
        isActive: true,
        config: {
          workspace_name: tokens.workspace_name,
          workspace_id: tokens.workspace_id,
          bot_id: tokens.bot_id,
          owner: tokens.owner
        }
      }
    });
    
    console.log('✅ Notion 연동 저장 완료');
    
    // Frontend의 NotionSuccess 페이지로 리다이렉트
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
    const successUrl = `${frontendUrl}/notion-success?user=${encodeURIComponent(tokens.workspace_name || 'Notion User')}`;
    
    console.log('🎯 Notion 연동 성공, Frontend로 리다이렉트:', successUrl);
    return res.redirect(successUrl);
    
  } catch (error) {
    console.error('❌ Notion OAuth 콜백 처리 오류:', error);
    res.status(500).json({ error: 'OAuth callback processing failed' });
  }
});

// Notion OAuth 시작
app.get('/auth/notion/:tenantSlug', async (req, res) => {
  try {
    const { tenantSlug } = req.params;
    const { userId, state } = req.query;
    
    console.log('🔍 OAuth 엔드포인트 호출됨:', {
      tenantSlug,
      userId,
      state,
      fullUrl: req.url,
      query: req.query
    });
    
    if (!userId) {
      console.error('❌ userId 파라미터가 누락됨. Slack 앱에서 버튼을 통해 접근해야 합니다.');
      return res.send(`
        <html>
          <head>
            <title>잘못된 접근</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
              .error { color: #dc3545; font-size: 24px; margin-bottom: 20px; }
              .info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="error">❌ 잘못된 접근입니다</div>
            <div class="info">
              <h3>올바른 사용 방법</h3>
              <p>1. Slack에서 <strong>/tk start</strong> 명령어를 입력하세요</p>
              <p>2. <strong>노션 연결하기</strong> 버튼을 클릭하세요</p>
              <p>3. 브라우저에서 직접 URL에 접근하지 마세요</p>
            </div>
            <p>이 창을 닫고 Slack으로 돌아가세요.</p>
          </body>
        </html>
      `);
    }
    
    // tenantSlug에서 실제 tenant 찾기
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug }
    });
    
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    const stateData = {
      tenantId: tenant.id,
      userId: userId as string,
      timestamp: Date.now()
    };
    
    const encodedState = Buffer.from(JSON.stringify(stateData)).toString('base64');
    
    const authUrl = `https://api.notion.com/v1/oauth/authorize?` +
      `client_id=${process.env.NOTION_CLIENT_ID || 'YOUR_NOTION_CLIENT_ID'}&` +
      `response_type=code&` +
      `owner=user&` +
      `state=${encodedState}&` +
      `redirect_uri=${encodeURIComponent(process.env.APP_URL + '/auth/notion/callback')}`;
      
    console.log('🔗 Notion OAuth 시작:', {
      tenantSlug,
      userId,
      authUrl: authUrl.substring(0, 100) + '...'
    });
    
    return res.redirect(authUrl);
  } catch (error) {
    console.error('❌ Notion OAuth 시작 오류:', error);
    return res.status(500).json({ error: 'OAuth initialization failed' });
  }
});

// ===== JIRA OAuth 연동 =====

// JIRA OAuth 콜백 (구체적인 경로를 먼저 정의)
app.get('/auth/jira/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      console.error('❌ JIRA OAuth 오류:', error);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/settings?jira=error&message=${error}`);
    }
    
    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }
    
    // state 디코딩
    const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    const { tenantId, tenantSlug, userId, slackUserId } = stateData;
    
    console.log('🔄 JIRA OAuth 콜백 처리:', { tenantId, tenantSlug, userId, slackUserId });
    
    // tenantSlug로 실제 tenant 찾기
    let actualTenantId = tenantId;
    if (tenantSlug && !tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug }
      });
      if (tenant) {
        actualTenantId = tenant.id;
      }
    }
    
    // 토큰 교환 (JIRA OAuth 2.0 3LO)
    const tokenResponse = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: process.env.JIRA_CLIENT_ID,
        client_secret: process.env.JIRA_CLIENT_SECRET,
        code,
        redirect_uri: process.env.APP_URL + '/auth/jira/callback'
      })
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('❌ JIRA 토큰 교환 실패:', errorData);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/settings?jira=error&message=token_exchange_failed`);
    }
    
    const tokens: any = await tokenResponse.json();
    console.log('✅ JIRA 토큰 받음:', {
      access_token: tokens.access_token ? 'received' : 'missing',
      refresh_token: tokens.refresh_token ? 'received' : 'missing'
    });
    
    // 사용자 정보 및 사이트 정보 가져오기
    const resourceResponse = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Accept': 'application/json'
      }
    });
    
    const resources: any = await resourceResponse.json();
    console.log('✅ JIRA 리소스 받음:', resources);
    
    // 암호화 함수 (간단한 버전)
    const encrypt = (text: string) => {
      return Buffer.from(text).toString('base64');
    };
    
    // 실제 User 찾기 (userId가 실제 UUID인 경우)
    let user = null;
    
    // userId가 UUID 형식이면 직접 찾기
    if (userId && userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      user = await prisma.user.findUnique({
        where: { id: userId }
      });
    }
    
    // 못 찾았으면 slackUserId로 찾기
    if (!user && (slackUserId || userId)) {
      const searchId = slackUserId || userId;
      user = await prisma.user.findFirst({
        where: {
          tenantId: actualTenantId,
          slackUserId: searchId
        }
      });
    }

    if (!user) {
      console.error('❌ 사용자를 찾을 수 없음:', { 
        tenantId: actualTenantId, 
        userId, 
        slackUserId 
      });
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/settings?jira=error&message=user_not_found`);
    }
    
    console.log('👤 사용자 확인됨:', { userId: user.id, slackUserId: user.slackUserId });
    
    // 사용자별 토큰 저장
    await prisma.integration.upsert({
      where: {
        tenantId_userId_serviceType: {
          tenantId: actualTenantId,
          userId: user.id,
          serviceType: 'JIRA'
        }
      },
      update: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        isActive: true,
        config: {
          site: resources[0] || null,
          site_url: resources[0]?.url || null,
          site_name: resources[0]?.name || null,
          scope: tokens.scope
        }
      },
      create: {
        tenantId: actualTenantId,
        userId: user.id,
        serviceType: 'JIRA',
        accessToken: encrypt(tokens.access_token),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        isActive: true,
        config: {
          site: resources[0] || null,
          site_url: resources[0]?.url || null,
          site_name: resources[0]?.name || null,
          scope: tokens.scope
        }
      }
    });
    
    console.log('✅ JIRA 연동 저장 완료');
    
    // Frontend의 JiraSuccess 페이지로 리다이렉트
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
    const successUrl = `${frontendUrl}/jira-success?user=${encodeURIComponent(resources[0]?.name || 'JIRA User')}`;
    
    console.log('🎯 JIRA 연동 성공, Frontend로 리다이렉트:', successUrl);
    return res.redirect(successUrl);
    
  } catch (error) {
    console.error('❌ JIRA OAuth 콜백 처리 오류:', error);
    res.status(500).json({ error: 'OAuth callback processing failed' });
  }
});

// JIRA OAuth 시작
app.get('/auth/jira/:tenantSlug', async (req, res) => {
  try {
    const { tenantSlug } = req.params;
    const { userId } = req.query;
    
    if (!userId) {
      console.error('❌ userId 파라미터가 누락됨. Slack 앱에서 버튼을 통해 접근해야 합니다.');
      return res.send(`
        <html>
          <head>
            <title>JIRA 연동 - 접근 오류</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
              .error { color: #dc3545; font-size: 24px; margin-bottom: 20px; }
              .info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
              code { background: #e9ecef; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
            </style>
          </head>
          <body>
            <div class="error">⚠️ 잘못된 접근입니다</div>
            <div class="info">
              <h3>JIRA 연동 방법</h3>
              <p>이 페이지는 Slack 앱의 연동 버튼을 통해서만 접근할 수 있습니다.</p>
              <p>Slack에서 <code>/tk start</code> 명령어를 사용하여 연동을 시작해주세요.</p>
            </div>
            <p>올바른 경로로 다시 시도해주세요.</p>
          </body>
        </html>
      `);
    }
    
    // tenantSlug에서 실제 tenant 찾기
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug }
    });
    
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    const stateData = {
      tenantId: tenant.id,
      userId: userId as string,
      timestamp: Date.now()
    };
    
    const encodedState = Buffer.from(JSON.stringify(stateData)).toString('base64');
    
    // JIRA OAuth 2.0 (3LO) URL
    const authUrl = `https://auth.atlassian.com/authorize?` +
      `audience=api.atlassian.com&` +
      `client_id=${process.env.JIRA_CLIENT_ID || 'YOUR_JIRA_CLIENT_ID'}&` +
      `scope=read%3Ajira-user%20read%3Ajira-work%20write%3Ajira-work%20manage%3Ajira-project%20manage%3Ajira-configuration%20offline_access&` +
      `redirect_uri=${encodeURIComponent(process.env.APP_URL + '/auth/jira/callback')}&` +
      `state=${encodedState}&` +
      `response_type=code&` +
      `prompt=consent`;
      
    console.log('🔗 JIRA OAuth 시작:', {
      tenantSlug,
      userId,
      authUrl: authUrl.substring(0, 100) + '...'
    });
    
    return res.redirect(authUrl);
  } catch (error) {
    console.error('❌ JIRA OAuth 시작 오류:', error);
    return res.status(500).json({ error: 'OAuth initialization failed' });
  }
});

// JIRA OAuth 콜백 (중복 제거됨 - 위의 구현 사용)


// ===== 프론트엔드 API 엔드포인트 (기존 OAuth 엔드포인트들 뒤에 추가) =====

// 대시보드 통계 API (인증 필요)
app.get('/api/dashboard/stats', 
  authenticateUser,
  async (req, res) => {
    try {
      const tenantId = req.user?.tenantId;
      
      if (!tenantId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      // 기본 통계 조회
      const [totalMeetings, totalTasks, completedTasks] = await Promise.all([
        prisma.slackInput.count({ where: { tenantId } }),
        prisma.task.count({ where: { tenantId } }),
        prisma.task.count({ where: { tenantId, status: 'DONE' } })
      ]);

      const inProgressTasks = await prisma.task.count({ 
        where: { tenantId, status: 'IN_PROGRESS' } 
      });
      
      const scheduledTasks = await prisma.task.count({ 
        where: { tenantId, status: 'TODO' } 
      });

      return res.json({
        totalMeetings,
        averageProcessingTime: 20, // 임시값
        accuracy: 95, // 임시값
        completedTasks,
        inProgressTasks,
        scheduledTasks
      });
    } catch (error) {
      console.error('Dashboard stats error:', error);
      return res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  }
);

// 최근 활동 조회 API (인증 필요)
app.get('/api/dashboard/recent-activities', 
  authenticateUser,
  async (req, res) => {
    try {
      const tenantId = req.user?.tenantId;
      
      if (!tenantId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const activities = await prisma.slackInput.findMany({
        where: { tenantId },
        include: {
          projects: {
            select: { id: true, title: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      return res.json(activities);
    } catch (error) {
      console.error('Recent activities error:', error);
      return res.status(500).json({ error: 'Failed to fetch recent activities' });
    }
  }
);

// 프로젝트 목록 조회 API (인증 필요)
app.get('/api/projects', 
  authenticateUser,
  async (req, res) => {
    try {
      const tenantId = req.user?.tenantId;
      
      if (!tenantId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      console.log('🔍 tenantId:', tenantId);
      
      // 1단계: 기본 프로젝트만 조회
      const basicProjects = await prisma.project.findMany({
        where: { tenantId }
      });
      console.log('📊 기본 프로젝트 수:', basicProjects.length);
      
      // 2단계: include 없이 tasks만 조회
      const projectsWithTasks = await prisma.project.findMany({
        where: { tenantId },
        include: {
          tasks: true
        }
      });
      console.log('📋 업무 포함 프로젝트:', projectsWithTasks.length);
      
      // 3단계: 전체 include로 조회
      const fullProjects = await prisma.project.findMany({
        where: { tenantId },
        include: {
          tasks: {
            include: {
              assignee: { select: { id: true, name: true, email: true } },
              metadata: true
            },
            orderBy: { taskNumber: 'asc' }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      console.log('🎯 전체 include 프로젝트:', fullProjects.length);
      
      return res.json(fullProjects);

    } catch (error) {
      console.error('❌ Projects fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch projects' });
    }
  }
);

// 프로젝트 상세 조회 API (인증 필요)
app.get('/api/projects/:id', 
  authenticateUser,
  async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      
      if (!tenantId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const project = await prisma.project.findFirst({
        where: { id: id!, tenantId },
        include: {
          slackInput: true,
          tasks: {
            include: {
              assignee: {
                select: { id: true, name: true, email: true }
              },
              metadata: true
            },
            orderBy: { taskNumber: 'asc' }
          }
        }
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      return res.json(project);
    } catch (error) {
      console.error('Project fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch project' });
    }
  }
);

// 현재 사용자 정보 조회 API
app.get('/api/user/me', 
  authenticateUser,
  async (req, res) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      // 데이터베이스에서 최신 사용자 정보 조회
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          slackUserId: true,
          role: true,
          tenantId: true
        }
      });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // avatar 필드 추가 (이니셜 기반 기본 아바타)
      const userWithAvatar = {
        ...user,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || '')}&background=0D8ABC&color=fff`
      };
      
      console.log('✅ 사용자 정보 조회:', userWithAvatar);
      return res.json(userWithAvatar);
    } catch (error) {
      console.error('User fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch user information' });
    }
  }
);

// 업무 목록 조회 API (인증 필요)
app.get('/api/tasks', 
  authenticateUser,
  async (req, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id; // 로그인한 사용자 ID
      
      if (!tenantId || !userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const { status, assigneeId, priority } = req.query;
      
      // 로그인한 사용자와 관련된 작업만 필터링
      const where: any = {
        tenantId,
        OR: [
          { assigneeId: userId },        // 나에게 할당된 작업
          { assigneeId: null }            // 미할당 작업
        ]
      };
      
      if (status) where.status = status;
      if (assigneeId) where.assigneeId = assigneeId;
      if (priority) where.priority = priority;

      const tasks = await prisma.task.findMany({
        where,
        include: {
          assignee: {
            select: { id: true, name: true, email: true }
          },
          metadata: {
            select: {
              estimatedHours: true,
              actualHours: true,
              requiredSkills: true,
              taskType: true,
              jiraIssueKey: true
            }
          },
          children: {
            include: {
              assignee: {
                select: { id: true, name: true, email: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      console.log(`📋 사용자 ${userId}의 작업 ${tasks.length}개 조회됨`);
      return res.json(tasks);
    } catch (error) {
      console.error('Tasks fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  }
);

// 업무 상세 조회 API (인증 필요)
app.get('/api/tasks/:id', 
  authenticateUser,
  async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      
      if (!tenantId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const task = await prisma.task.findFirst({
        where: { id: id!, tenantId },
        include: {
          assignee: {
            select: { id: true, name: true, email: true }
          },
          metadata: true,
          children: {
            include: {
              assignee: {
                select: { id: true, name: true, email: true }
              }
            }
          },
          parent: {
            select: { id: true, title: true, taskNumber: true }
          }
        }
      });

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      return res.json(task);
    } catch (error) {
      console.error('Task fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch task' });
    }
  }
);

// 업무 상태 업데이트 API (인증 필요)
app.patch('/api/tasks/:id/status', 
  authenticateUser,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const tenantId = req.user?.tenantId;
      
      if (!tenantId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const task = await prisma.task.updateMany({
        where: { id: id!, tenantId },
        data: { status }
      });

      if (task.count === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      return res.json({ success: true, message: 'Task status updated' });
    } catch (error) {
      console.error('Task status update error:', error);
      return res.status(500).json({ error: 'Failed to update task status' });
    }
  }
);

// 업무 배정 API (인증 필요)
app.patch('/api/tasks/:id/assign', 
  authenticateUser,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { assigneeId } = req.body;
      const tenantId = req.user?.tenantId;
      
      if (!tenantId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const task = await prisma.task.updateMany({
        where: { id: id!, tenantId },
        data: { assigneeId }
      });

      if (task.count === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      return res.json({ success: true, message: 'Task assigned successfully' });
    } catch (error) {
      console.error('Task assignment error:', error);
      return res.status(500).json({ error: 'Failed to assign task' });
    }
  }
);

// 업무 생성 API (인증 필요)
app.post('/api/tasks',
  authenticateUser,
  async (req, res) => {
    try {
      console.log('📝 POST /api/tasks 요청 받음');
      console.log('📦 요청 본문:', req.body);
      
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id;
      
      console.log('👤 사용자 정보:', { tenantId, userId });
      
      if (!tenantId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const { 
        title, 
        description, 
        status = 'TODO', 
        priority = 'MEDIUM',
        dueDate,
        assigneeId
      } = req.body;
      
      let { projectId } = req.body;

      // 프로젝트 ID가 없거나 잘못된 경우 기본 프로젝트 사용
      console.log('🔍 프로젝트 ID 확인:', { projectId, tenantId });
      
      if (!projectId) {
        console.log('📁 프로젝트 ID가 없음, 기본 프로젝트 찾기...');
        // 기본 프로젝트 찾기 또는 생성
        let defaultProject = await prisma.project.findFirst({
          where: { tenantId },
          orderBy: { createdAt: 'asc' }
        });
        
        if (!defaultProject) {
          console.log('🆕 기본 프로젝트가 없음, 새로 생성...');
          // SlackInput 생성 (프로젝트 생성에 필요)
          const slackInput = await prisma.slackInput.create({
            data: {
              tenantId,
              slackChannelId: 'C000000',
              slackUserId: req.user?.slackUserId || 'U000000',
              inputType: 'TEXT',
              content: '기본 프로젝트',
              status: 'COMPLETED'
            }
          });
          
          console.log('✅ SlackInput 생성 완료:', slackInput.id);
          
          // 기본 프로젝트 생성
          defaultProject = await prisma.project.create({
            data: {
              tenantId,
              slackInputId: slackInput.id,
              title: '기본 프로젝트',
              overview: '자동 생성된 기본 프로젝트입니다',
              content: {}
            }
          });
          console.log('✅ 기본 프로젝트 생성 완료:', defaultProject.id);
        }
        
        projectId = defaultProject.id;
        console.log('📌 사용할 프로젝트 ID:', projectId);
      } else {
        // 프로젝트 존재 확인
        const project = await prisma.project.findFirst({
          where: { id: projectId, tenantId }
        });

        if (!project) {
          // 프로젝트가 없으면 기본 프로젝트 사용
          const defaultProject = await prisma.project.findFirst({
            where: { tenantId },
            orderBy: { createdAt: 'asc' }
          });
          
          if (defaultProject) {
            projectId = defaultProject.id;
          } else {
            return res.status(404).json({ error: 'Project not found' });
          }
        }
      }

      // 태스크 번호 생성
      const taskCount = await prisma.task.count({
        where: { tenantId }
      });
      const taskNumber = `TASK-${taskCount + 1}`;

      // 새 업무 생성
      console.log('🔨 업무 생성 시작:', { 
        title, 
        projectId, 
        taskNumber,
        status,
        priority,
        assigneeId 
      });
      
      const newTask = await prisma.task.create({
        data: {
          tenantId,
          projectId,
          title,
          description,
          status,
          priority,
          dueDate: dueDate ? new Date(dueDate) : null,
          assigneeId: assigneeId || null,
          taskNumber
        },
        include: {
          assignee: true,
          project: true,
          metadata: true
        }
      });

      console.log('✅ 업무 생성 완료:', {
        id: newTask.id,
        title: newTask.title,
        taskNumber: newTask.taskNumber,
        projectId: newTask.projectId
      });

      return res.status(201).json(newTask);
    } catch (error) {
      console.error('❌ Task creation error:', error);
      return res.status(500).json({ 
        error: 'Failed to create task',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// 업무 수정 API
app.patch('/api/tasks/:id',
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const { 
        title, 
        description, 
        status, 
        priority,
        dueDate,
        assigneeId
      } = req.body;

      // 업무 존재 확인
      const existingTask = await prisma.task.findFirst({
        where: { 
          id: id as string, 
          tenantId 
        }
      });

      if (!existingTask) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // 업무 수정
      const updatedTask = await prisma.task.update({
        where: { id: id as string },
        data: {
          title: title ?? existingTask.title,
          description: description !== undefined ? description : existingTask.description,
          status: status ?? existingTask.status,
          priority: priority ?? existingTask.priority,
          dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : existingTask.dueDate,
          assigneeId: assigneeId !== undefined ? assigneeId : existingTask.assigneeId,
          completedAt: status === 'DONE' ? new Date() : null
        },
        include: {
          assignee: true,
          project: true,
          metadata: true
        }
      });

      return res.json(updatedTask);
    } catch (error) {
      console.error('Task update error:', error);
      return res.status(500).json({ error: 'Failed to update task' });
    }
  }
);

// 업무 삭제 API
app.delete('/api/tasks/:id',
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;

      // 업무 존재 확인
      const existingTask = await prisma.task.findFirst({
        where: { 
          id: id as string, 
          tenantId 
        }
      });

      if (!existingTask) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // 하위 태스크가 있는지 확인
      const childTasks = await prisma.task.count({
        where: { 
          parentId: id as string, 
          tenantId 
        }
      });

      if (childTasks > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete task with subtasks. Please delete subtasks first.' 
        });
      }

      // 업무 삭제
      await prisma.task.delete({
        where: { id: id as string }
      });

      return res.status(204).send();
    } catch (error) {
      console.error('Task deletion error:', error);
      return res.status(500).json({ error: 'Failed to delete task' });
    }
  }
);

// 사용자 목록 조회 API
app.get('/api/users', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      
      const users = await prisma.user.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          skills: true,
          availableHours: true,
          experienceLevel: true
        },
        orderBy: { name: 'asc' }
      });

      return res.json(users);
    } catch (error) {
      console.error('Users fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
);

// 사용자 생성 API
app.post('/api/users',
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const { name, email, role = 'MEMBER', skills = [], availableHours = 40, experienceLevel = 'junior' } = req.body;

      // 필수 필드 검증
      if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
      }

      // 이메일 중복 검사
      const existingUser = await prisma.user.findFirst({
        where: { tenantId, email }
      });

      if (existingUser) {
        return res.status(409).json({ error: 'User with this email already exists' });
      }

      // 새 사용자 생성
      const newUser = await prisma.user.create({
        data: {
          tenantId,
          name,
          email,
          role,
          skills,
          availableHours,
          experienceLevel
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          skills: true,
          availableHours: true,
          experienceLevel: true
        }
      });

      console.log(`✅ 새 사용자 생성됨: ${name} (${email}) - Tenant: ${tenantId}`);
      
      return res.status(201).json(newUser);
    } catch (error) {
      console.error('User creation error:', error);
      return res.status(500).json({ error: 'Failed to create user' });
    }
  }
);

// 사용자 수정 API
app.patch('/api/users/:id',
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const { name, email, role, skills, availableHours, experienceLevel } = req.body;

      // 사용자 존재 확인
      const existingUser = await prisma.user.findFirst({
        where: { id: id as string, tenantId }
      });

      if (!existingUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // 이메일 중복 검사 (다른 사용자와의 중복)
      if (email && email !== existingUser.email) {
        const emailExists = await prisma.user.findFirst({
          where: { 
            tenantId, 
            email, 
            id: { not: id as string } 
          }
        });

        if (emailExists) {
          return res.status(409).json({ error: 'Email already exists' });
        }
      }

      // 사용자 정보 업데이트
      const updatedUser = await prisma.user.update({
        where: { id: id as string },
        data: {
          name: name ?? existingUser.name,
          email: email ?? existingUser.email,
          role: role ?? existingUser.role,
          skills: skills ?? existingUser.skills,
          availableHours: availableHours ?? existingUser.availableHours,
          experienceLevel: experienceLevel ?? existingUser.experienceLevel
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          skills: true,
          availableHours: true,
          experienceLevel: true
        }
      });

      console.log(`✅ 사용자 정보 업데이트됨: ${updatedUser.name} - Tenant: ${tenantId}`);
      
      return res.json(updatedUser);
    } catch (error) {
      console.error('User update error:', error);
      return res.status(500).json({ error: 'Failed to update user' });
    }
  }
);

// 사용자 삭제 API
app.delete('/api/users/:id',
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;

      // 사용자 존재 확인
      const existingUser = await prisma.user.findFirst({
        where: { id: id as string, tenantId }
      });

      if (!existingUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // 할당된 작업이 있는지 확인
      const assignedTasks = await prisma.task.count({
        where: { assigneeId: id as string, tenantId }
      });

      if (assignedTasks > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete user with assigned tasks. Please reassign tasks first.',
          assignedTasksCount: assignedTasks
        });
      }

      // 사용자 삭제
      await prisma.user.delete({
        where: { id: id as string }
      });

      console.log(`✅ 사용자 삭제됨: ${existingUser.name} - Tenant: ${tenantId}`);
      
      return res.status(204).send();
    } catch (error) {
      console.error('User deletion error:', error);
      return res.status(500).json({ error: 'Failed to delete user' });
    }
  }
);

// 현재 사용자 정보 조회 API
app.get('/api/users/me', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      
      // 임시로 첫 번째 사용자 반환 (실제로는 JWT에서 사용자 ID 추출)
      const user = await prisma.user.findFirst({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          skills: true,
          availableHours: true,
          experienceLevel: true
        }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json(user);
    } catch (error) {
      console.error('Current user fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch current user' });
    }
  }
);

// Slack 입력 기록 조회 API
app.get('/api/slack/inputs', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      
      const inputs = await prisma.slackInput.findMany({
        where: { tenantId },
        include: {
          projects: {
            select: { id: true, title: true, overview: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json(inputs);
    } catch (error) {
      console.error('Slack inputs fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch slack inputs' });
    }
  }
);

// 연동 상태 조회 API
app.get('/api/integrations/status', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      
      const integrations = await prisma.integration.findMany({
        where: { tenantId, isActive: true },
        select: { serviceType: true }
      });

      const status = {
        slack: integrations.some((i: any) => i.serviceType === 'SLACK'),
        notion: integrations.some((i: any) => i.serviceType === 'NOTION'),
        jira: integrations.some((i: any) => i.serviceType === 'JIRA')
      };

      return res.json(status);
    } catch (error) {
      console.error('Integration status error:', error);
      return res.status(500).json({ 
        slack: false, 
        notion: false, 
        jira: false 
      });
    }
  }
);

// 연동 해지 API
app.delete('/api/integrations/:service',
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { service } = req.params;
      const tenantId = req.tenantId!;

      // 서비스 파라미터 검증
      if (!service) {
        return res.status(400).json({ error: 'Service parameter is required' });
      }

      // 서비스 타입 검증
      const serviceType = service.toUpperCase();
      if (!['SLACK', 'NOTION', 'JIRA'].includes(serviceType)) {
        return res.status(400).json({ error: 'Invalid service type' });
      }

      // 해당 서비스의 모든 연동 비활성화
      const result = await prisma.integration.updateMany({
        where: {
          tenantId,
          serviceType: serviceType as 'SLACK' | 'NOTION' | 'JIRA',
          isActive: true
        },
        data: {
          isActive: false
        }
      });

      if (result.count === 0) {
        return res.status(404).json({ 
          error: 'No active integration found for this service' 
        });
      }

      console.log(`✅ ${serviceType} 연동 해지됨 (Tenant: ${tenantId})`);
      
      return res.json({ 
        success: true, 
        message: `${service} integration has been disconnected`,
        disconnectedCount: result.count
      });

    } catch (error) {
      console.error('Integration disconnection error:', error);
      return res.status(500).json({ 
        error: 'Failed to disconnect integration' 
      });
    }
  }
);

// OAuth 인증 라우트들
// Slack OAuth 시작 (로그인 버튼 클릭 시)
app.get('/api/auth/slack', (req: Request, res: Response) => {
  const slackClientId = process.env.SLACK_CLIENT_ID || '9123205664802.9178095689748';
  const redirectUri = process.env.SLACK_REDIRECT_URI || 'https://fecf095abfcc.ngrok-free.app/auth/slack/callback';
  
  console.log('🔍 환경변수 SLACK_REDIRECT_URI:', process.env.SLACK_REDIRECT_URI);
  console.log('🔍 사용할 redirectUri:', redirectUri);
  
  // Sign in with Slack - OpenID Connect 사용
  // team 파라미터를 추가하거나 OAuth v2를 사용
  const useOAuthV2 = true; // OpenID 대신 OAuth v2 사용
  
  const slackAuthUrl = useOAuthV2 
    ? `https://slack.com/oauth/v2/authorize?` +
      `client_id=${slackClientId}&` +
      `scope=users:read,users:read.email&` +  // 기본 사용자 정보만
      `redirect_uri=${encodeURIComponent(redirectUri)}`
    : `https://slack.com/openid/connect/authorize?` +
      `response_type=code&` +
      `client_id=${slackClientId}&` +
      `scope=openid%20profile%20email&` +  // OpenID Connect scopes
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `nonce=${Date.now()}`;
  
  console.log('🔐 Slack 로그인 시작 (Sign in with Slack):', slackAuthUrl);
  res.redirect(slackAuthUrl);
});

// Slack 앱 설치 (OAuth + 채널 초대) - Go to Market 버튼
app.get('/api/auth/slack/install', (req: Request, res: Response) => {
  const slackClientId = process.env.SLACK_CLIENT_ID || '9123205664802.9178095689748';
  const redirectUri = process.env.SLACK_REDIRECT_URI || 'https://fecf095abfcc.ngrok-free.app/auth/slack/callback';
  
  // Slack OAuth URL에 채널 초대 권한 추가
  const scopes = [
    'channels:read',
    'channels:join',
    'chat:write',
    'files:read',
    'users:read',
    'users:read.email',
    'app_mentions:read',
    'commands',
    'incoming-webhook'
  ].join(',');
  
  const slackAuthUrl = `https://slack.com/oauth/v2/authorize?` +
    `client_id=${slackClientId}&` +
    `scope=${scopes}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code`;
  
  console.log('🚀 Slack 앱 설치 시작:', slackAuthUrl);
  res.redirect(slackAuthUrl);
});

// 세션 체크 API - Dashboard 접근 시
app.get('/api/auth/check-session', (req: Request, res: Response) => {
  // JWT 토큰 확인
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1] || req.query.token as string;
  
  if (!token) {
    return res.json({ 
      authenticated: false,
      redirectTo: '/login'
    });
  }
  
  try {
    // JWT 토큰 검증 (실제로는 jsonwebtoken 사용)
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3 || !tokenParts[1]) {
      return res.json({ 
        authenticated: false,
        redirectTo: '/login'
      });
    }
    
    const decoded = JSON.parse(Buffer.from(tokenParts[1]!, 'base64').toString());
    
    if (decoded && decoded.exp > Date.now() / 1000) {
      return res.json({ 
        authenticated: true, 
        user: decoded,
        redirectTo: '/dashboard' 
      });
    } else {
      return res.json({ 
        authenticated: false,
        redirectTo: '/login'
      });
    }
  } catch (error) {
    console.error('⚠️ 세션 확인 실패:', error);
    return res.json({ 
      authenticated: false,
      redirectTo: '/login'
    });
  }
});

// Slack OAuth 콜백 처리 (실제 구현 - 활성화)
// 주의: 이 라우트는 /auth/slack/:tenant 보다 먼저 정의되어야 함
app.get('/auth/slack/callback', async (req: Request, res: Response) => {
  const { code, error } = req.query;
  
  console.log('🔍 OAuth 콜백 시작:', { code: code ? 'exists' : 'none', error });
  
  if (error) {
    console.error('❌ Slack OAuth 에러:', error);
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3002'}/login?error=slack_auth_failed`);
  }
  
  if (!code) {
    console.error('❌ Code가 없음');
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3002'}/login?error=no_code`);
  }
  
  try {
    console.log('📡 Slack 토큰 교환 시작...');
    console.log('📝 환경변수 확인:', {
      clientId: process.env.SLACK_CLIENT_ID ? '존재' : '없음',
      clientSecret: process.env.SLACK_CLIENT_SECRET ? '존재' : '없음',
      redirectUri: process.env.SLACK_REDIRECT_URI || 'https://fecf095abfcc.ngrok-free.app/auth/slack/callback'
    });
    
    // 테스트 모드: 실제 API 호출 대신 테스트 데이터 사용
    const USE_TEST_MODE = false;
    
    if (USE_TEST_MODE) {
      // 테스트 사용자 정보
      const testUser = {
        slackUserId: 'U123456',
        name: '테스트 사용자',
        email: 'test@example.com',
        avatar: '',
        teamId: 'T123456',
        teamName: 'Test Team'
      };
      
      // generateToken 함수 사용하여 제대로 된 JWT 토큰 생성
      const userForToken = {
        id: testUser.slackUserId,
        name: testUser.name,
        email: testUser.email,
        slackUserId: testUser.slackUserId,
        tenantId: 'default-tenant-id',
        role: 'MEMBER'
      };
      const userToken = generateToken(userForToken);
      
      console.log('🔑 생성된 토큰:', userToken);
      const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3002'}/login/success?token=${encodeURIComponent(userToken)}`;
      console.log('🔄 리다이렉트 URL:', redirectUrl);
      return res.redirect(redirectUrl);
    }
    
    // OAuth v2 토큰 교환 (OpenID 대신)
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID || '9123205664802.9178095689748',
        client_secret: process.env.SLACK_CLIENT_SECRET || '943bff5c993ed1609923e84b7a5e4365',
        code: code as string,
        redirect_uri: process.env.SLACK_REDIRECT_URI || 'https://fecf095abfcc.ngrok-free.app/auth/slack/callback'
      })
    });
    
    console.log('📡 토큰 응답 받음, 파싱 중...');
    const tokenData = await tokenResponse.json() as {
      ok: boolean;
      access_token?: string;
      authed_user?: {
        id: string;
        scope: string;
        access_token: string;
        token_type: string;
      };
      team?: {
        id: string;
        name: string;
      };
      error?: string;
    };
    
    console.log('✅ 토큰 데이터:', { ok: tokenData.ok, error: tokenData.error, hasUser: !!tokenData.authed_user });
    
    if (!tokenData.ok) {
      console.error('❌ Slack 토큰 교환 실패:', tokenData.error);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3002'}/login?error=token_exchange_failed`);
    }
    
    // OAuth v2 사용자 정보 가져오기
    const userResponse = await fetch('https://slack.com/api/users.info', {
      headers: {
        'Authorization': `Bearer ${tokenData.authed_user?.access_token || tokenData.access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      method: 'POST',
      body: new URLSearchParams({
        user: tokenData.authed_user?.id || ''
      })
    });
    
    const userData = await userResponse.json() as {
      ok: boolean;
      user?: {
        id: string;
        name: string;
        real_name: string;
        profile: {
          email: string;
          display_name: string;
          image_72: string;
        };
      };
      error?: string;
    };
    
    if (!userData.ok || !userData.user) {
      console.error('❌ Slack 사용자 정보 가져오기 실패:', userData.error);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3002'}/login?error=user_info_failed`);
    }
    
    // 사용자를 데이터베이스에 저장 또는 업데이트
    let tenant = await prisma.tenant.findFirst({
      where: { slug: 'default' }
    });
    
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          id: 'default-tenant-id',
          name: 'Default Tenant',
          slug: 'default'
        }
      });
    }
    
    // 사용자 찾기 또는 생성
    let user = await prisma.user.findFirst({
      where: { 
        slackUserId: userData.user.id 
      }
    });
    
    if (user) {
      // 기존 사용자 업데이트
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: userData.user.real_name || userData.user.name,
          email: userData.user.profile.email
        }
      });
    } else {
      // 새 사용자 생성
      user = await prisma.user.create({
        data: {
          id: `slack-${userData.user.id}`,
          slackUserId: userData.user.id,
          name: userData.user.real_name || userData.user.name,
          email: userData.user.profile.email,
          tenantId: tenant.id,
          role: 'MEMBER'
        }
      });
    }
    
    console.log('✅ 사용자 정보 저장 완료:', user);
    
    // JWT 토큰 생성
    const userToken = generateToken(user);
    
    // 채널에 앱 초대 (추가 기능)
    if (tokenData.access_token) {
      try {
        // 채널 목록 가져오기
        const channelsResponse = await fetch('https://slack.com/api/conversations.list', {
          headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
          method: 'GET'
        });
        
        const channelsData = await channelsResponse.json() as {
          ok: boolean;
          channels?: Array<{
            id: string;
            name: string;
          }>;
        };
        
        if (channelsData.ok && channelsData.channels && channelsData.channels.length > 0) {
          const firstChannel = channelsData.channels[0];
          
          if (firstChannel) {
            // 채널에 앱 초대
            await fetch('https://slack.com/api/conversations.join', {
              method: 'POST',
              headers: { 
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ channel: firstChannel.id })
            });
            
            console.log(`✅ TtalKkak 앱이 #${firstChannel.name} 채널에 초대되었습니다.`);
          }
        }
      } catch (channelError) {
        console.error('⚠️ 채널 초대 실패:', channelError);
      }
    }
    
    // Go to Market으로 접근한 경우 채널 초대 메시지 표시
    const isInstall = req.originalUrl.includes('/install');
    const message = isInstall ? '&install=true' : '';
    
    // 프론트엔드로 리다이렉트
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3002'}/login/success?token=${userToken}${message}`);
    
  } catch (error) {
    console.error('❌ Slack OAuth 처리 중 오류:', error);
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3002'}/login?error=oauth_error`);
  }
});

// Notion OAuth 인증
app.get('/auth/notion/:tenant', (req: Request, res: Response) => {
  const { tenant } = req.params;
  
  const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3002'}/integration?notion=connected&tenant=${tenant}`;
  res.redirect(redirectUrl);
});

// Jira OAuth 인증
app.get('/auth/jira/:tenant', (req, res) => {
  const { tenant } = req.params;
  
  const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3002'}/integration?jira=connected&tenant=${tenant}`;
  res.redirect(redirectUrl);
});

// 샘플 데이터 생성 API (개발용)
app.post('/api/dev/create-sample-data',
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;

      // 샘플 SlackInput 먼저 생성
      const sampleSlackInput = await prisma.slackInput.create({
        data: {
          tenantId,
          slackChannelId: 'C1234567890',
          slackUserId: 'U1234567890',
          inputType: 'TEXT',
          content: '웹 대시보드 개발 프로젝트를 시작하겠습니다.',
          status: 'COMPLETED'
        }
      });

      // 샘플 프로젝트 생성
      const sampleProject = await prisma.project.create({
        data: {
          title: '웹 대시보드 개발',
          overview: '사용자 친화적인 웹 대시보드 구축 프로젝트',
          content: {
            summary: '프로젝트 진행상황 및 이슈 논의',
            actionItems: [
              { title: 'UI 개선안 마무리', assignee: '김미정', dueDate: '2025-01-22' },
              { title: 'API 문서화 완료', assignee: '이준호', dueDate: '2025-01-20' },
            ]
          },
          tenantId,
          slackInputId: sampleSlackInput.id,
          notionPageUrl: 'https://notion.so/sample-project'
        }
      });

      // 샘플 태스크들 생성
      const sampleTasks = [
        {
          title: 'UI 디자인 시스템 구축',
          description: '컴포넌트 라이브러리 및 디자인 가이드라인 작성',
          status: 'IN_PROGRESS' as const,
          priority: 'HIGH' as const,
          dueDate: new Date('2025-02-15'),
          taskNumber: 'WD-001',
          projectId: sampleProject.id,
          tenantId
        },
        {
          title: 'API 엔드포인트 개발',
          description: 'RESTful API 설계 및 구현',
          status: 'TODO' as const,
          priority: 'MEDIUM' as const,
          dueDate: new Date('2025-02-20'),
          taskNumber: 'WD-002',
          projectId: sampleProject.id,
          tenantId
        },
        {
          title: '사용자 인증 시스템',
          description: 'JWT 기반 로그인/로그아웃 기능',
          status: 'DONE' as const,
          priority: 'HIGH' as const,
          dueDate: new Date('2025-01-10'),
          taskNumber: 'WD-003',
          projectId: sampleProject.id,
          tenantId
        }
      ];

      await prisma.task.createMany({
        data: sampleTasks
      });

      console.log(`✅ 샘플 데이터 생성됨 - Tenant: ${tenantId}`);
      
      return res.json({ 
        success: true, 
        message: 'Sample data created successfully',
        data: {
          project: sampleProject,
          tasksCount: sampleTasks.length
        }
      });

    } catch (error) {
      console.error('Sample data creation error:', error);
      return res.status(500).json({ error: 'Failed to create sample data' });
    }
  }
);

// Slack 음성 처리 API (프론트엔드용)
app.post('/api/slack/process-audio', 
  tenantMiddleware.createDevTenant,
  upload.single('audio'), 
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: 'No audio file provided' 
        });
      }

      // 기존 전체 파이프라인 로직 재사용
      const result = {
        success: true,
        message: '음성 파일이 성공적으로 처리되었습니다.',
        projectId: 'temp-project-id' // 실제로는 생성된 프로젝트 ID
      };

      return res.json(result);
    } catch (error) {
      console.error('Audio processing error:', error);
      return res.status(500).json({ 
        success: false, 
        message: '음성 처리 중 오류가 발생했습니다.' 
      });
    }
  }
);





// AI 서버 상태 확인
app.get('/ai/health', async (req, res) => {
  try {
    const health = await aiService.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'AI server unreachable'
    });
  }
});

// 기본 라우트
app.get('/', (req, res) => {
  res.json({ 
    message: 'DdalKkak Backend API with AI',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    features: [
      'Multi-tenant architecture',
      'Slack integration',
      'AI-powered project planning (Qwen3)',
      'Voice/Text transcription (WhisperX)',
      'Task Master compatible tasks',
      'Notion auto-upload',
      'JIRA synchronization',
      'Real-time collaboration'
    ]
  });
});

// 데이터베이스 연결 테스트
app.get('/db-test', async (req, res) => {
  try {
    await prisma.$connect();
    const result = await prisma.$queryRaw`SELECT current_database(), current_user, version()`;
    res.json({ 
      status: 'success',
      database: result
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 개발용 테넌트 생성 및 테스트
app.post('/dev/setup-tenant', async (req, res) => {
  try {
    const tenant = await prisma.tenant.upsert({
      where: { slug: 'dev-tenant' },
      update: {},
      create: {
        name: 'Development Tenant',
        slug: 'dev-tenant'
      }
    });

    // 개발용 사용자 생성
    const user = await prisma.user.upsert({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: 'dev@example.com'
        }
      },
      update: {},
      create: {
        tenantId: tenant.id,
        email: 'dev@example.com',
        name: 'Development User',
        role: 'OWNER'
      }
    });

    res.json({ 
      status: 'success',
      tenant,
      user
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ===== 팀원 관리 API 엔드포인트 =====

// 팀원 기술 정보 수집 (프로젝트 시작 시)
app.post('/api/team/collect-skills', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const { teamMembers } = req.body;

      if (!teamMembers || !Array.isArray(teamMembers)) {
        return res.status(400).json({ error: 'Team members data required' });
      }

      const updatedUsers = [];
      for (const member of teamMembers) {
        const user = await prisma.user.upsert({
          where: {
            tenantId_email: {
              tenantId,
              email: member.email
            }
          },
          update: {
            name: member.name,
            skills: member.skills || [],
            availableHours: member.availableHours || 40,
            preferredTypes: member.preferredTypes || [],
            experienceLevel: member.experienceLevel || 'junior'
          },
          create: {
            tenantId,
            email: member.email,
            name: member.name,
            role: 'MEMBER',
            skills: member.skills || [],
            availableHours: member.availableHours || 40,
            preferredTypes: member.preferredTypes || [],
            experienceLevel: member.experienceLevel || 'junior'
          }
        });
        updatedUsers.push(user);
      }

      return res.json({
        success: true,
        message: `${updatedUsers.length}명의 팀원 정보가 업데이트되었습니다.`,
        users: updatedUsers
      });
    } catch (error) {
      console.error('Team skills collection error:', error);
      return res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

// 업무 배정 분석 API
app.get('/api/assignment/analysis/:taskId', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { taskId } = req.params;

      const assignmentLog = await prisma.taskAssignmentLog.findFirst({
        where: { taskId: taskId! },
        include: {
          task: {
            select: {
              title: true,
              assignee: {
                select: { name: true, email: true }
              }
            }
          },
          user: {
            select: { name: true, email: true }
          }
        },
        orderBy: { assignedAt: 'desc' }
      });

      if (!assignmentLog) {
        return res.status(404).json({ error: 'Assignment log not found' });
      }

      return res.json({
        success: true,
        assignment: assignmentLog
      });
    } catch (error) {
      console.error('Assignment analysis error:', error);
      return res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

// ===== AI 관련 API 엔드포인트 =====

// 음성 파일 전사만
app.post('/api/transcribe', 
  tenantMiddleware.createDevTenant,
  upload.single('audio'), 
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
      }

      console.log(`🎤 Processing audio file: ${req.file.originalname} (${req.file.size} bytes)`);

      const result = await aiService.transcribeAudio(req.file.buffer, req.file.originalname);

      return res.json(result);
    } catch (error) {
      console.error('Transcription error:', error);
      return res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

// 텍스트 분석만
app.post('/api/analyze', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { transcript } = req.body;

      if (!transcript) {
        return res.status(400).json({ error: 'No transcript provided' });
      }

      const result = await aiService.analyzeMeeting(transcript);

      return res.json(result);
    } catch (error) {
      console.error('Analysis error:', error);
      return res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

// Slack 입력 처리: 음성/텍스트 → 전사 → 분석 → 프로젝트 생성
app.post('/api/process-slack-input', 
  tenantMiddleware.createDevTenant,
  upload.single('audio'), 
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const { slackChannelId, slackUserId, content, inputType = 'TEXT' } = req.body;

      // Slack 입력 데이터 저장
      const slackInput = await prisma.slackInput.create({
        data: {
          tenantId,
          slackChannelId: slackChannelId || 'C1234567890',
          slackUserId: slackUserId || 'U1234567890',
          inputType: inputType as 'VOICE' | 'TEXT',
          content: content || 'Sample meeting content',
          status: 'RECEIVED'
        }
      });

      // 음성 파일이 있으면 전사 처리
      let transcription = null;
      if (req.file && inputType === 'VOICE') {
        console.log(`🎤 Processing voice input: ${req.file.originalname}`);
        slackInput.status = 'PROCESSING';
        await prisma.slackInput.update({
          where: { id: slackInput.id },
          data: { status: 'PROCESSING' }
        });

        const transcribeResult = await aiService.transcribeAudio(req.file.buffer, req.file.originalname);
        if (transcribeResult.success) {
          transcription = transcribeResult.transcription;
          await prisma.slackInput.update({
            where: { id: slackInput.id },
            data: { content: transcription?.full_text || content }
          });
        }
      }

      // AI 기획안 생성
      const finalContent = transcription?.full_text || content;
      const aiResult = await aiService.generateNotionProject(finalContent);

      if (!aiResult.success) {
        await prisma.slackInput.update({
          where: { id: slackInput.id },
          data: { status: 'FAILED' }
        });
        return res.status(500).json({
          success: false,
          error: `AI processing failed: ${aiResult.error}`
        });
      }

      // 프로젝트 생성
      const project = await prisma.project.create({
        data: {
          tenantId,
          slackInputId: slackInput.id,
          title: aiResult.notion_project?.title || 'AI Generated Project',
          overview: aiResult.notion_project?.overview || '',
          content: aiResult.notion_project || {},
          notionStatus: 'pending'
        }
      });

      // Slack 입력 완료 처리
      await prisma.slackInput.update({
        where: { id: slackInput.id },
        data: { status: 'COMPLETED' }
      });

      // Socket으로 실시간 알림
      io.to(`tenant:${req.tenant?.slug}`).emit('slack-input-processed', {
        slackInput,
        project,
        transcription,
        aiResult: aiResult.notion_project
      });

      return res.json({
        success: true,
        slackInput,
        project,
        transcription,
        aiResult: aiResult.notion_project
      });

    } catch (error) {
      console.error('Slack input processing error:', error);
      return res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

// 테넌트별 프로젝트 조회
app.get('/tenants/:slug/projects', tenantMiddleware.extractTenant, async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    
    const projects = await prisma.project.findMany({
      where: { tenantId },
      include: {
        slackInput: {
          select: {
            id: true,
            slackChannelId: true,
            slackUserId: true,
            inputType: true,
            status: true,
            createdAt: true
          }
        },
        tasks: {
          select: {
            id: true,
            taskNumber: true,
            title: true,
            status: true,
            priority: true,
            complexity: true,
            dueDate: true,
            assignee: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            metadata: {
              select: {
                estimatedHours: true,
                taskType: true,
                assignmentScore: true,
                jiraIssueKey: true,
                jiraStatus: true
              }
            }
          },
          orderBy: { taskNumber: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      status: 'success',
      tenant: req.tenant,
      projects
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ===== 2단계 AI 파이프라인 엔드포인트 =====

// 노션 프로젝트 생성
app.post('/api/generate-notion-project', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { transcript } = req.body;

      if (!transcript) {
        return res.status(400).json({ error: 'No transcript provided' });
      }

      const result = await aiService.generateNotionProject(transcript);

      return res.json(result);
    } catch (error) {
      console.error('Notion project generation error:', error);
      return res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

// Task Master PRD 생성
app.post('/api/generate-prd', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { notion_project } = req.body;

      if (!notion_project) {
        return res.status(400).json({ error: 'No notion project provided' });
      }

      const result = await aiService.generateTaskMasterPRD(notion_project);

      return res.json(result);
    } catch (error) {
      console.error('PRD generation error:', error);
      return res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

// 업무 생성
app.post('/api/generate-tasks', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { prd } = req.body;

      if (!prd) {
        return res.status(400).json({ error: 'No PRD provided' });
      }

      const result = await aiService.generateTasks(prd);

      return res.json(result);
    } catch (error) {
      console.error('Task generation error:', error);
      return res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

// 전체 파이프라인: Slack 입력 → 기획안 → PRD → 업무 생성 → Notion 업로드
app.post('/api/process-slack-full-pipeline', 
  tenantMiddleware.createDevTenant,
  upload.single('audio'), 
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const { slackChannelId, slackUserId, content, inputType = 'TEXT', userEmail } = req.body;

      console.log(`🚀 Processing full pipeline for Slack input`);

      // 사용자 찾기 또는 생성
      let user = await prisma.user.findUnique({
        where: {
          tenantId_email: {
            tenantId,
            email: userEmail || 'dev@example.com'
          }
        }
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            tenantId,
            email: userEmail || 'dev@example.com',
            name: (userEmail || 'dev@example.com').split('@')[0],
            role: 'MEMBER',
            skills: ['AI', 'Project Management']
          }
        });
      }

      // Slack 입력 저장
      const slackInput = await prisma.slackInput.create({
        data: {
          tenantId,
          slackChannelId: slackChannelId || 'C1234567890',
          slackUserId: slackUserId || 'U1234567890',
          inputType: inputType as 'VOICE' | 'TEXT',
          content: content || 'Sample project content',
          status: 'PROCESSING'
        }
      });

      // 음성 파일 처리
      let transcription = null;
      let finalContent = content;
      if (req.file && inputType === 'VOICE') {
        const transcribeResult = await aiService.transcribeAudio(req.file.buffer, req.file.originalname);
        if (transcribeResult.success) {
          transcription = transcribeResult.transcription;
          finalContent = transcription?.full_text || content;
          await prisma.slackInput.update({
            where: { id: slackInput.id },
            data: { content: finalContent }
          });
        }
      }

      // 2단계 AI 파이프라인 실행
      const aiResult = await aiService.processTwoStagePipeline(
        req.file?.buffer || Buffer.from(finalContent),
        req.file?.originalname || 'text-input.txt'
      );

      if (!aiResult.success) {
        await prisma.slackInput.update({
          where: { id: slackInput.id },
          data: { status: 'FAILED' }
        });
        return res.status(500).json({
          success: false,
          error: `AI processing failed: ${aiResult.error}`,
          step: aiResult.step
        });
      }

      // 프로젝트 생성
      const project = await prisma.project.create({
        data: {
          tenantId,
          slackInputId: slackInput.id,
          title: aiResult.notion_project?.title || 'AI Generated Project',
          overview: aiResult.notion_project?.overview || '',
          content: {
            notion_project: aiResult.notion_project,
            prd: aiResult.prd,
            generated_tasks: aiResult.tasks
          },
          notionStatus: 'pending'
        }
      });

      // Task Master 스타일로 업무 생성
      let tasks: any[] = [];
      if (aiResult.tasks && Array.isArray(aiResult.tasks)) {
        const taskCreationPromises = aiResult.tasks.map(async (taskItem: any, index: number) => {
          const taskNumber = taskItem.taskNumber || `${index + 1}`;
          const parentTaskNumber = taskNumber.includes('.') ? taskNumber.split('.')[0] : null;
          
          let parentTask = null;
          if (parentTaskNumber) {
            parentTask = await prisma.task.findFirst({
              where: { 
                tenantId, 
                projectId: project.id,
                taskNumber: parentTaskNumber
              }
            });
          }

          // 스마트 업무 배정 알고리즘 적용
          const task = {
            id: '',
            title: taskItem.title || 'Untitled Task',
            description: taskItem.description || '',
            complexity: taskItem.complexity || 'medium',
            estimatedHours: taskItem.estimated_hours || 0,
            priority: taskItem.priority === 'high' ? 'HIGH' : 
                     taskItem.priority === 'low' ? 'LOW' : 'MEDIUM',
            requiredSkills: taskItem.required_skills || [],
            taskType: taskItem.task_type || 'development'
          };

          // 최적 담당자 찾기
          const assignmentResult = await smartAssigner.assignBestUser(task, tenantId);
          const assigneeId = assignmentResult?.userId || user.id;

          const createdTask = await prisma.task.create({
            data: {
              tenantId,
              projectId: project.id,
              taskNumber,
              title: taskItem.title || 'Untitled Task',
              description: `${taskItem.description || ''}\n\n복잡도: ${taskItem.complexity || 'medium'}\n예상 시간: ${taskItem.estimated_hours || 0}시간\n\n수락 기준:\n${taskItem.acceptance_criteria?.join('\n') || ''}`,
              status: 'TODO',
              priority: taskItem.priority === 'high' ? 'HIGH' : 
                       taskItem.priority === 'low' ? 'LOW' : 'MEDIUM',
              assigneeId,
              parentId: parentTask?.id || null,
              complexity: taskItem.complexity || 'medium',
              metadata: {
                create: {
                  estimatedHours: taskItem.estimated_hours || 0,
                  requiredSkills: taskItem.required_skills || [],
                  taskType: taskItem.task_type || 'development',
                  assignmentScore: assignmentResult?.score || null,
                  assignmentReason: assignmentResult?.reason || null,
                  jiraStatus: 'pending'
                }
              }
            }
          });

          // 배정 로그 저장
          if (assignmentResult) {
            await smartAssigner.logAssignment(assignmentResult, createdTask.id);
          }

          return createdTask;
        });

        tasks = await Promise.all(taskCreationPromises);
      }

      // Slack 입력 완료 처리
      await prisma.slackInput.update({
        where: { id: slackInput.id },
        data: { status: 'COMPLETED' }
      });

      // Socket으로 실시간 알림
      io.to(`tenant:${req.tenant?.slug}`).emit('slack-pipeline-completed', {
        slackInput,
        project,
        tasks,
        transcription,
        notion_project: aiResult.notion_project,
        prd: aiResult.prd,
        generated_tasks: aiResult.tasks
      });

      return res.json({
        success: true,
        slackInput,
        project,
        tasks,
        transcription,
        notion_project: aiResult.notion_project,
        prd: aiResult.prd,
        generated_tasks: aiResult.tasks
      });

    } catch (error) {
      console.error('Full Slack pipeline processing error:', error);
      return res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

// ===== 지라 연동 엔드포인트 =====

// 지라 연결 상태 확인
app.get('/api/jira/status', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const userId: string = req.body.userId || 'dev-user'; // 임시 사용자 ID

      const status = await jiraService.checkJiraConnection(tenantId, userId);
      
      return res.json(status);
    } catch (error) {
      console.error('JIRA status check error:', error);
      return res.status(500).json({ 
        connected: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

// 단일 업무를 지라로 동기화
app.post('/api/jira/sync-task/:taskId', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { taskId } = req.params;
      const userId: string = req.body.userId || 'dev-user';

      const jiraKey = await jiraService.syncTaskToJira(taskId!, userId);
      
      return res.json({
        success: true,
        jiraKey,
        message: `Task synchronized to JIRA as ${jiraKey}`
      });
    } catch (error) {
      console.error('JIRA task sync error:', error);
      return res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

// 프로젝트의 모든 업무를 지라로 동기화
app.post('/api/jira/sync-project/:projectId', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const userId: string = req.body.userId || 'dev-user';

      const results = await jiraService.syncProjectTasksToJira(projectId!, userId);
      
      const successCount = results.filter((r: any) => r.success).length;
      const failureCount = results.filter((r: any) => !r.success).length;

      return res.json({
        success: true,
        results,
        summary: {
          total: results.length,
          succeeded: successCount,
          failed: failureCount
        }
      });
    } catch (error) {
      console.error('JIRA project sync error:', error);
      return res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

// 전체 파이프라인 + JIRA 자동 동기화
app.post('/api/process-slack-with-jira', 
  tenantMiddleware.createDevTenant,
  upload.single('audio'), 
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const { slackChannelId, slackUserId, content, inputType = 'TEXT', userEmail, autoSyncJira = true } = req.body;

      console.log(`🚀 Processing Slack input with JIRA sync`);

      // 사용자 찾기 또는 생성
      let user = await prisma.user.findUnique({
        where: {
          tenantId_email: {
            tenantId,
            email: userEmail || 'dev@example.com'
          }
        }
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            tenantId,
            email: userEmail || 'dev@example.com',
            name: (userEmail || 'dev@example.com').split('@')[0],
            role: 'MEMBER',
            skills: ['AI', 'Project Management']
          }
        });
      }

      // Slack 입력 저장
      const slackInput = await prisma.slackInput.create({
        data: {
          tenantId,
          slackChannelId: slackChannelId || 'C1234567890',
          slackUserId: slackUserId || 'U1234567890',
          inputType: inputType as 'VOICE' | 'TEXT',
          content: content || 'Sample project content',
          status: 'PROCESSING'
        }
      });

      // 음성 파일 처리
      let transcription = null;
      let finalContent = content;
      if (req.file && inputType === 'VOICE') {
        const transcribeResult = await aiService.transcribeAudio(req.file.buffer, req.file.originalname);
        if (transcribeResult.success) {
          transcription = transcribeResult.transcription;
          finalContent = transcription?.full_text || content;
          await prisma.slackInput.update({
            where: { id: slackInput.id },
            data: { content: finalContent }
          });
        }
      }

      // 2단계 AI 파이프라인 실행
      const aiResult = await aiService.processTwoStagePipeline(
        req.file?.buffer || Buffer.from(finalContent),
        req.file?.originalname || 'text-input.txt'
      );

      if (!aiResult.success) {
        await prisma.slackInput.update({
          where: { id: slackInput.id },
          data: { status: 'FAILED' }
        });
        return res.status(500).json({
          success: false,
          error: `AI processing failed: ${aiResult.error}`,
          step: aiResult.step
        });
      }

      // 프로젝트 생성
      const project = await prisma.project.create({
        data: {
          tenantId,
          slackInputId: slackInput.id,
          title: aiResult.notion_project?.title || 'AI Generated Project',
          overview: aiResult.notion_project?.overview || '',
          content: {
            notion_project: aiResult.notion_project,
            prd: aiResult.prd,
            generated_tasks: aiResult.tasks
          },
          notionStatus: 'pending'
        }
      });

      // Task Master 스타일로 업무 생성
      let tasks: any[] = [];
      if (aiResult.tasks && Array.isArray(aiResult.tasks)) {
        const taskCreationPromises = aiResult.tasks.map(async (taskItem: any, index: number) => {
          const taskNumber = taskItem.taskNumber || `${index + 1}`;
          const parentTaskNumber = taskNumber.includes('.') ? taskNumber.split('.')[0] : null;
          
          let parentTask = null;
          if (parentTaskNumber) {
            parentTask = await prisma.task.findFirst({
              where: { 
                tenantId, 
                projectId: project.id,
                taskNumber: parentTaskNumber
              }
            });
          }

          // 스마트 업무 배정 알고리즘 적용
          const task = {
            id: '',
            title: taskItem.title || 'Untitled Task',
            description: taskItem.description || '',
            complexity: taskItem.complexity || 'medium',
            estimatedHours: taskItem.estimated_hours || 0,
            priority: taskItem.priority === 'high' ? 'HIGH' : 
                     taskItem.priority === 'low' ? 'LOW' : 'MEDIUM',
            requiredSkills: taskItem.required_skills || [],
            taskType: taskItem.task_type || 'development'
          };

          // 최적 담당자 찾기
          const assignmentResult = await smartAssigner.assignBestUser(task, tenantId);
          const assigneeId = assignmentResult?.userId || user.id;

          const createdTask = await prisma.task.create({
            data: {
              tenantId,
              projectId: project.id,
              taskNumber,
              title: taskItem.title || 'Untitled Task',
              description: `${taskItem.description || ''}\n\n복잡도: ${taskItem.complexity || 'medium'}\n예상 시간: ${taskItem.estimated_hours || 0}시간\n\n수락 기준:\n${taskItem.acceptance_criteria?.join('\n') || ''}`,
              status: 'TODO',
              priority: taskItem.priority === 'high' ? 'HIGH' : 
                       taskItem.priority === 'low' ? 'LOW' : 'MEDIUM',
              assigneeId,
              parentId: parentTask?.id || null,
              complexity: taskItem.complexity || 'medium',
              metadata: {
                create: {
                  estimatedHours: taskItem.estimated_hours || 0,
                  requiredSkills: taskItem.required_skills || [],
                  taskType: taskItem.task_type || 'development',
                  assignmentScore: assignmentResult?.score || null,
                  assignmentReason: assignmentResult?.reason || null,
                  jiraStatus: 'pending'
                }
              }
            }
          });

          // 배정 로그 저장
          if (assignmentResult) {
            await smartAssigner.logAssignment(assignmentResult, createdTask.id);
          }

          return createdTask;
        });

        tasks = await Promise.all(taskCreationPromises);
      }

      // JIRA 자동 동기화
      let jiraResults = null;
      if (autoSyncJira && tasks.length > 0) {
        try {
          jiraResults = await jiraService.syncProjectTasksToJira(project.id, user.id || 'dev-user');
          console.log(`✅ JIRA sync completed: ${jiraResults.filter((r: any) => r.success).length}/${jiraResults.length} tasks`);
        } catch (error) {
          console.error('❌ JIRA sync failed:', error);
          jiraResults = { error: error instanceof Error ? error.message : 'JIRA sync failed' };
        }
      }

      // Slack 입력 완료 처리
      await prisma.slackInput.update({
        where: { id: slackInput.id },
        data: { status: 'COMPLETED' }
      });

      // Socket으로 실시간 알림
      io.to(`tenant:${req.tenant?.slug}`).emit('slack-pipeline-with-jira-completed', {
        slackInput,
        project,
        tasks,
        jiraResults,
        transcription,
        notion_project: aiResult.notion_project,
        prd: aiResult.prd,
        generated_tasks: aiResult.tasks
      });

      return res.json({
        success: true,
        slackInput,
        project,
        tasks,
        jiraResults,
        transcription,
        notion_project: aiResult.notion_project,
        prd: aiResult.prd,
        generated_tasks: aiResult.tasks
      });

    } catch (error) {
      console.error('Slack pipeline with JIRA processing error:', error);
      return res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

// Socket.IO 연결 처리
io.on('connection', (socket) => {
  console.log(`새로운 클라이언트 연결: ${socket.id}`);

  socket.on('join-tenant', (tenantSlug: string) => {
    socket.join(`tenant:${tenantSlug}`);
    console.log(`클라이언트 ${socket.id}가 테넌트 ${tenantSlug}에 참여`);
  });

  socket.on('disconnect', () => {
    console.log(`클라이언트 연결 해제: ${socket.id}`);
  });
});

// ===== Slack 연동 =====
// Slack URL Verification (Challenge) 처리
// 중복 라우트 제거 - 128번 줄에 이미 정의됨

// Slack 명령어 처리
// ExpressReceiver의 기본 라우트를 그대로 사용
if (slackApp && slackApp.receiver && slackApp.receiver.app) {
  app.use(slackApp.receiver.app);
  console.log('✅ Slack Express 앱 등록 완료');
} else {
  console.warn('⚠️ Slack 앱이 초기화되지 않아 라우터를 건너뜁니다.');
}

// Slack 디버깅 엔드포인트
app.get('/debug/slack', (req, res) => {
  const slackStatus = {
    botToken: process.env.SLACK_BOT_TOKEN ? '✅ 존재' : '❌ 없음',
    signingSecret: process.env.SLACK_SIGNING_SECRET ? '✅ 존재' : '❌ 없음',
    appUrl: process.env.APP_URL || '❌ 없음',
    slackHandlerLoaded: !!slackApp
  };
  
  res.json(slackStatus);
});

// 서버 시작
server.listen(PORT, HOST, () => {
  console.log('🚀 DdalKkak Backend Server with AI 시작됨');
  console.log(`📍 서버 주소: http://${HOST}:${PORT}`);
  console.log(`📊 헬스 체크: http://${HOST}:${PORT}/health`);
  console.log(`🤖 AI 헬스 체크: http://${HOST}:${PORT}/ai/health`);
  console.log(`🔧 개발 설정: http://${HOST}:${PORT}/dev/setup-tenant`);
  console.log(`🤖 Slack 웹훅: http://${HOST}:${PORT}/slack/events`);
  console.log(`🌍 환경: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 AI 서버: ${process.env.RUNPOD_AI_URL || 'http://localhost:8000'}`);
});

// 프로세스 종료 시 정리
process.on('SIGINT', async () => {
  console.log('\n🛑 서버 종료 중...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 서버 종료 중...');
  await prisma.$disconnect();
  process.exit(0);
});

//테스트 - 로그인한 사용자의 태스크만 반환
app.get('/tasks', async (req, res) => {
  try {
    console.log('📋 /tasks API 호출됨');
    
    // Authorization 헤더에서 토큰 추출
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    
    let userId = null;
    if (token) {
      try {
        const decoded = jsonwebtoken.verify(token, process.env.JWT_SECRET || 'ddalkkak_super_secret_jwt_key_production_2024') as any;
        userId = decoded.id;
        console.log('🔑 토큰에서 추출한 사용자 ID:', userId);
      } catch (err) {
        console.log('⚠️ 토큰 검증 실패, 전체 태스크 반환');
      }
    }
    
    // Prisma 연결 테스트
    await prisma.$connect();
    console.log('✅ DB 연결 성공');
    
    // 사용자 ID가 있으면 해당 사용자의 태스크만, 없으면 전체 태스크
    const whereClause = userId ? {
      OR: [
        { assigneeId: userId },        // 담당자인 태스크
        { assigneeId: null }           // 미할당 태스크도 포함
      ]
    } : {};
    
    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        assignee: {
          select: { id: true, name: true, email: true, role: true }
        },
        metadata: {
          select: {
            estimatedHours: true,
            actualHours: true,
            requiredSkills: true,
            taskType: true,
            jiraIssueKey: true
          }
        },
        children: {
          include: {
            assignee: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    console.log(`✅ ${tasks.length}개의 태스크 조회 성공 (사용자: ${userId || '전체'})`);
    res.json(tasks);
  } catch (error) {
    console.error('❌ /tasks API 오류 상세:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error
    });
    res.status(500).json({ 
      error: '서버 내부 오류', 
      detail: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : 'Unknown'
    });
  }
});

// 개발용 테스트 API - 유저 목록 (tenantId로 필터링)
app.get('/test/users', async (req, res) => {
  try {
    const { tenantId } = req.query;
    
    // tenantId가 제공되면 해당 tenant의 사용자만, 아니면 전체 (하위 호환성)
    const whereClause = tenantId ? { tenantId: tenantId as string } : {};
    
    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tenantId: true,
        skills: true,
        availableHours: true,
        experienceLevel: true
      }
    });
    console.log(`✅ ${users.length}개의 유저 조회 성공 (tenantId: ${tenantId || 'all'})`);
    res.json(users);
  } catch (error) {
    console.error('❌ /test/users API 오류:', error);
    res.status(500).json({ 
      error: '서버 내부 오류', 
      detail: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// 로그인 API
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        error: '이메일과 비밀번호를 입력해주세요.' 
      });
    }
    
    // 사용자 찾기
    const user = await prisma.user.findFirst({
      where: { email },
      include: {
        tenant: true
      }
    });
    
    if (!user) {
      // 개발 환경: 사용자가 없으면 자동 생성
      const defaultTenant = await prisma.tenant.findFirst({
        where: { slug: 'dev-tenant' }
      });
      
      if (!defaultTenant) {
        return res.status(401).json({ 
          error: '로그인 실패: 테넌트를 찾을 수 없습니다.' 
        });
      }
      
      // 새 사용자 생성
      const newUser = await prisma.user.create({
        data: {
          email,
          name: email.split('@')[0],
          tenantId: defaultTenant.id,
          role: 'MEMBER'
        },
        include: {
          tenant: true
        }
      });
      
      console.log(`✅ 새 사용자 생성: ${email}`);
      
      return res.json({
        success: true,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          tenantId: newUser.tenantId,
          tenantName: newUser.tenant.name
        },
        message: '새 계정이 생성되었습니다.'
      });
    }
    
    // 개발 환경: 비밀번호 검증 생략 (실제로는 bcrypt 등으로 검증 필요)
    console.log(`✅ 로그인 성공: ${email}`);
    
    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        tenantName: user.tenant.name
      }
    });
    
  } catch (error) {
    console.error('❌ 로그인 오류:', error);
    return res.status(500).json({ 
      error: '로그인 처리 중 오류가 발생했습니다.',
      detail: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 개발용 테스트 API - 대시보드 통계 (인증 없이)
app.get('/test/stats', async (req, res) => {
  try {
    const [totalTasks, todoTasks, inProgressTasks, doneTasks, totalUsers] = await Promise.all([
      prisma.task.count(),
      prisma.task.count({ where: { status: 'TODO' } }),
      prisma.task.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.task.count({ where: { status: 'DONE' } }),
      prisma.user.count()
    ]);
    
    const stats = {
      totalTasks,
      tasksByStatus: {
        todo: todoTasks,
        inProgress: inProgressTasks,
        done: doneTasks
      },
      totalUsers,
      activeProjects: 1,
      completionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
    };
    
    console.log('✅ 통계 조회 성공:', stats);
    res.json(stats);
  } catch (error) {
    console.error('❌ /test/stats API 오류:', error);
    res.status(500).json({ 
      error: '서버 내부 오류', 
      detail: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// restart trigger
