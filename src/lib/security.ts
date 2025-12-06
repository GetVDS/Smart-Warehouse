import { NextRequest } from 'next/server';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';

// 安全配置
const SECURITY_CONFIG = {
  // JWT配置
  JWT_SECRET: process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex'),
  JWT_EXPIRES_IN: '7d' as const,
  
  // 密码策略
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_REQUIRE_UPPERCASE: true,
  PASSWORD_REQUIRE_LOWERCASE: true,
  PASSWORD_REQUIRE_NUMBERS: true,
  PASSWORD_REQUIRE_SYMBOLS: false,
  
  // 速率限制
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15分钟
  RATE_LIMIT_MAX_REQUESTS: 100, // 每个窗口最多100个请求
  
  // 登录限制
  LOGIN_ATTEMPT_LIMIT: 5,
  LOGIN_LOCKOUT_TIME_MS: 15 * 60 * 1000, // 15分钟
  
  // 会话安全
  SESSION_TIMEOUT_MS: 7 * 24 * 60 * 60 * 1000, // 7天
  SECURE_COOKIES: process.env.NODE_ENV === 'production',
  
  // CORS配置
  ALLOWED_ORIGINS: process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [process.env.NEXTAUTH_URL || 'https://localhost:3000'])
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
};

// 内存存储（生产环境应使用Redis等外部存储）
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// 验证JWT令牌
export function verifyJWT(token: string): any {
  try {
    return jwt.verify(token, SECURITY_CONFIG.JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// 生成JWT令牌
export function generateJWT(payload: any): string {
  const options: SignOptions = {
    expiresIn: SECURITY_CONFIG.JWT_EXPIRES_IN,
  };
  return jwt.sign(payload, SECURITY_CONFIG.JWT_SECRET, options);
}

// 验证密码强度
export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < SECURITY_CONFIG.PASSWORD_MIN_LENGTH) {
    errors.push(`密码长度至少${SECURITY_CONFIG.PASSWORD_MIN_LENGTH}位`);
  }
  
  if (SECURITY_CONFIG.PASSWORD_REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('密码必须包含大写字母');
  }
  
  if (SECURITY_CONFIG.PASSWORD_REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('密码必须包含小写字母');
  }
  
  if (SECURITY_CONFIG.PASSWORD_REQUIRE_NUMBERS && !/\d/.test(password)) {
    errors.push('密码必须包含数字');
  }
  
  if (SECURITY_CONFIG.PASSWORD_REQUIRE_SYMBOLS && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('密码必须包含特殊字符');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// 检查登录尝试次数
export function checkLoginAttempts(identifier: string): { canAttempt: boolean; remainingAttempts?: number; lockoutTime?: number } {
  const now = Date.now();
  const attempts = loginAttempts.get(identifier);
  
  if (!attempts) {
    return { canAttempt: true };
  }
  
  // 如果超过锁定时间，重置计数
  if (now - attempts.lastAttempt > SECURITY_CONFIG.LOGIN_LOCKOUT_TIME_MS) {
    loginAttempts.delete(identifier);
    return { canAttempt: true };
  }
  
  // 如果超过尝试次数限制
  if (attempts.count >= SECURITY_CONFIG.LOGIN_ATTEMPT_LIMIT) {
    const lockoutTime = SECURITY_CONFIG.LOGIN_LOCKOUT_TIME_MS - (now - attempts.lastAttempt);
    return { 
      canAttempt: false, 
      lockoutTime: Math.ceil(lockoutTime / 1000 / 60) // 返回分钟数
    };
  }
  
  return { 
    canAttempt: true, 
    remainingAttempts: SECURITY_CONFIG.LOGIN_ATTEMPT_LIMIT - attempts.count 
  };
}

// 记录登录尝试
export function recordLoginAttempt(identifier: string, success: boolean): void {
  if (success) {
    loginAttempts.delete(identifier);
    return;
  }
  
  const now = Date.now();
  const attempts = loginAttempts.get(identifier);
  
  if (!attempts) {
    loginAttempts.set(identifier, { count: 1, lastAttempt: now });
  } else {
    loginAttempts.set(identifier, { 
      count: attempts.count + 1, 
      lastAttempt: now 
    });
  }
}

// 速率限制检查
export function checkRateLimit(identifier: string): { canProceed: boolean; resetTime?: number } {
  const now = Date.now();
  const key = `rate_limit_${identifier}`;
  const limit = rateLimitStore.get(key);
  
  if (!limit) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + SECURITY_CONFIG.RATE_LIMIT_WINDOW_MS
    });
    return { canProceed: true };
  }
  
  // 如果超过窗口时间，重置计数
  if (now > limit.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + SECURITY_CONFIG.RATE_LIMIT_WINDOW_MS
    });
    return { canProceed: true };
  }
  
  // 如果超过请求限制
  if (limit.count >= SECURITY_CONFIG.RATE_LIMIT_MAX_REQUESTS) {
    return { 
      canProceed: false, 
      resetTime: Math.ceil((limit.resetTime - now) / 1000 / 60) // 返回分钟数
    };
  }
  
  // 增加计数
  rateLimitStore.set(key, {
    count: limit.count + 1,
    resetTime: limit.resetTime
  });
  
  return { canProceed: true };
}

