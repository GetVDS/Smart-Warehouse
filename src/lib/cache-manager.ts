// 缓存策略管理
interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

interface CacheStats {
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  memoryUsage: number;
  itemCount: number;
}

class CacheManager {
  private cache = new Map<string, CacheItem<any>>();
  private stats: CacheStats = {
    totalHits: 0,
    totalMisses: 0,
    hitRate: 0,
    memoryUsage: 0,
    itemCount: 0
  };
  private maxSize: number;
  private cleanupInterval: NodeJS.Timeout | undefined;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
    this.startCleanup();
  }

  // 设置缓存项
  set<T>(key: string, data: T, ttl: number = 300000): void { // 默认5分钟
    // 如果缓存已满，删除最旧的项
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0
    };

    this.cache.set(key, item);
    this.updateStats();
  }

  // 获取缓存项
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.totalMisses++;
      this.updateStats();
      return null;
    }

    const now = Date.now();
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key);
      this.stats.totalMisses++;
      this.updateStats();
      return null;
    }

    item.hits++;
    this.stats.totalHits++;
    this.updateStats();
    return item.data;
  }

  // 删除缓存项
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.updateStats();
    }
    return deleted;
  }

  // 检查缓存项是否存在且未过期
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    const now = Date.now();
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  // 清空缓存
  clear(): void {
    this.cache.clear();
    this.stats = {
      totalHits: 0,
      totalMisses: 0,
      hitRate: 0,
      memoryUsage: 0,
      itemCount: 0
    };
  }

  // 获取缓存统计
  getStats(): CacheStats {
    return { ...this.stats };
  }

  // 清理过期项
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`清理了 ${keysToDelete.length} 个过期缓存项`);
      this.updateStats();
    }
  }

  // 淘汰最旧的项
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (item.timestamp < oldestTime) {
        oldestTime = item.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  // 更新统计信息
  private updateStats(): void {
    this.stats.itemCount = this.cache.size;
    this.stats.memoryUsage = this.calculateMemoryUsage();
    
    const total = this.stats.totalHits + this.stats.totalMisses;
    this.stats.hitRate = total > 0 ? (this.stats.totalHits / total) * 100 : 0;
  }

  // 计算内存使用量（估算）
  private calculateMemoryUsage(): number {
    let totalSize = 0;
    
    for (const [key, item] of this.cache.entries()) {
      // 简单估算：key长度 + 数据大小估算
      totalSize += key.length * 2; // Unicode字符
      totalSize += JSON.stringify(item.data).length * 2;
      totalSize += 64; // 对象开销
    }
    
    return totalSize;
  }

  // 启动定期清理
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // 每分钟清理一次
  }

  // 停止定期清理
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// 分层缓存管理器
class TieredCacheManager {
  private l1Cache: CacheManager; // 内存缓存
  private l2Cache: CacheManager; // 扩展内存缓存
  private persistentCache: CacheManager; // 持久化缓存（localStorage）

  constructor() {
    this.l1Cache = new CacheManager(100); // 100项快速缓存
    this.l2Cache = new CacheManager(500); // 500项中等缓存
    this.persistentCache = new CacheManager(1000); // 1000项持久化缓存
  }

