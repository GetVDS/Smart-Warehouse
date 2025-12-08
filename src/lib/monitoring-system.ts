import { NextRequest } from 'next/server';
import { writeFileSync, existsSync, mkdirSync, appendFileSync, readFileSync } from 'fs';
import { join } from 'path';

// 日志级别枚举
export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

// 日志条目接口
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: any;
  requestId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
}

// 性能指标接口
export interface PerformanceMetrics {
  timestamp: string;
  requestId?: string;
  endpoint?: string;
  method?: string;
  responseTime: number;
  memoryUsage?: NodeJS.MemoryUsage;
  cpuUsage?: NodeJS.CpuUsage;
  statusCode?: number;
  userId?: string;
}

// 错误统计接口
export interface ErrorStats {
  timestamp: string;
  errorType: string;
  message: string;
  stack?: string;
  context?: any;
  userId?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

// 系统健康状态接口
export interface HealthStatus {
  timestamp: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  checks: {
    database: boolean;
    memory: boolean;
    disk: boolean;
    cpu: boolean;
  };
  metrics: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    diskUsage: number;
  };
}

// 监控系统类
export class MonitoringSystem {
  private static instance: MonitoringSystem;
  private logs: LogEntry[] = [];
  private metrics: PerformanceMetrics[] = [];
  private errors: ErrorStats[] = [];
  private maxLogs = 10000;
  private maxMetrics = 5000;
  private maxErrors = 1000;
  private logDir: string;
  private metricsDir: string;
  private errorsDir: string;

  private constructor() {
    this.logDir = process.env.LOG_DIR || './logs';
    this.metricsDir = join(this.logDir, 'metrics');
    this.errorsDir = join(this.logDir, 'errors');
    
    // 确保日志目录存在
    this.ensureLogDirectories();
    
    // 定期清理旧数据
    this.startCleanupInterval();
    
    // 优雅关闭时保存数据
    process.on('beforeExit', () => this.saveAllData());
    process.on('SIGINT', () => this.saveAllData());
    process.on('SIGTERM', () => this.saveAllData());
  }

  static getInstance(): MonitoringSystem {
    if (!MonitoringSystem.instance) {
      MonitoringSystem.instance = new MonitoringSystem();
    }
    return MonitoringSystem.instance;
  }

