import fs from 'fs';
import path from 'path';

// 日志级别
export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

// 日志条目接口
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, any>;
}

// 日志配置
const LOG_CONFIG = {
  // 日志目录
  logDir: process.env.LOG_DIR || './logs',
  
  // 日志文件名
  errorLogFile: 'error.log',
  warnLogFile: 'warn.log',
  infoLogFile: 'info.log',
  debugLogFile: 'debug.log',
  
  // 是否启用控制台输出
  enableConsole: process.env.NODE_ENV === 'development',
  
  // 是否启用文件日志
  enableFileLogging: true,
  
  // 日志文件最大大小（字节）
  maxFileSize: 10 * 1024 * 1024, // 10MB
  
  // 保留的日志文件数量
  maxFiles: 5,
  
  // 是否启用结构化日志
  enableStructuredLogging: true,
};

// 确保日志目录存在
function ensureLogDirectory(): void {
  if (!fs.existsSync(LOG_CONFIG.logDir)) {
    fs.mkdirSync(LOG_CONFIG.logDir, { recursive: true });
  }
}

// 获取日志文件路径
function getLogFilePath(level: LogLevel): string {
  switch (level) {
    case LogLevel.ERROR:
      return path.join(LOG_CONFIG.logDir, LOG_CONFIG.errorLogFile);
    case LogLevel.WARN:
      return path.join(LOG_CONFIG.logDir, LOG_CONFIG.warnLogFile);
    case LogLevel.INFO:
      return path.join(LOG_CONFIG.logDir, LOG_CONFIG.infoLogFile);
    case LogLevel.DEBUG:
      return path.join(LOG_CONFIG.logDir, LOG_CONFIG.debugLogFile);
    default:
      return path.join(LOG_CONFIG.logDir, LOG_CONFIG.infoLogFile);
  }
}

