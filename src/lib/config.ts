import crypto from 'crypto';

// 统一端口配置
export const PORT_CONFIG = {
  // 统一外部访问端口为3000
  EXTERNAL_PORT: 3000,
  // 内部服务端口
  APP_INTERNAL_PORT: 3000,
  // 监控端口
  METRICS_PORT: 9090,
  // 开发环境API端口
  DEV_API_PORT: 3000
};

// 导出安全配置
export const SECURITY_CONFIG = {
  // JWT配置
  JWT_SECRET: process.env.JWT_SECRET || crypto.randomBytes(32).toString('base64'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m', // 字符串格式，jsonwebtoken会自动解析
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d', // 字符串格式，jsonwebtoken会自动解析
  
  // 密码配置
  BCRYPT_ROUNDS: 10,
  
  // 安全配置
  SECURE_COOKIES: process.env.NODE_ENV === 'production',
  ALLOWED_ORIGINS: process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [process.env.NEXTAUTH_URL || 'https://localhost:3000'])
    : ['http://localhost:3000'],
  
  // 登录安全
  MAX_LOGIN_ATTEMPTS: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5'),
  LOGIN_LOCKOUT_TIME: parseInt(process.env.LOGIN_LOCKOUT_TIME || '900'), // 15分钟
  
  // 速率限制
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15分钟
  
  // 环境配置
  NODE_ENV: process.env.NODE_ENV || 'development',
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
  
  // 监控配置
  ENABLE_MONITORING: process.env.ENABLE_MONITORING === 'true',
  METRICS_PORT: parseInt(process.env.METRICS_PORT || '9090'),
};

// 数据库配置
export const DATABASE_CONFIG = {
  URL: process.env.DATABASE_URL || 'file:./data/custom.db',
  PATH: process.env.DB_PATH || './data',
  BACKUP_PATH: process.env.DB_BACKUP_PATH || './data/backups',
  CONNECTION_POOL_SIZE: parseInt(process.env.MAX_CONNECTIONS || '10'),
  SLOW_QUERY_THRESHOLD: parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000'),
  ENABLE_QUERY_MONITORING: process.env.ENABLE_QUERY_MONITORING === 'true'
};

// 应用配置
export const APP_CONFIG = {
  PORT: parseInt(process.env.PORT || '3000'),
  HOSTNAME: process.env.HOSTNAME || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // 性能配置
  NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=2048',
  NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED === 'true',
  
  // 日志配置
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_DIR: process.env.LOG_DIR || './logs',
  ENABLE_SECURITY_LOGGING: process.env.ENABLE_SECURITY_LOGGING === 'true'
};

// 配置验证函数
export function validateSecurityConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      errors.push('生产环境必须设置强密码的JWT_SECRET');
    }
    
    if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length < 32) {
      errors.push('生产环境必须设置强密码的NEXTAUTH_SECRET');
    }
    
    if (!process.env.NEXTAUTH_URL || !process.env.NEXTAUTH_URL.startsWith('https://')) {
      errors.push('生产环境必须设置HTTPS的NEXTAUTH_URL');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// 获取配置摘要（用于日志，隐藏敏感信息）
export function getConfigSummary(): Record<string, any> {
  return {
    port: PORT_CONFIG.EXTERNAL_PORT,
    nodeEnv: APP_CONFIG.NODE_ENV,
    databaseUrl: DATABASE_CONFIG.URL.replace(/\/[^\/]+$/, '/***'),
    enableMonitoring: SECURITY_CONFIG.ENABLE_MONITORING,
    enableSecurityLogging: APP_CONFIG.ENABLE_SECURITY_LOGGING,
    allowedOrigins: SECURITY_CONFIG.ALLOWED_ORIGINS
  };
}