// 清理过期的速率限制记录
setInterval(() => {
  const now = Date.now();
  for (const [key, limit] of rateLimitStore.entries()) {
    if (now > limit.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000); // 每5分钟清理一次

// 验证请求来源
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  
  if (!origin && !referer) {
    return false; // 没有来源信息，可能是直接API调用
  }
  
  const checkOrigin = origin || referer;
  
  return SECURITY_CONFIG.ALLOWED_ORIGINS.some(allowedOrigin => 
    checkOrigin?.startsWith(allowedOrigin)
  );
}

// 安全的认证中间件
export async function secureAuth(request: NextRequest): Promise<{
  isValid: boolean;
  userId?: string;
  error?: string;
  statusCode?: number;
}> {
  // 验证请求来源
  if (!validateOrigin(request)) {
    return { 
      isValid: false, 
      error: '无效的请求来源', 
      statusCode: 403 
    };
  }
  
  // 检查速率限制
  const clientIP = request.headers.get('x-forwarded-for') ||
                   request.headers.get('x-real-ip') ||
                   'unknown';
  const rateLimitResult = checkRateLimit(clientIP);
  
  if (!rateLimitResult.canProceed) {
    return { 
      isValid: false, 
      error: `请求过于频繁，请在${rateLimitResult.resetTime}分钟后重试`, 
      statusCode: 429 
    };
  }
  
  // 验证JWT令牌
  const token = request.cookies.get('auth-token')?.value;
  
  if (!token) {
    return { 
      isValid: false, 
      error: '未提供认证令牌', 
      statusCode: 401 
    };
  }
  
  const decoded = verifyJWT(token);
  
  if (!decoded) {
    return { 
      isValid: false, 
      error: '认证令牌无效或已过期', 
      statusCode: 401 
    };
  }
  
  return { 
    isValid: true, 
    userId: decoded.userId 
  };
}

// 生成安全的随机字符串
export function generateSecureRandom(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

// 安全的哈希函数
export function secureHash(data: string, salt: string = ''): string {
  return crypto.createHash('sha256').update(data + salt).digest('hex');
}

// 验证数据完整性
export function verifyDataIntegrity(data: any, signature: string, secret: string): boolean {
  const expectedSignature = secureHash(JSON.stringify(data), secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

// 清理敏感数据
export function sanitizeData(data: any, removeFields: string[] = ['password', 'token', 'secret']): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const sanitized = { ...data };
  
  for (const field of removeFields) {
    delete sanitized[field];
  }
  
  return sanitized;
}

// 导出配置
export { SECURITY_CONFIG };