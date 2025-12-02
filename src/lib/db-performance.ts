import { PrismaClient } from '@prisma/client';

// 性能监控配置
const PERFORMANCE_CONFIG = {
  // 慢查询阈值（毫秒）
  slowQueryThreshold: 1000,
  
  // 查询日志记录
  enableQueryLogging: process.env.NODE_ENV === 'development',
  
  // 性能统计间隔（毫秒）
  statsInterval: 5 * 60 * 1000, // 5分钟
  
  // 最大重试次数
  maxRetries: 3,
  
  // 重试延迟（毫秒）
  retryDelay: 1000,
};

// 查询性能统计
interface QueryStats {
  totalQueries: number;
  slowQueries: number;
  averageQueryTime: number;
  queryTimes: number[];
  lastResetTime: number;
}

// 错误统计
interface ErrorStats {
  totalErrors: number;
  connectionErrors: number;
  timeoutErrors: number;
  lastErrorTime?: number;
  lastError?: string;
}

// 全局统计对象
const globalStats = {
  queries: {
    totalQueries: 0,
    slowQueries: 0,
    averageQueryTime: 0,
    queryTimes: [] as number[],
    lastResetTime: Date.now(),
  } as QueryStats,
  
  errors: {
    totalErrors: 0,
    connectionErrors: 0,
    timeoutErrors: 0,
    lastErrorTime: undefined as number | undefined,
    lastError: undefined as string | undefined,
  } as ErrorStats,
  
  connections: {
    activeConnections: 0,
    totalConnections: 0,
    maxConnections: 10,
  },
};

// 重试函数
export async function retryOperation<T>(
  operation: () => Promise<T>,
  retries: number = PERFORMANCE_CONFIG.maxRetries,
  delay: number = PERFORMANCE_CONFIG.retryDelay
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // 记录错误统计
      globalStats.errors.totalErrors++;
      globalStats.errors.lastErrorTime = Date.now();
      globalStats.errors.lastError = error instanceof Error ? error.message : '未知错误';
      
      // 检查错误类型
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('connection') || errorMessage.includes('connect')) {
          globalStats.errors.connectionErrors++;
        } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
          globalStats.errors.timeoutErrors++;
        }
      }
      
      // 如果是最后一次尝试，直接抛出错误
      if (attempt === retries) {
        console.error(`数据库操作失败，已重试${retries}次:`, error);
        throw lastError;
      }
      
      // 记录重试信息
      console.warn(`数据库操作失败，${delay}ms后进行第${attempt + 1}次重试:`, error);
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // 指数退避
      delay *= 2;
    }
  }
  
  throw lastError!;
}

// 查询性能监控装饰器
export function withPerformanceMonitoring<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  operationName: string
) {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now();
    
    try {
      const result = await fn(...args);
      const queryTime = Date.now() - startTime;
      
      // 更新统计信息
      globalStats.queries.totalQueries++;
      globalStats.queries.queryTimes.push(queryTime);
      
      // 只保留最近100次查询的时间
      if (globalStats.queries.queryTimes.length > 100) {
        globalStats.queries.queryTimes.shift();
      }
      
      // 计算平均查询时间
      globalStats.queries.averageQueryTime = 
        globalStats.queries.queryTimes.reduce((sum, time) => sum + time, 0) / globalStats.queries.queryTimes.length;
      
      // 记录慢查询
      if (queryTime > PERFORMANCE_CONFIG.slowQueryThreshold) {
        globalStats.queries.slowQueries++;
        console.warn(`慢查询检测 [${operationName}]: ${queryTime}ms`, {
          operationName,
          queryTime,
          threshold: PERFORMANCE_CONFIG.slowQueryThreshold,
        });
      }
      
      // 开发环境下记录所有查询
      if (PERFORMANCE_CONFIG.enableQueryLogging) {
        console.log(`查询完成 [${operationName}]: ${queryTime}ms`);
      }
      
      return result;
    } catch (error) {
      const queryTime = Date.now() - startTime;
      console.error(`查询失败 [${operationName}]: ${queryTime}ms`, error);
      throw error;
    }
  };
}