  // 确保日志目录存在
  private ensureLogDirectories(): void {
    const dirs = [this.logDir, this.metricsDir, this.errorsDir];
    dirs.forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });
  }

  // 记录日志
  async log(
    level: LogLevel,
    message: string,
    context?: any,
    request?: NextRequest
  ): Promise<void> {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      requestId: request?.headers.get('x-request-id') || undefined,
      userId: this.extractUserId(request),
      ip: this.extractIp(request),
      userAgent: request?.headers.get('user-agent') || undefined,
      method: request?.method,
      url: request?.url,
      statusCode: context?.statusCode,
      responseTime: context?.responseTime
    };

    // 添加到内存日志
    this.logs.push(logEntry);
    
    // 保持日志数量在限制内
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // 输出到控制台
    this.logToConsole(logEntry);

    // 保存到文件
    await this.saveLogToFile(logEntry);

    // 如果是错误，同时记录到错误统计
    if (level === LogLevel.ERROR) {
      await this.recordError(message, context, request);
    }
  }

  // 记录性能指标
  async recordMetrics(
    responseTime: number,
    request?: NextRequest,
    statusCode?: number
  ): Promise<void> {
    const metrics: PerformanceMetrics = {
      timestamp: new Date().toISOString(),
      requestId: request?.headers.get('x-request-id') || undefined,
      endpoint: request?.url,
      method: request?.method,
      responseTime,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      statusCode,
      userId: this.extractUserId(request)
    };

    // 添加到内存指标
    this.metrics.push(metrics);

    // 保持指标数量在限制内
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // 保存到文件
    await this.saveMetricsToFile(metrics);

    // 检查性能阈值
    this.checkPerformanceThresholds(metrics);
  }

  // 记录错误统计
  private async recordError(
    message: string,
    context?: any,
    request?: NextRequest
  ): Promise<void> {
    const errorStats: ErrorStats = {
      timestamp: new Date().toISOString(),
      errorType: context?.errorType || 'unknown',
      message,
      stack: context?.stack,
      context,
      userId: this.extractUserId(request),
      ip: this.extractIp(request),
      userAgent: request?.headers.get('user-agent') || undefined,
      requestId: request?.headers.get('x-request-id') || undefined
    };

    // 添加到内存错误统计
    this.errors.push(errorStats);

    // 保持错误数量在限制内
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // 保存到文件
    await this.saveErrorToFile(errorStats);
  }

  // 获取系统健康状态
  async getHealthStatus(): Promise<HealthStatus> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();
    
    // 检查数据库连接
    let databaseHealthy = false;
    try {
      // 这里可以添加实际的数据库健康检查
      databaseHealthy = true; // 简化实现
    } catch (error) {
      databaseHealthy = false;
    }

    // 检查内存使用率
    const memoryHealthy = memoryUsage.heapUsed / memoryUsage.heapTotal < 0.9;

    // 检查磁盘使用率（简化实现）
    const diskHealthy = true; // 可以添加实际的磁盘检查

    // 检查CPU使用率（简化实现）
    const cpuHealthy = true; // 可以添加实际的CPU检查

    // 确定整体健康状态
    const checks = {
      database: databaseHealthy,
      memory: memoryHealthy,
      disk: diskHealthy,
      cpu: cpuHealthy
    };

    const allHealthy = Object.values(checks).every(check => check);
    const someHealthy = Object.values(checks).some(check => check);

    const status = allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'unhealthy';

    return {
      timestamp: new Date().toISOString(),
      status,
      checks,
      metrics: {
        uptime,
        memoryUsage,
        cpuUsage,
        diskUsage: 0 // 简化实现
      }
    };
  }

  // 获取日志
  getLogs(level?: LogLevel, limit?: number): LogEntry[] {
    let filteredLogs = this.logs;
    
    if (level) {
      filteredLogs = this.logs.filter(log => log.level === level);
    }
    
    if (limit) {
      filteredLogs = filteredLogs.slice(-limit);
    }
    
    return filteredLogs;
  }

  // 获取性能指标
  getMetrics(limit?: number): PerformanceMetrics[] {
    if (limit) {
      return this.metrics.slice(-limit);
    }
    return this.metrics;
  }

  // 获取错误统计
  getErrors(limit?: number): ErrorStats[] {
    if (limit) {
      return this.errors.slice(-limit);
    }
    return this.errors;
  }

  // 获取统计摘要
  getStats(): {
    logs: {
      total: number;
      byLevel: Record<LogLevel, number>;
      recent: LogEntry[];
    };
    metrics: {
      total: number;
      avgResponseTime: number;
      slowRequests: PerformanceMetrics[];
    };
    errors: {
      total: number;
      byType: Record<string, number>;
      recent: ErrorStats[];
    };
  } {
    // 日志统计
    const logsByLevel = this.logs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<LogLevel, number>);

    // 性能指标统计
    const responseTimes = this.metrics.map(m => m.responseTime);
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;
    const slowRequests = this.metrics.filter(m => m.responseTime > 1000); // 超过1秒的请求

    // 错误统计
    const errorsByType = this.errors.reduce((acc, error) => {
      acc[error.errorType] = (acc[error.errorType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      logs: {
        total: this.logs.length,
        byLevel: logsByLevel,
        recent: this.logs.slice(-10)
      },
      metrics: {
        total: this.metrics.length,
        avgResponseTime: Math.round(avgResponseTime * 100) / 100,
        slowRequests
      },
      errors: {
        total: this.errors.length,
        byType: errorsByType,
        recent: this.errors.slice(-10)
      }
    };
  }

  // 输出到控制台
  private logToConsole(logEntry: LogEntry): void {
    const timestamp = new Date(logEntry.timestamp).toLocaleString();
    const logMessage = `[${timestamp}] [${logEntry.level}] ${logEntry.message}`;
    
    switch (logEntry.level) {
      case LogLevel.ERROR:
        console.error(logMessage, logEntry.context || '');
        break;
      case LogLevel.WARN:
        console.warn(logMessage, logEntry.context || '');
        break;
      case LogLevel.INFO:
        console.info(logMessage, logEntry.context || '');
        break;
      case LogLevel.DEBUG:
        console.debug(logMessage, logEntry.context || '');
        break;
      default:
        console.log(logMessage, logEntry.context || '');
    }
  }

  // 保存日志到文件
  private async saveLogToFile(logEntry: LogEntry): Promise<void> {
    try {
      const date = new Date(logEntry.timestamp).toISOString().split('T')[0];
      const logFile = join(this.logDir, `app-${date}.log`);
      const logLine = JSON.stringify(logEntry) + '\n';
      
      appendFileSync(logFile, logLine);
    } catch (error) {
      console.error('保存日志文件失败:', error);
    }
  }

  // 保存指标到文件
  private async saveMetricsToFile(metrics: PerformanceMetrics): Promise<void> {
    try {
      const date = new Date(metrics.timestamp).toISOString().split('T')[0];
      const metricsFile = join(this.metricsDir, `metrics-${date}.json`);
      const metricsLine = JSON.stringify(metrics) + '\n';
      
      appendFileSync(metricsFile, metricsLine);
    } catch (error) {
      console.error('保存指标文件失败:', error);
    }
  }

  // 保存错误到文件
  private async saveErrorToFile(error: ErrorStats): Promise<void> {
    try {
      const date = new Date(error.timestamp).toISOString().split('T')[0];
      const errorFile = join(this.errorsDir, `errors-${date}.json`);
      const errorLine = JSON.stringify(error) + '\n';
      
      appendFileSync(errorFile, errorLine);
    } catch (error) {
      console.error('保存错误文件失败:', error);
    }
  }

  // 检查性能阈值
  private checkPerformanceThresholds(metrics: PerformanceMetrics): void {
    // 检查响应时间阈值
    if (metrics.responseTime > 5000) { // 5秒
      this.log(LogLevel.WARN, '检测到慢请求', {
        responseTime: metrics.responseTime,
        endpoint: metrics.endpoint,
        threshold: 5000
      });
    }

    // 检查内存使用阈值
    if (metrics.memoryUsage) {
      const memoryUsagePercent = (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100;
      if (memoryUsagePercent > 90) {
        this.log(LogLevel.WARN, '内存使用率过高', {
          memoryUsagePercent: Math.round(memoryUsagePercent),
          threshold: 90
        });
      }
    }
  }

  // 定期清理旧数据
  private startCleanupInterval(): void {
    // 每小时清理一次旧数据
    setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000);
  }

  // 清理旧数据
  private cleanupOldData(): void {
    const now = new Date();
    const retentionDays = 7; // 保留7天的数据
    
    // 清理内存中的旧数据
    const cutoffDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
    
    this.logs = this.logs.filter(log => new Date(log.timestamp) > cutoffDate);
    this.metrics = this.metrics.filter(metric => new Date(metric.timestamp) > cutoffDate);
    this.errors = this.errors.filter(error => new Date(error.timestamp) > cutoffDate);
  }

  // 保存所有数据到文件
  private saveAllData(): void {
    try {
      const timestamp = new Date().toISOString();
      
      // 保存当前状态
      const currentState = {
        timestamp,
        stats: this.getStats(),
        healthStatus: null // 可以在关闭前获取健康状态
      };
      
      const stateFile = join(this.logDir, `state-${timestamp}.json`);
      writeFileSync(stateFile, JSON.stringify(currentState, null, 2));
      
      console.log('监控数据已保存');
    } catch (error) {
      console.error('保存监控数据失败:', error);
    }
  }

  // 提取用户ID
  private extractUserId(request?: NextRequest): string | undefined {
    // 从请求中提取用户ID（可以从token、session等中获取）
    // 这里是简化实现
    return undefined;
  }

  // 提取IP地址
  private extractIp(request?: NextRequest): string | undefined {
    if (!request) return undefined;
    
    return request.headers.get('x-forwarded-for') ||
           request.headers.get('x-real-ip') ||
           undefined; // Next.js的NextRequest没有ip属性
  }
}

// 导出单例实例
export const monitoring = MonitoringSystem.getInstance();

// 便捷方法
export const logError = async (message: string, context?: any, request?: NextRequest) =>
  await monitoring.log(LogLevel.ERROR, message, context, request);

export const logWarn = async (message: string, context?: any, request?: NextRequest) =>
  await monitoring.log(LogLevel.WARN, message, context, request);

export const logInfo = async (message: string, context?: any, request?: NextRequest) =>
  await monitoring.log(LogLevel.INFO, message, context, request);

export const logDebug = async (message: string, context?: any, request?: NextRequest) =>
  await monitoring.log(LogLevel.DEBUG, message, context, request);

export const recordMetrics = async (responseTime: number, request?: NextRequest, statusCode?: number) =>
  await monitoring.recordMetrics(responseTime, request, statusCode);

export const getHealthStatus = () => monitoring.getHealthStatus();
export const getMonitoringStats = () => monitoring.getStats();

// 性能监控装饰器
export function withPerformanceMonitoring(
  handler: (request: NextRequest, ...args: any[]) => Promise<Response>
) {
  return async (request: NextRequest, ...args: any[]): Promise<Response> => {
    const startTime = Date.now();
    
    try {
      const response = await handler(request, ...args);
      const responseTime = Date.now() - startTime;
      
      // 记录性能指标
      await recordMetrics(responseTime, request, response.status);
      
      return response;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // 记录错误和性能指标
      await logError('请求处理失败', {
        error: error instanceof Error ? error.message : '未知错误',
        stack: error instanceof Error ? error.stack : undefined
      }, request);
      
      await recordMetrics(responseTime, request, 500);
      
      throw error;
    }
  };
}