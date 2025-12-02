import { PrismaClient } from '@prisma/client';

// 数据库连接池配置
const DB_CONFIG = {
  // 连接池大小
  connectionLimit: 10,
  
  // 连接超时时间（毫秒）
  connectionTimeoutMillis: 10000,
  
  // 查询超时时间（毫秒）
  queryTimeoutMillis: 30000,
  
  // 空闲连接超时时间（毫秒）
  idleTimeoutMillis: 30000,
  
  // 最大重试次数
  maxRetries: 3,
  
  // 重试延迟（毫秒）
  retryDelayMillis: 1000,
  
  // 是否启用查询日志
  enableQueryLogging: process.env.NODE_ENV === 'development',
  
  // 慢查询阈值（毫秒）
  slowQueryThreshold: 1000,
};

// 全局Prisma实例
let globalPrisma: PrismaClient | null = null;

// 查询性能监控
const queryStats = {
  totalQueries: 0,
  slowQueries: 0,
  averageQueryTime: 0,
  queryTimes: [] as number[],
};

// 重试函数
async function retryOperation<T>(
  operation: () => Promise<T>,
  retries: number = DB_CONFIG.maxRetries,
  delay: number = DB_CONFIG.retryDelayMillis
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
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
function withQueryMonitoring<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  operationName: string
) {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now();
    
    try {
      const result = await fn(...args);
      const queryTime = Date.now() - startTime;
      
      // 更新统计信息
      queryStats.totalQueries++;
      queryStats.queryTimes.push(queryTime);
      
      // 只保留最近100次查询的时间
      if (queryStats.queryTimes.length > 100) {
        queryStats.queryTimes.shift();
      }
      
      // 计算平均查询时间
      queryStats.averageQueryTime = 
        queryStats.queryTimes.reduce((sum, time) => sum + time, 0) / queryStats.queryTimes.length;
      
      // 记录慢查询
      if (queryTime > DB_CONFIG.slowQueryThreshold) {
        queryStats.slowQueries++;
        console.warn(`慢查询检测 [${operationName}]: ${queryTime}ms`, {
          operationName,
          queryTime,
          threshold: DB_CONFIG.slowQueryThreshold,
        });
      }
      
      // 开发环境下记录所有查询
      if (DB_CONFIG.enableQueryLogging) {
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

// 创建优化的Prisma客户端
function createOptimizedPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: DB_CONFIG.enableQueryLogging ? ['query', 'error', 'warn'] : ['error'],
    // 错误格式化
    errorFormat: 'pretty',
  });
  
  // 包装常用方法以添加监控和重试
  const originalFindMany = client.product.findMany.bind(client.product);
  (client.product as any).findMany = withQueryMonitoring(
    (args: any) => retryOperation(() => originalFindMany(args)),
    'product.findMany'
  );
  
  const originalFindUnique = client.product.findUnique.bind(client.product);
  (client.product as any).findUnique = withQueryMonitoring(
    (args: any) => retryOperation(() => originalFindUnique(args)),
    'product.findUnique'
  );
  
  const originalFindFirst = client.product.findFirst.bind(client.product);
  (client.product as any).findFirst = withQueryMonitoring(
    (args: any) => retryOperation(() => originalFindFirst(args)),
    'product.findFirst'
  );
  
  const originalCreate = client.product.create.bind(client.product);
  (client.product as any).create = withQueryMonitoring(
    (args: any) => retryOperation(() => originalCreate(args)),
    'product.create'
  );
  
  const originalUpdate = client.product.update.bind(client.product);
  (client.product as any).update = withQueryMonitoring(
    (args: any) => retryOperation(() => originalUpdate(args)),
    'product.update'
  );
  
  const originalDelete = client.product.delete.bind(client.product);
  (client.product as any).delete = withQueryMonitoring(
    (args: any) => retryOperation(() => originalDelete(args)),
    'product.delete'
  );
  
  // 为其他模型添加类似的包装
  const models = ['customer', 'order', 'orderItem', 'purchaseRecord', 'user'] as const;
  
  models.forEach(model => {
    const modelClient = (client as any)[model];
    
    if (modelClient.findMany) {
      const originalFn = modelClient.findMany.bind(modelClient);
      modelClient.findMany = withQueryMonitoring(
        (args: any) => retryOperation(() => originalFn(args)),
        `${model}.findMany`
      );
    }
    
    if (modelClient.findUnique) {
      const originalFn = modelClient.findUnique.bind(modelClient);
      modelClient.findUnique = withQueryMonitoring(
        (args: any) => retryOperation(() => originalFn(args)),
        `${model}.findUnique`
      );
    }
    
    if (modelClient.findFirst) {
      const originalFn = modelClient.findFirst.bind(modelClient);
      modelClient.findFirst = withQueryMonitoring(
        (args: any) => retryOperation(() => originalFn(args)),
        `${model}.findFirst`
      );
    }
    
    if (modelClient.create) {
      const originalFn = modelClient.create.bind(modelClient);
      modelClient.create = withQueryMonitoring(
        (args: any) => retryOperation(() => originalFn(args)),
        `${model}.create`
      );
    }
    
    if (modelClient.update) {
      const originalFn = modelClient.update.bind(modelClient);
      modelClient.update = withQueryMonitoring(
        (args: any) => retryOperation(() => originalFn(args)),
        `${model}.update`
      );
    }
    
    if (modelClient.delete) {
      const originalFn = modelClient.delete.bind(modelClient);
      modelClient.delete = withQueryMonitoring(
        (args: any) => retryOperation(() => originalFn(args)),
        `${model}.delete`
      );
    }
    
    if (modelClient.deleteMany) {
      const originalFn = modelClient.deleteMany.bind(modelClient);
      modelClient.deleteMany = withQueryMonitoring(
        (args: any) => retryOperation(() => originalFn(args)),
        `${model}.deleteMany`
      );
    }
  });
  
  // 包装事务方法
  const originalTransaction = client.$transaction.bind(client);
  client.$transaction = withQueryMonitoring(
    (args: any) => retryOperation(() => originalTransaction(args)),
    'transaction'
  );
  
  return client;
}

