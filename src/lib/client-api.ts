import { showSuccess, showError } from './notification';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  showSuccessMessage?: boolean;
  successMessage?: string;
  showErrorMessage?: boolean;
  errorMessage?: string;
  cache?: boolean; // 新增缓存选项
}

class ApiClient {
  private baseUrl: string;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

  constructor() {
    // 使用环境变量配置API基础URL，确保生产环境和开发环境的一致性
    if (process.env.NODE_ENV === 'production') {
      // 生产环境使用当前域名或配置的API URL
      this.baseUrl = process.env.NEXT_PUBLIC_API_URL ||
        (typeof window !== 'undefined' ? window.location.origin : '');
    } else {
      // 开发环境使用配置的端口，统一为3000
      this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    }
  }

  private async request<T = any>(
    endpoint: string,
    options: ApiOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      body,
      headers = {},
      showSuccessMessage = false,
      successMessage,
      showErrorMessage = true,
      errorMessage,
      cache = false // 新增缓存选项
    } = options;

    // 检查缓存（仅对GET请求启用）
    if (method === 'GET' && cache) {
      const cacheKey = `${endpoint}${JSON.stringify(headers)}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        return cached.data;
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include', // 包含cookies
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // 缓存成功的GET请求响应
        if (method === 'GET' && cache) {
          const cacheKey = `${endpoint}${JSON.stringify(headers)}`;
          this.cache.set(cacheKey, { data, timestamp: Date.now() });
        }

        if (showSuccessMessage) {
          showSuccess(successMessage || data.message || '操作成功');
        }
        return data;
      } else {
        const errorMsg = data.error || '请求失败';
        if (showErrorMessage) {
          showError(errorMessage || errorMsg);
        }
        return { success: false, error: errorMsg };
      }
    } catch (error) {
      const errorMsg = '网络错误，请重试';
      if (showErrorMessage) {
        showError(errorMessage || errorMsg);
      }
      return { success: false, error: errorMsg };
    }
  }

  // 清除缓存的方法
  public clearCache(endpoint?: string) {
    if (endpoint) {
      this.cache.delete(endpoint);
    } else {
      this.cache.clear();
    }
  }

  // GET请求
  async get<T = any>(endpoint: string, options: Omit<ApiOptions, 'method'> = {}) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  // POST请求
  async post<T = any>(endpoint: string, body?: any, options: Omit<ApiOptions, 'method' | 'body'> = {}) {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  // PUT请求
  async put<T = any>(endpoint: string, body?: any, options: Omit<ApiOptions, 'method' | 'body'> = {}) {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  // DELETE请求
  async delete<T = any>(endpoint: string, options: Omit<ApiOptions, 'method' | 'body'> = {}) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

// 创建单例实例
export const apiClient = new ApiClient();

// 便捷方法
export const api = {
  get: <T = any>(endpoint: string, options?: Omit<ApiOptions, 'method'>) =>
    apiClient.get<T>(endpoint, options),
    
  post: <T = any>(endpoint: string, body?: any, options?: Omit<ApiOptions, 'method' | 'body'>) =>
    apiClient.post<T>(endpoint, body, options),
    
  put: <T = any>(endpoint: string, body?: any, options?: Omit<ApiOptions, 'method' | 'body'>) =>
    apiClient.put<T>(endpoint, body, options),
    
  delete: <T = any>(endpoint: string, options?: Omit<ApiOptions, 'method' | 'body'>) =>
    apiClient.delete<T>(endpoint, options),
    
  clearCache: (endpoint?: string) =>
    apiClient.clearCache(endpoint),
};