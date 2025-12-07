import React, { useCallback, useRef, useEffect, useMemo } from 'react';

// 性能监控接口
interface PerformanceMetrics {
  renderTime: number;
  componentMountTime: number;
  apiCallTime: number;
  memoryUsage: number;
  timestamp: Date;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 50;

  recordRender(componentName: string, renderTime: number): void {
    this.metrics.push({
      renderTime,
      componentMountTime: 0,
      apiCallTime: 0,
      memoryUsage: this.getMemoryUsage(),
      timestamp: new Date()
    });

    this.cleanup();
    
    if (renderTime > 16) { // 超过16ms的渲染
      console.warn(`慢渲染检测: ${componentName} - ${renderTime}ms`);
    }
  }

  recordApiCall(apiName: string, duration: number): void {
    this.metrics.push({
      renderTime: 0,
      componentMountTime: 0,
      apiCallTime: duration,
      memoryUsage: this.getMemoryUsage(),
      timestamp: new Date()
    });

    this.cleanup();
    
    if (duration > 1000) { // 超过1秒的API调用
      console.warn(`慢API调用检测: ${apiName} - ${duration}ms`);
    }
  }

  recordComponentMount(componentName: string, mountTime: number): void {
    this.metrics.push({
      renderTime: 0,
      componentMountTime: mountTime,
      apiCallTime: 0,
      memoryUsage: this.getMemoryUsage(),
      timestamp: new Date()
    });

    this.cleanup();
    
    if (mountTime > 100) { // 超过100ms的组件挂载
      console.warn(`慢组件挂载检测: ${componentName} - ${mountTime}ms`);
    }
  }

  private getMemoryUsage(): number {
    if (typeof window !== 'undefined' && 'memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  private cleanup(): void {
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  getAverageRenderTime(): number {
    const renderMetrics = this.metrics.filter(m => m.renderTime > 0);
    if (renderMetrics.length === 0) return 0;
    const total = renderMetrics.reduce((sum, m) => sum + m.renderTime, 0);
    return total / renderMetrics.length;
  }

  getAverageApiCallTime(): number {
    const apiMetrics = this.metrics.filter(m => m.apiCallTime > 0);
    if (apiMetrics.length === 0) return 0;
    const total = apiMetrics.reduce((sum, m) => sum + m.apiCallTime, 0);
    return total / apiMetrics.length;
  }
}

const performanceMonitor = new PerformanceMonitor();

// React性能优化Hooks
export function usePerformanceOptimization() {
  const renderStartTime = useRef<number | undefined>();
  const componentName = useRef<string>('Unknown');

  const startRender = useCallback((name: string) => {
    componentName.current = name;
    renderStartTime.current = performance.now();
  }, []);

  const endRender = useCallback(() => {
    if (renderStartTime.current) {
      const renderTime = performance.now() - renderStartTime.current;
      performanceMonitor.recordRender(componentName.current, renderTime);
      renderStartTime.current = undefined;
    }
  }, []);

  return { startRender, endRender };
}

// 防抖Hook
export function useDebounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>();

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      func(...args);
    }, delay);
  }, [func, delay]) as T;
}

// 节流Hook
export function useThrottle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T {
  const lastCallRef = useRef<number>(0);

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCallRef.current >= delay) {
      lastCallRef.current = now;
      func(...args);
    }
  }, [func, delay]) as T;
}

// 虚拟滚动Hook
export function useVirtualScroll<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number
) {
  return useMemo(() => {
    const visibleCount = Math.ceil(containerHeight / itemHeight) + 1;
    const startIndex = Math.floor(0 / itemHeight); // 这里应该是scrollTop
    const endIndex = Math.min(startIndex + visibleCount, items.length);
    
    const visibleItems = items.slice(startIndex, endIndex);
    const offsetY = startIndex * itemHeight;
    
    return {
      visibleItems,
      offsetY,
      totalHeight: items.length * itemHeight
    };
  }, [items, itemHeight, containerHeight]);
}

// 懒加载Hook
export function useLazyLoad<T>(
  loadFunction: () => Promise<T[]>,
  dependencies: any[] = []
) {
  const [data, setData] = React.useState<T[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    
    setLoading(true);
    try {
      const newData = await loadFunction();
      setData(prev => [...prev, ...newData]);
      setHasMore(newData.length > 0);
    } catch (error) {
      console.error('懒加载失败:', error);
    } finally {
      setLoading(false);
    }
  }, [loadFunction, loading, hasMore]);

  useEffect(() => {
    setData([]);
    setHasMore(true);
    loadMore();
  }, dependencies);

  return { data, loading, hasMore, loadMore };
}