  async get<T>(key: string): Promise<T | null> {
    // L1缓存查找
    let data = this.l1Cache.get<T>(key);
    if (data !== null) {
      return data;
    }

    // L2缓存查找
    data = this.l2Cache.get<T>(key);
    if (data !== null) {
      // 提升到L1缓存
      this.l1Cache.set(key, data, 60000); // 1分钟
      return data;
    }

    // 持久化缓存查找
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const cached = localStorage.getItem(`cache_${key}`);
        if (cached) {
          const { data: cachedData, timestamp, ttl } = JSON.parse(cached);
          const now = Date.now();
          
          if (now - timestamp < ttl) {
            // 提升到L1和L2缓存
            this.l1Cache.set(key, cachedData, 60000);
            this.l2Cache.set(key, cachedData, 300000); // 5分钟
            return cachedData;
          } else {
            // 删除过期的持久化缓存
            localStorage.removeItem(`cache_${key}`);
          }
        }
      } catch (error) {
        console.warn('持久化缓存读取失败:', error);
      }
    }

    return null;
  }

  async set<T>(key: string, data: T, ttl: number = 300000): Promise<void> {
    // 设置到所有缓存层
    this.l1Cache.set(key, data, Math.min(ttl, 60000)); // L1最多1分钟
    this.l2Cache.set(key, data, Math.min(ttl, 300000)); // L2最多5分钟

    // 持久化到localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const cacheItem = {
          data,
          timestamp: Date.now(),
          ttl
        };
        localStorage.setItem(`cache_${key}`, JSON.stringify(cacheItem));
      } catch (error) {
        console.warn('持久化缓存写入失败:', error);
      }
    }
  }

  async delete(key: string): Promise<void> {
    // 从所有缓存层删除
    this.l1Cache.delete(key);
    this.l2Cache.delete(key);

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(`cache_${key}`);
      } catch (error) {
        console.warn('持久化缓存删除失败:', error);
      }
    }
  }

  clear(): void {
    this.l1Cache.clear();
    this.l2Cache.clear();

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        // 清理所有缓存项（保留其他localStorage数据）
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('cache_')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
      } catch (error) {
        console.warn('持久化缓存清理失败:', error);
      }
    }
  }

  getStats(): {
    l1: CacheStats;
    l2: CacheStats;
    persistent: CacheStats;
  } {
    return {
      l1: this.l1Cache.getStats(),
      l2: this.l2Cache.getStats(),
      persistent: this.persistentCache.getStats()
    };
  }
}

// 缓存策略枚举
export enum CacheStrategy {
  MEMORY_ONLY = 'memory_only',
  TIERED = 'tiered',
  PERSISTENT = 'persistent',
  LRU = 'lru'
}

// 缓存工厂
export class CacheFactory {
  private static instances = new Map<CacheStrategy, TieredCacheManager | CacheManager>();

  static getInstance(strategy: CacheStrategy = CacheStrategy.TIERED): TieredCacheManager | CacheManager {
    if (!this.instances.has(strategy)) {
      switch (strategy) {
        case CacheStrategy.MEMORY_ONLY:
          this.instances.set(strategy, new CacheManager(1000));
          break;
        case CacheStrategy.TIERED:
          this.instances.set(strategy, new TieredCacheManager());
          break;
        case CacheStrategy.PERSISTENT:
          this.instances.set(strategy, new TieredCacheManager());
          break;
        default:
          this.instances.set(strategy, new TieredCacheManager());
      }
    }

    return this.instances.get(strategy)!;
  }

  static clearAll(): void {
    this.instances.forEach(instance => {
      if ('clear' in instance) {
        instance.clear();
      }
    });
  }
}

// 缓存装饰器
export function cached(strategy: CacheStrategy = CacheStrategy.TIERED, ttl: number = 300000) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${propertyName}_${JSON.stringify(args)}`;
      const cache = CacheFactory.getInstance(strategy);
      
      // 尝试从缓存获取
      if ('get' in cache) {
        const cachedResult = await (cache as TieredCacheManager).get(cacheKey);
        if (cachedResult !== null) {
          return cachedResult;
        }
      }

      // 执行原方法
      const result = await method.apply(this, args);
      
      // 缓存结果
      if ('set' in cache) {
        await (cache as TieredCacheManager).set(cacheKey, result, ttl);
      }
      
      return result;
    };

    return descriptor;
  };
}

// 默认缓存实例
export const defaultCache = CacheFactory.getInstance(CacheStrategy.TIERED);

// 缓存工具函数
export const cacheUtils = {
  // 生成缓存键
  generateKey: (prefix: string, ...args: any[]): string => {
    return `${prefix}_${args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join('_')}`;
  },

  // 缓存API响应
  cacheApiResponse: async <T>(
    apiCall: () => Promise<T>,
    key: string,
    ttl: number = 300000
  ): Promise<T> => {
    const cached = await defaultCache.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const result = await apiCall();
    await defaultCache.set(key, result, ttl);
    return result;
  },

  // 预热缓存
  warmup: async <T>(
    keys: string[],
    fetcher: (key: string) => Promise<T>,
    ttl: number = 300000
  ): Promise<void> => {
    const promises = keys.map(async (key) => {
      try {
        const data = await fetcher(key);
        await defaultCache.set(key, data, ttl);
      } catch (error) {
        console.warn(`缓存预热失败 ${key}:`, error);
      }
    });

    await Promise.all(promises);
  }
};

export { CacheManager, TieredCacheManager };