// 创建带有性能监控的Prisma客户端
export function createMonitoredClient(originalClient: PrismaClient): PrismaClient {
  // 创建代理来监控所有方法调用
  const monitoredClient = new Proxy(originalClient, {
    get(target, prop) {
      const value = target[prop as keyof PrismaClient];
      
      // 如果是模型对象
      if (typeof value === 'object' && value !== null) {
        return new Proxy(value, {
          get(modelTarget, modelProp) {
            const modelValue = modelTarget[modelProp as keyof typeof modelTarget];
            
            // 如果是方法
            if (typeof modelValue === 'function') {
              return withPerformanceMonitoring(
                modelValue as any,
                `${String(prop)}.${String(modelProp)}`
              );
            }
            
            return modelValue;
          },
        });
      }
      
      // 如果是方法（如$transaction）
      if (typeof value === 'function' && typeof prop === 'string' && prop.startsWith('$')) {
        return withPerformanceMonitoring(
          value as any,
          String(prop)
        );
      }
      
      return value;
    },
  });
  
  return monitoredClient;
}

// 获取性能统计信息
export function getPerformanceStats() {
  return {
    queries: { ...globalStats.queries },
    errors: { ...globalStats.errors },
    connections: { ...globalStats.connections },
  };
}

// 重置性能统计信息
export function resetPerformanceStats() {
  globalStats.queries = {
    totalQueries: 0,
    slowQueries: 0,
    averageQueryTime: 0,
    queryTimes: [],
    lastResetTime: Date.now(),
  };
  
  globalStats.errors = {
    totalErrors: 0,
    connectionErrors: 0,
    timeoutErrors: 0,
    lastErrorTime: undefined,
    lastError: undefined,
  };
}

// 数据库健康检查
export async function checkDatabaseHealth(client: PrismaClient): Promise<{
  isHealthy: boolean;
  responseTime: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    await client.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - startTime;
    
    return {
      isHealthy: true,
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      isHealthy: false,
      responseTime,
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

// 批量操作优化
export async function batchOperation<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  batchSize: number = 100,
  delay: number = 0
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    const batchResults = await Promise.all(
      batch.map(item => retryOperation(() => operation(item)))
    );
    
    results.push(...batchResults);
    
    // 在批次之间添加延迟，避免过载
    if (delay > 0 && i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return results;
}

// 定期性能报告
setInterval(() => {
  try {
    const stats = getPerformanceStats();
    
    console.log('=== 数据库性能统计 ===');
    console.log('查询统计:', {
      总查询数: stats.queries.totalQueries,
      慢查询数: stats.queries.slowQueries,
      平均查询时间: `${Math.round(stats.queries.averageQueryTime)}ms`,
      慢查询率: stats.queries.totalQueries > 0 
        ? `${((stats.queries.slowQueries / stats.queries.totalQueries) * 100).toFixed(2)}%`
        : '0%',
    });
    
    console.log('错误统计:', {
      总错误数: stats.errors.totalErrors,
      连接错误数: stats.errors.connectionErrors,
      超时错误数: stats.errors.timeoutErrors,
      最后错误时间: stats.errors.lastErrorTime 
        ? new Date(stats.errors.lastErrorTime).toLocaleString()
        : '无',
      最后错误: stats.errors.lastError || '无',
    });
    
    console.log('连接统计:', {
      活跃连接数: stats.connections.activeConnections,
      总连接数: stats.connections.totalConnections,
      最大连接数: stats.connections.maxConnections,
    });
    
    // 检查性能警告
    if (stats.queries.averageQueryTime > PERFORMANCE_CONFIG.slowQueryThreshold) {
      console.warn('⚠️ 平均查询时间超过阈值，建议优化查询');
    }
    
    if (stats.errors.totalErrors > 10) {
      console.warn('⚠️ 数据库错误数量过多，建议检查数据库状态');
    }
    
    const slowQueryRate = stats.queries.totalQueries > 0 
      ? (stats.queries.slowQueries / stats.queries.totalQueries) 
      : 0;
    
    if (slowQueryRate > 0.1) { // 超过10%的查询是慢查询
      console.warn('⚠️ 慢查询比例过高，建议优化数据库查询');
    }
    
  } catch (error) {
    console.error('性能统计报告生成失败:', error);
  }
}, PERFORMANCE_CONFIG.statsInterval);

// 导出配置
export { PERFORMANCE_CONFIG };