// 缓存Hook
export function useCache<T>(key: string, fetcher: () => Promise<T>, ttl: number = 300000) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(false);

  useEffect(() => {
    const cachedData = localStorage.getItem(key);
    
    if (cachedData) {
      try {
        const { data: cachedValue, timestamp } = JSON.parse(cachedData);
        const now = Date.now();
        
        if (now - timestamp < ttl) {
          setData(cachedValue);
          return;
        }
      } catch (error) {
        console.warn('缓存数据解析失败:', error);
      }
    }

    // 没有缓存或缓存过期，重新获取
    setLoading(true);
    fetcher()
      .then(result => {
        setData(result);
        localStorage.setItem(key, JSON.stringify({
          data: result,
          timestamp: Date.now()
        }));
      })
      .catch(error => {
        console.error('数据获取失败:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [key, fetcher, ttl]);

  const invalidateCache = useCallback(() => {
    localStorage.removeItem(key);
    setData(null);
  }, [key]);

  return { data, loading, invalidateCache };
}

// 图片懒加载Hook
export function useImageLazyLoad(src: string) {
  const [imageSrc, setImageSrc] = React.useState<string>('');
  const [loading, setLoading] = React.useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setLoading(true);
            const img = new Image();
            img.onload = () => {
              setImageSrc(src);
              setLoading(false);
            };
            img.onerror = () => {
              setLoading(false);
              console.warn('图片加载失败:', src);
            };
            img.src = src;
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, [src]);

  return { imageSrc, loading, imgRef };
}

// 批量状态更新Hook
export function useBatchUpdate<T>(initialState: T) {
  const [state, setState] = React.useState<T>(initialState);
  const pendingUpdates = useRef<Array<(prevState: T) => T>>([]);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>();

  const batchUpdate = useCallback((updater: (prevState: T) => T) => {
    pendingUpdates.current.push(updater);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setState(prevState => {
        let newState = prevState;
        pendingUpdates.current.forEach(update => {
          newState = update(newState);
        });
        pendingUpdates.current = [];
        return newState;
      });
    }, 0);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [state, batchUpdate] as const;
}

// 性能监控Hook
export function usePerformanceMonitor(componentName: string) {
  const mountTimeRef = useRef<number | undefined>();

  useEffect(() => {
    mountTimeRef.current = performance.now();
    
    return () => {
      if (mountTimeRef.current) {
        const mountTime = performance.now() - mountTimeRef.current;
        performanceMonitor.recordComponentMount(componentName, mountTime);
      }
    };
  }, [componentName]);

  const recordApiCall = useCallback((apiName: string, duration: number) => {
    performanceMonitor.recordApiCall(apiName, duration);
  }, []);

  return { recordApiCall };
}

// API调用优化包装器
export function optimizedApiCall<T>(
  apiCall: () => Promise<T>,
  apiName: string
): Promise<T> {
  const startTime = performance.now();
  
  return apiCall().then(result => {
    const duration = performance.now() - startTime;
    performanceMonitor.recordApiCall(apiName, duration);
    return result;
  }).catch(error => {
    const duration = performance.now() - startTime;
    performanceMonitor.recordApiCall(`${apiName} (failed)`, duration);
    throw error;
  });
}

// 导出性能监控器
export { performanceMonitor };

// 性能报告生成
export function generatePerformanceReport() {
  const metrics = performanceMonitor.getMetrics();
  const averageRenderTime = performanceMonitor.getAverageRenderTime();
  const averageApiCallTime = performanceMonitor.getAverageApiCallTime();
  
  return {
    summary: {
      totalMetrics: metrics.length,
      averageRenderTime: Math.round(averageRenderTime * 100) / 100,
      averageApiCallTime: Math.round(averageApiCallTime * 100) / 100,
      slowRenders: metrics.filter(m => m.renderTime > 16).length,
      slowApiCalls: metrics.filter(m => m.apiCallTime > 1000).length
    },
    details: metrics.slice(-10), // 最近10条记录
    recommendations: generateRecommendations(averageRenderTime, averageApiCallTime)
  };
}

// 性能建议生成
function generateRecommendations(avgRenderTime: number, avgApiTime: number): string[] {
  const recommendations: string[] = [];
  
  if (avgRenderTime > 16) {
    recommendations.push('考虑使用React.memo优化组件渲染');
    recommendations.push('检查是否有不必要的重新渲染');
    recommendations.push('考虑使用useMemo和useCallback优化计算');
  }
  
  if (avgApiTime > 500) {
    recommendations.push('优化API查询，考虑添加索引');
    recommendations.push('实现API响应缓存');
    recommendations.push('考虑使用分页减少数据传输');
  }
  
  if (avgRenderTime > 50) {
    recommendations.push('考虑使用虚拟滚动处理大列表');
    recommendations.push('检查是否有昂贵的计算在渲染中');
  }
  
  return recommendations;
}