// 获取数据库连接
export function getDb(): PrismaClient {
  if (!globalPrisma) {
    globalPrisma = createOptimizedPrismaClient();
    
    // 优雅关闭处理
    process.on('beforeExit', async () => {
      if (globalPrisma) {
        await globalPrisma.$disconnect();
        globalPrisma = null;
      }
    });
    
    process.on('SIGINT', async () => {
      if (globalPrisma) {
        await globalPrisma.$disconnect();
        globalPrisma = null;
      }
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      if (globalPrisma) {
        await globalPrisma.$disconnect();
        globalPrisma = null;
      }
      process.exit(0);
    });
  }
  
  return globalPrisma;
}

// 导出优化的数据库实例
export const db = getDb();

// 数据库健康检查
export async function checkDbHealth(): Promise<{
  isHealthy: boolean;
  responseTime: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    await db.$queryRaw`SELECT 1`;
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

// 获取查询统计信息
export function getQueryStats() {
  return { ...queryStats };
}

// 重置查询统计信息
export function resetQueryStats() {
  queryStats.totalQueries = 0;
  queryStats.slowQueries = 0;
  queryStats.averageQueryTime = 0;
  queryStats.queryTimes = [];
}

// 数据库连接池状态监控
export async function getConnectionPoolStatus(): Promise<{
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
}> {
  try {
    // Prisma不直接暴露连接池状态，这里提供一个模拟实现
    // 在实际生产环境中，可能需要使用数据库特定的查询来获取连接池状态
    const result = await db.$queryRaw`SELECT COUNT(*) as count FROM pragma_table_info('sqlite_master')`;
    
    return {
      activeConnections: 1, // 简化实现
      idleConnections: DB_CONFIG.connectionLimit - 1,
      totalConnections: DB_CONFIG.connectionLimit,
    };
  } catch (error) {
    console.error('获取连接池状态失败:', error);
    return {
      activeConnections: 0,
      idleConnections: 0,
      totalConnections: 0,
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

// 定期清理和监控
setInterval(async () => {
  try {
    // 检查数据库健康状态
    const health = await checkDbHealth();
    
    if (!health.isHealthy) {
      console.error('数据库健康检查失败:', health.error);
    }
    
    // 记录查询统计信息
    if (queryStats.totalQueries > 0) {
      console.log('数据库查询统计:', {
        totalQueries: queryStats.totalQueries,
        slowQueries: queryStats.slowQueries,
        averageQueryTime: Math.round(queryStats.averageQueryTime),
        slowQueryRate: `${((queryStats.slowQueries / queryStats.totalQueries) * 100).toFixed(2)}%`,
      });
    }
    
    // 获取连接池状态
    const poolStatus = await getConnectionPoolStatus();
    console.log('连接池状态:', poolStatus);
    
  } catch (error) {
    console.error('数据库监控检查失败:', error);
  }
}, 5 * 60 * 1000); // 每5分钟检查一次