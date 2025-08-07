import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// JWT Secret (실제로는 환경변수 사용)
const JWT_SECRET = process.env.JWT_SECRET || 'ddalkkak_super_secret_jwt_key_production_2024';

// Request 타입 확장
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        slackUserId?: string;
        tenantId: string;
        role: string;
      };
      tenant?: {
        id: string;
        slug: string;
      };
    }
  }
}

// JWT 토큰 생성
export const generateToken = (user: any) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      slackUserId: user.slackUserId,
      tenantId: user.tenantId,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// JWT 토큰 검증 미들웨어
export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1] || req.query.token as string;
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: '로그인이 필요합니다.'
      });
    }
    
    // JWT 토큰 검증
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // DB에서 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: {
        id: decoded.id
      },
      include: {
        tenant: true
      }
    });
    
    if (!user) {
      return res.status(401).json({ 
        error: 'User not found',
        message: '사용자를 찾을 수 없습니다.'
      });
    }
    
    // Request에 사용자 정보 추가
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      slackUserId: user.slackUserId || undefined,
      tenantId: user.tenantId,
      role: user.role
    };
    
    req.tenant = {
      id: user.tenant.id,
      slug: user.tenant.slug
    };
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ 
        error: 'Token expired',
        message: '토큰이 만료되었습니다. 다시 로그인해주세요.'
      });
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: '유효하지 않은 토큰입니다.'
      });
    }
    
    console.error('Authentication error:', error);
    return res.status(500).json({ 
      error: 'Authentication failed',
      message: '인증 처리 중 오류가 발생했습니다.'
    });
  }
};

// Slack OAuth 후 사용자 생성 또는 업데이트
export const createOrUpdateUser = async (slackUserInfo: any) => {
  try {
    // 기본 테넌트 찾기 또는 생성
    let tenant = await prisma.tenant.findFirst({
      where: {
        slug: slackUserInfo.teamId || 'default'
      }
    });
    
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          name: slackUserInfo.teamName || 'Default Team',
          slug: slackUserInfo.teamId || 'default'
        }
      });
    }
    
    // 사용자 찾기 또는 생성
    const user = await prisma.user.upsert({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: slackUserInfo.email
        }
      },
      update: {
        name: slackUserInfo.name,
        slackUserId: slackUserInfo.slackUserId
      },
      create: {
        tenantId: tenant.id,
        email: slackUserInfo.email,
        name: slackUserInfo.name,
        slackUserId: slackUserInfo.slackUserId,
        role: 'MEMBER'
      }
    });
    
    return user;
  } catch (error) {
    console.error('Error creating/updating user:', error);
    throw error;
  }
};