import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { SECURITY_CONFIG } from './config';
import { verifyJWT, verifyRefreshToken } from './jwt-manager';

// 内存存储（生产环境应使用Redis等外部存储）
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const csrfTokens = new Map<string, { expiresAt: number; userId: string }>();

// 生成CSRF令牌
export function generateCSRFToken(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(token, {
    userId,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24小时
  });
  return token;
}

// 验证CSRF令牌
export function verifyCSRFToken(token: string, userId: string): boolean {
  const tokenData = csrfTokens.get(token);
  if (!tokenData) {
    return false;
  }
  
  if (tokenData.userId !== userId) {
    return false;
  }
  
  if (Date.now() > tokenData.expiresAt) {
    csrfTokens.delete(token);
    return false;
  }
  
  return true;
}

// 清理过期的CSRF令牌
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of csrfTokens.entries()) {
    if (now > data.expiresAt) {
      csrfTokens.delete(token);
    }
  }
}, 60 * 60 * 1000); // 每小时清理一次

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
  if (now - attempts.lastAttempt > SECURITY_CONFIG.LOGIN_LOCKOUT_TIME) {
    loginAttempts.delete(identifier);
    return { canAttempt: true };
  }
  
  // 如果超过尝试次数限制
  if (attempts.count >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
    const lockoutTime = SECURITY_CONFIG.LOGIN_LOCKOUT_TIME - (now - attempts.lastAttempt);
    return { 
      canAttempt: false, 
      lockoutTime: Math.ceil(lockoutTime / 1000 / 60) // 返回分钟数
    };
  }
  
  return { 
    canAttempt: true, 
    remainingAttempts: SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS - attempts.count
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
  
  // 检查令牌类型
  if (decoded.type !== 'access') {
    return {
      isValid: false,
      error: '令牌类型错误',
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

// 验证刷新令牌的安全方法
export function secureVerifyRefreshToken(token: string): any {
  const decoded = verifyRefreshToken(token);
  
  if (!decoded) {
    return null;
  }
  
  return {
    userId: decoded.userId,
    phone: decoded.phone
  };
}


// 验证请求方法
export function validateRequestMethod(request: NextRequest, allowedMethods: string[]): boolean {
  return allowedMethods.includes(request.method);
}

// 验证内容类型
export function validateContentType(request: NextRequest, allowedTypes: string[]): boolean {
  const contentType = request.headers.get('content-type');
  if (!contentType) {
    return false;
  }
  
  return allowedTypes.some(type => contentType.includes(type));
}

// 检查请求大小
export function validateRequestSize(request: NextRequest, maxSizeBytes: number = 10 * 1024 * 1024): boolean {
  const contentLength = request.headers.get('content-length');
  if (!contentLength) {
    return true; // 如果没有content-length头，允许通过
  }
  
  const size = parseInt(contentLength);
  return size <= maxSizeBytes;
}

// 导出配置
export { SECURITY_CONFIG };