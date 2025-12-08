import { db } from './db';
import { logger } from './logger';

// 查询性能监控
interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  rowCount?: number;
}

class QueryMonitor {
  public metrics: QueryMetrics[] = [];
  private maxMetrics = 100; // 保留最近100条查询记录

  recordQuery(query: string, duration: number, rowCount?: number): void {
    this.metrics.push({
      query,
      duration,
      timestamp: new Date(),
      rowCount
    });

    // 保持数组大小在限制内
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // 记录慢查询
    if (duration > 100) { // 超过100ms的查询
      logger.warn('慢查询检测', JSON.stringify({
        query,
        duration: `${duration}ms`,
        rowCount
      }));
    }
  }

  getSlowQueries(threshold: number = 100): QueryMetrics[] {
    return this.metrics.filter(m => m.duration > threshold);
  }

  getAverageQueryTime(): number {
    if (this.metrics.length === 0) return 0;
    const total = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    return total / this.metrics.length;
  }

  getMetricsSummary() {
    const slowQueries = this.getSlowQueries();
    return {
      totalQueries: this.metrics.length,
      slowQueries: slowQueries.length,
      averageQueryTime: this.getAverageQueryTime(),
      slowQueryRate: (slowQueries.length / this.metrics.length) * 100
    };
  }
}

const queryMonitor = new QueryMonitor();

// 增强的数据库查询包装器
export class OptimizedDB {
  // 带性能监控的查询执行
  static async executeQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>,
    options: {
      logSlowQueries?: boolean;
      slowQueryThreshold?: number;
    } = {}
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await queryFn();
      const duration = Date.now() - startTime;
      
      queryMonitor.recordQuery(queryName, duration);
      
