import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { SECURITY_CONFIG } from './config';

// JWT令牌接口
export interface JWTPayload {
  userId: string;
  phone: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
  jti?: string; // JWT ID，用于令牌撤销
}

// 令牌对接口
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// 刷新令牌存储（生产环境应使用Redis）
const refreshTokens = new Map<string, { userId: string; expiresAt: number }>();

// 生成JWT ID
function generateJTI(): string {
  return crypto.randomBytes(16).toString('hex');
}

// 清理过期的刷新令牌
function cleanupExpiredTokens(): void {
  const now = Date.now();
  for (const [jti, token] of refreshTokens.entries()) {
    if (now > token.expiresAt) {
      refreshTokens.delete(jti);
    }
  }
}

// 定期清理过期令牌
setInterval(cleanupExpiredTokens, 5 * 60 * 1000); // 每5分钟清理一次

// 生成访问令牌
export function generateAccessToken(payload: Omit<JWTPayload, 'type' | 'jti'>): string {
  const jti = generateJTI();
  const fullPayload: JWTPayload = {
    ...payload,
    type: 'access',
    jti
  };

  const options: SignOptions = {
    expiresIn: SECURITY_CONFIG.JWT_EXPIRES_IN,
    issuer: SECURITY_CONFIG.NEXTAUTH_URL,
    audience: SECURITY_CONFIG.NEXTAUTH_URL,
  };

  return jwt.sign(fullPayload, SECURITY_CONFIG.JWT_SECRET, options);
}

// 生成刷新令牌
export function generateRefreshToken(payload: Omit<JWTPayload, 'type' | 'jti'>): string {
  const jti = generateJTI();
  const fullPayload: JWTPayload = {
    ...payload,
    type: 'refresh',
    jti
  };

  const options: SignOptions = {
    expiresIn: SECURITY_CONFIG.JWT_REFRESH_EXPIRES_IN,
    issuer: SECURITY_CONFIG.NEXTAUTH_URL,
    audience: SECURITY_CONFIG.NEXTAUTH_URL,
  };

  const refreshToken = jwt.sign(fullPayload, SECURITY_CONFIG.JWT_SECRET, options);
  
  // 存储刷新令牌信息
  const decoded = jwt.decode(refreshToken) as JWTPayload;
  if (decoded.exp) {
    refreshTokens.set(jti, {
      userId: payload.userId,
      expiresAt: decoded.exp * 1000 // 转换为毫秒
    });
  }

  return refreshToken;
}

// 生成令牌对
export function generateTokenPair(payload: Omit<JWTPayload, 'type' | 'jti'>): TokenPair {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  
  // 计算访问令牌过期时间（秒）
  const decoded = jwt.decode(accessToken) as JWTPayload;
  const expiresIn = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 3600;

  return {
    accessToken,
    refreshToken,
    expiresIn
  };
}

// 验证JWT令牌
export function verifyJWT(token: string): JWTPayload | null {
  try {
    const options: VerifyOptions = {
      issuer: SECURITY_CONFIG.NEXTAUTH_URL,
      audience: SECURITY_CONFIG.NEXTAUTH_URL,
    };

    const decoded = jwt.verify(token, SECURITY_CONFIG.JWT_SECRET, options) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.warn('JWT令牌已过期:', error.message);
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.warn('JWT令牌无效:', error.message);
    } else {
      console.error('JWT验证错误:', error);
    }
    return null;
  }
}

// 验证刷新令牌
export function verifyRefreshToken(token: string): JWTPayload | null {
  const decoded = verifyJWT(token);
  
  if (!decoded) {
    return null;
  }

  // 检查令牌类型
  if (decoded.type !== 'refresh') {
    console.warn('令牌类型错误，期望refresh令牌');
    return null;
  }

  // 检查令牌是否在存储中（未被撤销）
  if (decoded.jti && !refreshTokens.has(decoded.jti)) {
    console.warn('刷新令牌不存在或已被撤销');
    return null;
  }

  return decoded;
}

// 刷新访问令牌
export function refreshAccessToken(refreshToken: string): TokenPair | null {
  const decoded = verifyRefreshToken(refreshToken);
  
  if (!decoded) {
    return null;
  }

  // 撤销旧的刷新令牌
  if (decoded.jti) {
    refreshTokens.delete(decoded.jti);
  }

  // 生成新的令牌对
  const newPayload: Omit<JWTPayload, 'type' | 'jti'> = {
    userId: decoded.userId,
    phone: decoded.phone
  };

  return generateTokenPair(newPayload);
}

// 撤销刷新令牌
export function revokeRefreshToken(token: string): boolean {
  const decoded = verifyJWT(token);
  
  if (!decoded || !decoded.jti) {
    return false;
  }

  const deleted = refreshTokens.delete(decoded.jti);
  if (deleted) {
    console.log(`刷新令牌已撤销: ${decoded.jti}`);
  }
  
  return deleted;
}

// 撤销用户的所有刷新令牌
export function revokeAllUserTokens(userId: string): number {
  let revokedCount = 0;
  
  for (const [jti, token] of refreshTokens.entries()) {
    if (token.userId === userId) {
      refreshTokens.delete(jti);
      revokedCount++;
    }
  }
  
  if (revokedCount > 0) {
    console.log(`用户 ${userId} 的 ${revokedCount} 个刷新令牌已撤销`);
  }
  
  return revokedCount;
}

// 检查令牌是否即将过期（在指定分钟内）
export function isTokenExpiringSoon(token: string, minutesThreshold: number = 5): boolean {
  try {
    const decoded = jwt.decode(token) as JWTPayload;
    if (!decoded.exp) {
      return false;
    }
    
    const now = Math.floor(Date.now() / 1000);
    const threshold = minutesThreshold * 60;
    
    return (decoded.exp - now) <= threshold;
  } catch (error) {
    return true; // 如果无法解码，认为需要刷新
  }
}

// 获取令牌剩余有效时间（秒）
export function getTokenRemainingTime(token: string): number {
  try {
    const decoded = jwt.decode(token) as JWTPayload;
    if (!decoded.exp) {
      return 0;
    }
    
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, decoded.exp - now);
  } catch (error) {
    return 0;
  }
}

// 获取活跃刷新令牌数量
export function getActiveRefreshTokenCount(): number {
  cleanupExpiredTokens();
  return refreshTokens.size;
}

// 获取用户活跃刷新令牌数量
export function getUserActiveTokenCount(userId: string): number {
  let count = 0;
  for (const token of refreshTokens.values()) {
    if (token.userId === userId) {
      count++;
    }
  }
  return count;
}

// 验证令牌完整性（检查是否被篡改）
export function validateTokenIntegrity(token: string): boolean {
  try {
    // 尝试验证令牌
    const decoded = verifyJWT(token);
    if (!decoded) {
      return false;
    }
    
    // 检查必要字段
    const requiredFields = ['userId', 'phone', 'type', 'jti'];
    for (const field of requiredFields) {
      if (!(field in decoded)) {
        return false;
      }
    }
    
    // 检查令牌类型
    if (!['access', 'refresh'].includes(decoded.type)) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}