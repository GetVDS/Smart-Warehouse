import crypto from 'crypto';

// 安全配置验证
function validateConfig(): void {
  const requiredEnvVars = [
    'JWT_SECRET',
    'DATABASE_URL'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`缺少必需的环境变量: ${missingVars.join(', ')}`);
  }

  // 验证JWT密钥长度
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET长度必须至少为32个字符');
  }
}

// 验证配置并在开发环境提供默认值
try {
  validateConfig();
} catch (error) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('配置验证失败，使用开发环境默认值:', error);
    
    // 开发环境提供默认JWT密钥（仅用于开发）
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = crypto.randomBytes(64).toString('hex');
      console.warn('⚠️  开发环境：使用随机生成的JWT密钥，生产环境请设置JWT_SECRET环境变量');
    }
  } else {
    console.error('配置验证失败:', error);
    process.exit(1);
  }
}

// 导出安全配置
export const SECURITY_CONFIG = {
  // JWT配置
  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  
  // 密码策略
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_REQUIRE_UPPERCASE: true,
  PASSWORD_REQUIRE_LOWERCASE: true,
  PASSWORD_REQUIRE_NUMBERS: true,
  PASSWORD_REQUIRE_SYMBOLS: false,
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12'),
  
  // 速率限制
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15分钟
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  
  // 登录限制
  LOGIN_ATTEMPT_LIMIT: parseInt(process.env.LOGIN_ATTEMPT_LIMIT || '5'),
  LOGIN_LOCKOUT_TIME_MS: parseInt(process.env.LOGIN_LOCKOUT_TIME_MS || '900000'), // 15分钟
  
  // 会话安全
  SESSION_TIMEOUT_MS: parseInt(process.env.SESSION_TIMEOUT_MS || '604800000'), // 7天
  SECURE_COOKIES: process.env.NODE_ENV === 'production',
  
  // CORS配置
  ALLOWED_ORIGINS: process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [process.env.NEXTAUTH_URL || 'https://localhost:3001'])
    : ['http://localhost:3001', 'http://localhost:3000'],
    
  // 应用配置
  NODE_ENV: process.env.NODE_ENV || 'development',
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3001',
  
  // 日志配置
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE_PATH: process.env.LOG_FILE_PATH || './logs/app.log',
  
  // 监控配置
  ENABLE_MONITORING: process.env.ENABLE_MONITORING === 'true',
  METRICS_PORT: parseInt(process.env.METRICS_PORT || '9090'),
};

// 配置验证函数
export function validateSecurityConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // 验证JWT密钥
  if (!SECURITY_CONFIG.JWT_SECRET || SECURITY_CONFIG.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET必须设置且长度至少为32个字符');
  }
  
  // 验证密码轮数
  if (SECURITY_CONFIG.BCRYPT_ROUNDS < 10 || SECURITY_CONFIG.BCRYPT_ROUNDS > 15) {
    errors.push('BCRYPT_ROUNDS应在10-15之间');
  }
  
  // 验证速率限制
  if (SECURITY_CONFIG.RATE_LIMIT_MAX_REQUESTS < 1 || SECURITY_CONFIG.RATE_LIMIT_MAX_REQUESTS > 1000) {
    errors.push('RATE_LIMIT_MAX_REQUESTS应在1-1000之间');
  }
  
  // 验证登录限制
  if (SECURITY_CONFIG.LOGIN_ATTEMPT_LIMIT < 1 || SECURITY_CONFIG.LOGIN_ATTEMPT_LIMIT > 20) {
    errors.push('LOGIN_ATTEMPT_LIMIT应在1-20之间');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// 获取配置摘要（用于日志，隐藏敏感信息）
export function getConfigSummary(): Record<string, any> {
  return {
    JWT_EXPIRES_IN: SECURITY_CONFIG.JWT_EXPIRES_IN,
    JWT_REFRESH_EXPIRES_IN: SECURITY_CONFIG.JWT_REFRESH_EXPIRES_IN,
    PASSWORD_MIN_LENGTH: SECURITY_CONFIG.PASSWORD_MIN_LENGTH,
    BCRYPT_ROUNDS: SECURITY_CONFIG.BCRYPT_ROUNDS,
    RATE_LIMIT_WINDOW_MS: SECURITY_CONFIG.RATE_LIMIT_WINDOW_MS,
    RATE_LIMIT_MAX_REQUESTS: SECURITY_CONFIG.RATE_LIMIT_MAX_REQUESTS,
    LOGIN_ATTEMPT_LIMIT: SECURITY_CONFIG.LOGIN_ATTEMPT_LIMIT,
    SESSION_TIMEOUT_MS: SECURITY_CONFIG.SESSION_TIMEOUT_MS,
    SECURE_COOKIES: SECURITY_CONFIG.SECURE_COOKIES,
    NODE_ENV: SECURITY_CONFIG.NODE_ENV,
    LOG_LEVEL: SECURITY_CONFIG.LOG_LEVEL,
    ENABLE_MONITORING: SECURITY_CONFIG.ENABLE_MONITORING,
    // 隐藏敏感信息
    JWT_SECRET_SET: !!SECURITY_CONFIG.JWT_SECRET,
    ALLOWED_ORIGINS_COUNT: SECURITY_CONFIG.ALLOWED_ORIGINS.length,
  };
}