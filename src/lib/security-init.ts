import { validateSecurityConfig, SECURITY_CONFIG } from './config';
import { logger } from './logger';

// 安全配置初始化
export function initializeSecurity(): void {
  try {
    // 验证安全配置
    const configValidation = validateSecurityConfig();
    
    if (!configValidation.isValid) {
      console.error('❌ 安全配置验证失败:');
      configValidation.errors.forEach(error => console.error(`  - ${error}`));
      
      if (SECURITY_CONFIG.NODE_ENV === 'production') {
        console.error('🚨 生产环境安全配置无效，应用无法启动');
        process.exit(1);
      } else {
        console.warn('⚠️  开发环境安全配置存在问题，但继续运行');
      }
    }

    // 记录安全配置摘要
    logger.info('🔒 安全配置初始化完成', JSON.stringify({
      nodeEnv: SECURITY_CONFIG.NODE_ENV,
      secureCookies: SECURITY_CONFIG.SECURE_COOKIES,
      rateLimitEnabled: true,
      loginProtectionEnabled: true,
      jwtConfigured: !!SECURITY_CONFIG.JWT_SECRET,
      bcryptRounds: SECURITY_CONFIG.BCRYPT_ROUNDS
    }));

    // 设置安全相关的全局配置
    setupGlobalSecurity();

    // 启动安全监控
    if (SECURITY_CONFIG.ENABLE_MONITORING) {
      setupSecurityMonitoring();
    }

    console.log('✅ 安全模块初始化完成');
  } catch (error) {
    console.error('❌ 安全模块初始化失败:', error);
    
    if (SECURITY_CONFIG.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}

// 设置全局安全配置
function setupGlobalSecurity(): void {
  // 设置进程标题（用于进程识别）
  if (process.title && SECURITY_CONFIG.NODE_ENV === 'production') {
    process.title = `smart-inventory-${SECURITY_CONFIG.NODE_ENV}`;
  }

  // 设置未捕获异常处理
  process.on('uncaughtException', (error) => {
    logger.error('未捕获的异常', JSON.stringify({ error: error.message, stack: error.stack }));
    
    if (SECURITY_CONFIG.NODE_ENV === 'production') {
      // 生产环境中安全退出
      process.exit(1);
    }
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('未处理的Promise拒绝', JSON.stringify({ reason: reason?.toString(), promise: promise.toString() }));
    
    if (SECURITY_CONFIG.NODE_ENV === 'production') {
      // 生产环境中记录但不退出
      console.error('未处理的Promise拒绝:', reason);
    }
  });

  // 设置内存限制警告
  const memoryThreshold = SECURITY_CONFIG.NODE_ENV === 'production' ? 0.8 : 0.9;
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const totalMem = memUsage.heapTotal;
    const usedMem = memUsage.heapUsed;
    const usageRatio = usedMem / totalMem;

    if (usageRatio > memoryThreshold) {
      logger.warn('内存使用率过高', JSON.stringify({
        used: Math.round(usedMem / 1024 / 1024) + 'MB',
        total: Math.round(totalMem / 1024 / 1024) + 'MB',
        ratio: Math.round(usageRatio * 100) + '%'
      }));
    }
  }, 30000); // 每30秒检查一次
}

// 设置安全监控
function setupSecurityMonitoring(): void {
  // 监控安全事件
  const securityEvents = {
    loginAttempts: 0,
    failedLogins: 0,
    rateLimitHits: 0,
    tokenRefreshes: 0,
    securityViolations: 0
  };

  // 定期报告安全统计
  setInterval(() => {
    if (Object.values(securityEvents).some(count => count > 0)) {
      logger.info('🛡️  安全统计报告', JSON.stringify(securityEvents));
      
      // 重置计数器
      Object.keys(securityEvents).forEach(key => {
        (securityEvents as any)[key] = 0;
      });
    }
  }, 5 * 60 * 1000); // 每5分钟报告一次

  // 导出安全事件记录函数
  (global as any).securityEvents = securityEvents;
}

// 安全检查函数
export function performSecurityCheck(): { isSecure: boolean; issues: string[] } {
  const issues: string[] = [];

  // 检查环境变量
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    issues.push('JWT_SECRET未设置或长度不足');
  }

  if (SECURITY_CONFIG.NODE_ENV === 'production') {
    if (!SECURITY_CONFIG.SECURE_COOKIES) {
      issues.push('生产环境未启用安全Cookie');
    }

    if (SECURITY_CONFIG.ALLOWED_ORIGINS.includes('localhost')) {
      issues.push('生产环境包含localhost作为允许的来源');
    }
  }

  // 检查依赖包安全性（简化版）
  try {
    const fs = require('fs');
    const packagePath = './package.json';
    
    if (fs.existsSync(packagePath)) {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      // 检查已知有问题的包版本
      const vulnerablePackages = {
        'lodash': '<4.17.21',
        'axios': '<0.21.1',
        'node-forge': '<1.3.0'
      };

      Object.entries(vulnerablePackages).forEach(([pkg, maxVersion]) => {
        const installedVersion = packageJson.dependencies?.[pkg] || packageJson.devDependencies?.[pkg];
        if (installedVersion) {
          // 简化的版本比较（实际应用中应使用更精确的版本比较）
          if (installedVersion.startsWith('0.') || installedVersion.startsWith('1.')) {
            issues.push(`可能存在漏洞的包版本: ${pkg}@${installedVersion}`);
          }
        }
      });
    }
  } catch (error) {
    issues.push('无法检查依赖包安全性');
  }

  return {
    isSecure: issues.length === 0,
    issues
  };
}

// 定期安全检查
if (SECURITY_CONFIG.NODE_ENV === 'production') {
  setInterval(() => {
    const securityCheck = performSecurityCheck();
    
    if (!securityCheck.isSecure) {
      logger.error('🚨 安全检查发现问题', JSON.stringify({ issues: securityCheck.issues }));
    }
  }, 10 * 60 * 1000); // 每10分钟检查一次
}

// 导出安全事件记录函数
// 安全事件类型定义
interface SecurityEvents {
  loginAttempts: number;
  failedLogins: number;
  rateLimitHits: number;
  tokenRefreshes: number;
  securityViolations: number;
}

export function recordSecurityEvent(eventType: keyof SecurityEvents, details?: any): void {
  if (SECURITY_CONFIG.ENABLE_MONITORING && (global as any).securityEvents) {
    (global as any).securityEvents[eventType]++;
    
    logger.debug('安全事件记录', JSON.stringify({
      type: eventType,
      details,
      timestamp: new Date().toISOString()
    }));
  }
}

// 安全响应头生成
export function generateSecurityHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin'
  };

  // CSP策略
  const isDevelopment = SECURITY_CONFIG.NODE_ENV !== 'production';
  const cspDirectives = [
    "default-src 'self'",
    isDevelopment ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'" : "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "require-trusted-types-for 'script'"
  ].join('; ');

  headers['Content-Security-Policy'] = cspDirectives;

  // HSTS（仅生产环境）
  if (SECURITY_CONFIG.NODE_ENV === 'production') {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
  }

  return headers;
}

// 初始化安全模块（如果直接运行此文件）
if (require.main === module) {
  initializeSecurity();
  
  const securityCheck = performSecurityCheck();
  console.log('🔍 安全检查结果:', securityCheck);
}