// 检查并轮转日志文件
function rotateLogFileIfNeeded(filePath: string): void {
  try {
    if (!fs.existsSync(filePath)) {
      return;
    }
    
    const stats = fs.statSync(filePath);
    
    if (stats.size > LOG_CONFIG.maxFileSize) {
      // 轮转日志文件
      for (let i = LOG_CONFIG.maxFiles - 1; i > 0; i--) {
        const oldFile = `${filePath}.${i}`;
        const newFile = `${filePath}.${i + 1}`;
        
        if (fs.existsSync(oldFile)) {
          if (i === LOG_CONFIG.maxFiles - 1) {
            // 删除最老的日志文件
            fs.unlinkSync(oldFile);
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }
      
      // 重命名当前日志文件
      fs.renameSync(filePath, `${filePath}.1`);
    }
  } catch (error) {
    console.error('日志文件轮转失败:', error);
  }
}

// 格式化日志条目
function formatLogEntry(entry: LogEntry): string {
  if (LOG_CONFIG.enableStructuredLogging) {
    return JSON.stringify(entry);
  } else {
    const timestamp = entry.timestamp;
    const level = entry.level.padEnd(5);
    const context = entry.context ? `[${entry.context}] ` : '';
    const message = entry.message;
    const metadata = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
    
    return `${timestamp} ${level} ${context}${message}${metadata}`;
  }
}

// 写入日志文件
function writeToFile(level: LogLevel, formattedEntry: string): void {
  if (!LOG_CONFIG.enableFileLogging) {
    return;
  }
  
  try {
    const filePath = getLogFilePath(level);
    rotateLogFileIfNeeded(filePath);
    
    fs.appendFileSync(filePath, formattedEntry + '\n');
  } catch (error) {
    console.error('写入日志文件失败:', error);
  }
}

// 输出到控制台
function writeToConsole(entry: LogEntry): void {
  if (!LOG_CONFIG.enableConsole) {
    return;
  }
  
  const timestamp = entry.timestamp;
  const level = entry.level;
  const context = entry.context ? `[${entry.context}] ` : '';
  const message = entry.message;
  const metadata = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
  
  const logMessage = `${timestamp} ${level} ${context}${message}${metadata}`;
  
  switch (entry.level) {
    case LogLevel.ERROR:
      console.error(logMessage);
      if (entry.error?.stack) {
        console.error(entry.error.stack);
      }
      break;
    case LogLevel.WARN:
      console.warn(logMessage);
      break;
    case LogLevel.INFO:
      console.info(logMessage);
      break;
    case LogLevel.DEBUG:
      console.debug(logMessage);
      break;
  }
}

// 生成请求ID
function generateRequestId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 创建日志条目
function createLogEntry(
  level: LogLevel,
  message: string,
  context?: string,
  metadata?: Record<string, any>
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    metadata,
  };
}

// 主日志函数
function log(
  level: LogLevel,
  message: string,
  context?: string,
  metadata?: Record<string, any>
): void {
  const entry = createLogEntry(level, message, context, metadata);
  const formattedEntry = formatLogEntry(entry);
  
  writeToFile(level, formattedEntry);
  writeToConsole(entry);
}

// 扩展日志函数
export const logger = {
  error: (message: string, context?: string, metadata?: Record<string, any>) => {
    log(LogLevel.ERROR, message, context, metadata);
  },
  
  warn: (message: string, context?: string, metadata?: Record<string, any>) => {
    log(LogLevel.WARN, message, context, metadata);
  },
  
  info: (message: string, context?: string, metadata?: Record<string, any>) => {
    log(LogLevel.INFO, message, context, metadata);
  },
  
  debug: (message: string, context?: string, metadata?: Record<string, any>) => {
    log(LogLevel.DEBUG, message, context, metadata);
  },
  
  // 带用户信息的日志
  userLog: (
    level: LogLevel,
    message: string,
    userId: string,
    context?: string,
    metadata?: Record<string, any>
  ) => {
    const entry = createLogEntry(level, message, context, metadata);
    entry.userId = userId;
    
    const formattedEntry = formatLogEntry(entry);
    writeToFile(level, formattedEntry);
    writeToConsole(entry);
  },
  
  // API请求日志
  apiLog: (
    method: string,
    url: string,
    statusCode: number,
    responseTime: number,
    userId?: string,
    ip?: string,
    userAgent?: string,
    error?: Error
  ) => {
    const level = statusCode >= 400 ? LogLevel.ERROR : 
                 statusCode >= 300 ? LogLevel.WARN : LogLevel.INFO;
    
    const message = `${method} ${url} ${statusCode} - ${responseTime}ms`;
    
    const entry = createLogEntry(level, message, 'API');
    entry.userId = userId;
    entry.ip = ip;
    entry.userAgent = userAgent;
    entry.requestId = generateRequestId();
    
    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    
    entry.metadata = {
      method,
      url,
      statusCode,
      responseTime,
    };
    
    const formattedEntry = formatLogEntry(entry);
    writeToFile(level, formattedEntry);
    writeToConsole(entry);
  },
  
  // 数据库操作日志
  dbLog: (
    operation: string,
    table: string,
    duration: number,
    success: boolean,
    error?: Error,
    metadata?: Record<string, any>
  ) => {
    const level = success ? (duration > 1000 ? LogLevel.WARN : LogLevel.INFO) : LogLevel.ERROR;
    const message = `DB ${operation} on ${table} - ${duration}ms - ${success ? 'SUCCESS' : 'FAILED'}`;
    
    const entry = createLogEntry(level, message, 'Database');
    
    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    
    entry.metadata = {
      operation,
      table,
      duration,
      success,
      ...metadata,
    };
    
    const formattedEntry = formatLogEntry(entry);
    writeToFile(level, formattedEntry);
    writeToConsole(entry);
  },
  
  // 安全事件日志
  securityLog: (
    event: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    userId?: string,
    ip?: string,
    userAgent?: string,
    metadata?: Record<string, any>
  ) => {
    const level = severity === 'CRITICAL' ? LogLevel.ERROR :
                 severity === 'HIGH' ? LogLevel.ERROR :
                 severity === 'MEDIUM' ? LogLevel.WARN : LogLevel.INFO;
    
    const message = `Security Event: ${event} - ${severity}`;
    
    const entry = createLogEntry(level, message, 'Security');
    entry.userId = userId;
    entry.ip = ip;
    entry.userAgent = userAgent;
    entry.requestId = generateRequestId();
    
    entry.metadata = {
      event,
      severity,
      ...metadata,
    };
    
    const formattedEntry = formatLogEntry(entry);
    writeToFile(level, formattedEntry);
    writeToConsole(entry);
  },
};

// 初始化日志系统
export function initializeLogger(): void {
  ensureLogDirectory();
  
  logger.info('日志系统初始化完成', 'System', {
    config: LOG_CONFIG,
    nodeEnv: process.env.NODE_ENV,
  });
}

// 清理旧日志文件
export function cleanupOldLogs(): void {
  try {
    const logFiles = fs.readdirSync(LOG_CONFIG.logDir);
    
    logFiles.forEach(file => {
      const filePath = path.join(LOG_CONFIG.logDir, file);
      const stats = fs.statSync(filePath);
      
      // 删除超过30天的日志文件
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      if (stats.mtime.getTime() < thirtyDaysAgo) {
        fs.unlinkSync(filePath);
        logger.info(`删除旧日志文件: ${file}`, 'System');
      }
    });
  } catch (error) {
    logger.error('清理旧日志文件失败', 'System', { error: (error as Error).message });
  }
}

// 获取日志统计信息
export function getLogStats(): {
  totalLogs: number;
  errorLogs: number;
  warnLogs: number;
  infoLogs: number;
  debugLogs: number;
  logFiles: string[];
} {
  try {
    const logFiles = fs.readdirSync(LOG_CONFIG.logDir);
    let totalLogs = 0;
    let errorLogs = 0;
    let warnLogs = 0;
    let infoLogs = 0;
    let debugLogs = 0;
    
    logFiles.forEach(file => {
      const filePath = path.join(LOG_CONFIG.logDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        totalLogs += 1;
        
        if (file.includes('error')) errorLogs += 1;
        else if (file.includes('warn')) warnLogs += 1;
        else if (file.includes('info')) infoLogs += 1;
        else if (file.includes('debug')) debugLogs += 1;
      }
    });
    
    return {
      totalLogs,
      errorLogs,
      warnLogs,
      infoLogs,
      debugLogs,
      logFiles,
    };
  } catch (error) {
    logger.error('获取日志统计信息失败', 'System', { error: (error as Error).message });
    return {
      totalLogs: 0,
      errorLogs: 0,
      warnLogs: 0,
      infoLogs: 0,
      debugLogs: 0,
      logFiles: [],
    };
  }
}

// 定期清理旧日志
setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000); // 每天清理一次

// 导出日志配置
export { LOG_CONFIG };