      if (options.logSlowQueries !== false && duration > (options.slowQueryThreshold || 100)) {
        logger.warn('慢查询执行', JSON.stringify({
          query: queryName,
          duration: `${duration}ms`
        }));
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('查询执行失败', JSON.stringify({
        query: queryName,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error)
      }));
      throw error;
    }
  }

  // 优化的客户查询
  static async getCustomers(options: {
    page?: number;
    limit?: number;
    search?: string;
    includePurchaseTotals?: boolean;
  } = {}) {
    const { page = 1, limit = 50, search, includePurchaseTotals = true } = options;
    const skip = (page - 1) * limit;

    return this.executeQuery('getCustomers', async () => {
      // 基础查询条件
      const whereClause = search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } }
        ]
      } : {};

      if (includePurchaseTotals) {
        // 使用聚合查询获取购买总额
        const [customers, purchaseTotals] = await Promise.all([
          db.customer.findMany({
            where: whereClause,
            select: {
              id: true,
              name: true,
              phone: true,
              createdAt: true,
              updatedAt: true
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
          }),
          db.purchaseRecord.groupBy({
            by: ['customerId'],
            _sum: { totalAmount: true }
          })
        ]);

        // 创建购买金额映射
        const purchaseTotalMap = new Map(
          purchaseTotals.map(pt => [pt.customerId, pt._sum.totalAmount || 0])
        );

        // 组合数据
        return customers.map(customer => ({
          ...customer,
          totalAmount: Math.round(Number(purchaseTotalMap.get(customer.id) || 0))
        }));
      } else {
        // 简单查询，不包含购买总额
        return db.customer.findMany({
          where: whereClause,
          select: {
            id: true,
            name: true,
            phone: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        });
      }
    });
  }

  // 优化的产品查询
  static async getProducts(options: {
    page?: number;
    limit?: number;
    search?: string;
    lowStockThreshold?: number;
    includeStats?: boolean;
  } = {}) {
    const { page = 1, limit = 50, search, lowStockThreshold, includeStats = false } = options;
    const skip = (page - 1) * limit;

    return this.executeQuery('getProducts', async () => {
      // 构建查询条件
      const whereClause: any = {};
      
      if (search) {
        whereClause.OR = [
          { sku: { contains: search, mode: 'insensitive' } },
          // 注意：SQLite不支持全文搜索，这里简化处理
        ];
      }

      if (lowStockThreshold !== undefined) {
        whereClause.currentStock = { lte: lowStockThreshold };
      }

      const baseSelect = {
        id: true,
        sku: true,
        currentStock: true,
        totalOut: true,
        totalIn: true,
        price: true,
        createdAt: true,
        updatedAt: true
      };

      if (includeStats) {
        // 包含统计信息
        const [products, orderStats, purchaseStats] = await Promise.all([
          db.product.findMany({
            where: whereClause,
            select: baseSelect,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
          }),
          db.orderItem.groupBy({
            by: ['productId'],
            _sum: { quantity: true }
          }),
          db.purchaseRecord.groupBy({
            by: ['productId'],
            _sum: { quantity: true }
          })
        ]);

        // 创建统计映射
        const orderStatsMap = new Map(
          orderStats.map(os => [os.productId, os._sum.quantity || 0])
        );
        const purchaseStatsMap = new Map(
          purchaseStats.map(ps => [ps.productId, ps._sum.quantity || 0])
        );

        // 组合数据
        return products.map(product => ({
          ...product,
          totalOrdered: orderStatsMap.get(product.id) || 0,
          totalPurchased: purchaseStatsMap.get(product.id) || 0
        }));
      } else {
        // 简单查询
        return db.product.findMany({
          where: whereClause,
          select: baseSelect,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        });
      }
    });
  }

  // 优化的订单查询
  static async getOrders(options: {
    page?: number;
    limit?: number;
    customerId?: string;
    status?: string;
    includeItems?: boolean;
    includeCustomer?: boolean;
  } = {}) {
    const { page = 1, limit = 50, customerId, status, includeItems = false, includeCustomer = false } = options;
    const skip = (page - 1) * limit;

    return this.executeQuery('getOrders', async () => {
      // 构建查询条件
      const whereClause: any = {};
      
      if (customerId) {
        whereClause.customerId = customerId;
      }
      
      if (status) {
        whereClause.status = status;
      }

      const baseSelect = {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        note: true,
        createdAt: true,
        updatedAt: true,
        customerId: true
      };

      if (includeItems || includeCustomer) {
        // 包含关联数据
        const orders = await db.order.findMany({
          where: whereClause,
          select: {
            ...baseSelect,
            ...(includeItems && {
              OrderItem: {
                select: {
                  id: true,
                  quantity: true,
                  price: true,
                  productId: true,
                  Product: {
                    select: {
                      id: true,
                      sku: true
                    }
                  }
                }
              }
            }),
            ...(includeCustomer && {
              Customer: {
                select: {
                  id: true,
                  name: true,
                  phone: true
                }
              }
            })
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        });

        return orders;
      } else {
        // 简单查询
        return db.order.findMany({
          where: whereClause,
          select: baseSelect,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        });
      }
    });
  }

  // 批量操作优化
  static async batchUpdateStock(updates: Array<{
    productId: string;
    quantityChange: number;
  }>) {
    return this.executeQuery('batchUpdateStock', async () => {
      return db.$transaction(async (tx) => {
        const results = [];
        
        for (const update of updates) {
          const result = await tx.product.update({
            where: { id: update.productId },
            data: {
              currentStock: {
                increment: update.quantityChange
              },
              totalOut: update.quantityChange < 0 ? {
                increment: Math.abs(update.quantityChange)
              } : undefined,
              totalIn: update.quantityChange > 0 ? {
                increment: update.quantityChange
              } : undefined,
              updatedAt: new Date()
            }
          });
          results.push(result);
        }
        
        return results;
      });
    });
  }

  // 获取数据库统计信息
  static async getDatabaseStats() {
    return this.executeQuery('getDatabaseStats', async () => {
      const [customerCount, productCount, orderCount, lowStockCount] = await Promise.all([
        db.customer.count(),
        db.product.count(),
        db.order.count(),
        db.product.count({
          where: { currentStock: { lt: 10 } } // 库存少于10的产品
        })
      ]);

      return {
        customers: customerCount,
        products: productCount,
        orders: orderCount,
        lowStockProducts: lowStockCount,
        queryMetrics: queryMonitor.getMetricsSummary()
      };
    });
  }

  // 获取查询性能报告
  static getQueryPerformanceReport() {
    return queryMonitor.getMetricsSummary();
  }

  // 清理查询监控数据
  static clearQueryMetrics() {
    queryMonitor.metrics = [];
  }
}

// 缓存管理器
class CacheManager {
  private cache = new Map<string, {
    data: any;
    timestamp: Date;
    ttl: number;
  }>();

  set(key: string, data: any, ttl: number = 300000): void { // 默认5分钟
    this.cache.set(key, {
      data,
      timestamp: new Date(),
      ttl
    });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    const now = Date.now();
    if (now - item.timestamp.getTime() > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // 清理过期缓存
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp.getTime() > item.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

const cacheManager = new CacheManager();

// 定期清理缓存
setInterval(() => {
  cacheManager.cleanup();
}, 60000); // 每分钟清理一次

export { cacheManager };

// 缓存装饰器
export function cached(ttl: number = 300000) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${propertyName}_${JSON.stringify(args)}`;
      
      // 尝试从缓存获取
      const cachedResult = cacheManager.get(cacheKey);
      if (cachedResult !== null) {
        return cachedResult;
      }

      // 执行原方法
      const result = await method.apply(this, args);
      
      // 缓存结果
      cacheManager.set(cacheKey, result, ttl);
      
      return result;
    };

    return descriptor;
  };
}

// 导出优化的数据库实例
export const optimizedDB = OptimizedDB;