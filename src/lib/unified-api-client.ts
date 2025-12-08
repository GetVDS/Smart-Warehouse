import { showSuccess, showError } from './notification';
import { ApiResponse, PaginatedResponse } from './api-response';

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
  requireAuth?: boolean;
  showSuccessMessage?: boolean;
  successMessage?: string;
  showErrorMessage?: boolean;
  errorMessage?: string;
  cache?: boolean;
  timeout?: number;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class UnifiedApiClient {
  private baseUrl: string;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存
  private defaultTimeout = 30000; // 30秒默认超时

  constructor() {
    // 统一端口配置，消除硬编码
    if (process.env.NODE_ENV === 'production') {
      // 生产环境使用当前域名
      this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 
        (typeof window !== 'undefined' ? window.location.origin : '');
    } else {
      // 开发环境统一使用3000端口
      this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    }
  }

  // 获取认证令牌
  private async getAuthToken(): Promise<string | null> {
    // 从cookie获取token
    const token = document.cookie
      .split('; ')
      .find(row => row.startsWith('auth-token='))
      ?.split('=')[1];
    
    return token || null;
  }

  // 添加认证头
  private async addAuthHeaders(headers: Record<string, string>, requireAuth: boolean = false): Promise<Record<string, string>> {
    const newHeaders = { ...headers };
    
    if (requireAuth) {
      const token = await this.getAuthToken();
      if (token) {
        newHeaders.Authorization = `Bearer ${token}`;
      }
    }
    
    return newHeaders;
  }

  // 检查缓存
  private getCachedData<T>(cacheKey: string): T | null {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  // 设置缓存
  private setCachedData<T>(cacheKey: string, data: T): void {
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
  }

  // 处理响应
  private handleResponse<T>(response: ApiResponse<T>, options: ApiOptions): ApiResponse<T> {
    // 显示成功消息
    if (response.success && options.showSuccessMessage) {
      showSuccess(options.successMessage || response.message || '操作成功');
    }
    
    // 显示错误消息
    if (!response.success && options.showErrorMessage) {
      showError(options.errorMessage || response.error || '操作失败');
    }
    
    return response;
  }

  // 核心请求方法
  private async request<T = any>(
    endpoint: string,
    options: ApiOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      body,
      headers = {},
      requireAuth = false,
      showSuccessMessage = false,
      successMessage,
      showErrorMessage = true,
      errorMessage,
      cache = false,
      timeout = this.defaultTimeout
    } = options;

    // 构建缓存键（仅对GET请求启用缓存）
    if (method === 'GET' && cache) {
      const cacheKey = `${endpoint}${JSON.stringify(headers)}`;
      const cachedData = this.getCachedData<ApiResponse<T>>(cacheKey);
      if (cachedData) {
        return this.handleResponse(cachedData, options);
      }
    }

    try {
      // 添加认证头
      const authHeaders = await this.addAuthHeaders(headers, requireAuth);
      
      // 设置超时
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data: ApiResponse<T> = await response.json();

      // 缓存成功的GET请求响应
      if (response.ok && data.success && method === 'GET' && cache) {
        const cacheKey = `${endpoint}${JSON.stringify(headers)}`;
        this.setCachedData(cacheKey, data);
      }

      return this.handleResponse(data, options);
    } catch (error) {
      console.error('API请求错误:', error);
      
      let errorMessage = '网络错误，请重试';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = '请求超时，请重试';
        } else {
          errorMessage = error.message;
        }
      }
      
      const errorResponse: ApiResponse<T> = {
        success: false,
        error: options.errorMessage || errorMessage,
        timestamp: new Date().toISOString()
      };
      
      return this.handleResponse(errorResponse, options);
    }
  }

  // GET请求
  async get<T = any>(
    endpoint: string, 
    options: Omit<ApiOptions, 'method'> = {},
    pagination?: PaginationOptions
  ): Promise<ApiResponse<T>> {
    let url = endpoint;
    
    // 添加分页参数
    if (pagination) {
      const params = new URLSearchParams();
      if (pagination.page) params.append('page', pagination.page.toString());
      if (pagination.limit) params.append('limit', pagination.limit.toString());
      if (pagination.sortBy) params.append('sortBy', pagination.sortBy);
      if (pagination.sortOrder) params.append('sortOrder', pagination.sortOrder);
      
      const queryString = params.toString();
      url = queryString ? `${endpoint}?${queryString}` : endpoint;
    }
    
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  // POST请求
  async post<T = any>(
    endpoint: string, 
    body?: any, 
    options: Omit<ApiOptions, 'method' | 'body'> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  // PUT请求
  async put<T = any>(
    endpoint: string, 
    body?: any, 
    options: Omit<ApiOptions, 'method' | 'body'> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  // PATCH请求
  async patch<T = any>(
    endpoint: string, 
    body?: any, 
    options: Omit<ApiOptions, 'method' | 'body'> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  // DELETE请求
  async delete<T = any>(
    endpoint: string, 
    options: Omit<ApiOptions, 'method'> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  // 分页请求
  async getPaginated<T = any>(
    endpoint: string,
    pagination: PaginationOptions,
    options: Omit<ApiOptions, 'method'> = {}
  ): Promise<PaginatedResponse<T>> {
    const response = await this.get<T[]>(endpoint, options, pagination);
    
    if (response.success && Array.isArray(response.data)) {
      // 如果响应是数组但不是分页格式，转换为分页格式
      if (!('pagination' in response)) {
        return {
          ...response,
          pagination: {
            page: pagination.page || 1,
            limit: pagination.limit || 10,
            total: response.data.length,
            totalPages: Math.ceil(response.data.length / (pagination.limit || 10))
          }
        } as PaginatedResponse<T>;
      }
    }
    
    return response as PaginatedResponse<T>;
  }

  // 文件上传
  async uploadFile<T = any>(
    endpoint: string,
    file: File,
    options: Omit<ApiOptions, 'method' | 'body'> = {}
  ): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append('file', file);
    
    const headers = await this.addAuthHeaders(
      options.headers || {},
      options.requireAuth || false
    );
    
    // 移除Content-Type，让浏览器自动设置
    delete headers['Content-Type'];
    
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
        credentials: 'include'
      });
      
      const data: ApiResponse<T> = await response.json();
      return this.handleResponse(data, options);
    } catch (error) {
      console.error('文件上传错误:', error);
      
      const errorResponse: ApiResponse<T> = {
        success: false,
        error: options.errorMessage || '文件上传失败',
        timestamp: new Date().toISOString()
      };
      
      return this.handleResponse(errorResponse, options);
    }
  }

  // 批量请求
  async batch<T = any>(
    requests: Array<{ endpoint: string; options?: ApiOptions }>
  ): Promise<{ success: boolean; data?: T[]; error?: string; timestamp?: string }> {
    const promises = requests.map(({ endpoint, options = {} }) =>
      this.request<T>(endpoint, options)
    );
    
    try {
      const results = await Promise.all(promises);
      
      // 检查是否所有请求都成功
      const allSuccess = results.every(result => result.success);
      
      return {
        success: allSuccess,
        data: results.map(result => result.data).filter((data): data is T => data !== undefined),
        error: allSuccess ? undefined : '部分请求失败',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('批量请求错误:', error);
      
      return {
        success: false,
        error: '批量请求失败',
        timestamp: new Date().toISOString()
      };
    }
  }

  // 清除缓存
  public clearCache(endpoint?: string): void {
    if (endpoint) {
      // 清除特定端点的缓存
      for (const key of this.cache.keys()) {
        if (key.startsWith(endpoint)) {
          this.cache.delete(key);
        }
      }
    } else {
      // 清除所有缓存
      this.cache.clear();
    }
  }

  // 获取缓存统计
  public getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// 创建单例实例
export const apiClient = new UnifiedApiClient();

// 便捷方法导出
export const api = {
  // 基础请求方法
  get: <T = any>(endpoint: string, options?: Omit<ApiOptions, 'method'>, pagination?: PaginationOptions) =>
    pagination ? apiClient.getPaginated<T>(endpoint, pagination, options) : apiClient.get<T>(endpoint, options),
    
  post: <T = any>(endpoint: string, body?: any, options?: Omit<ApiOptions, 'method' | 'body'>) =>
    apiClient.post<T>(endpoint, body, options),
    
  put: <T = any>(endpoint: string, body?: any, options?: Omit<ApiOptions, 'method' | 'body'>) =>
    apiClient.put<T>(endpoint, body, options),
    
  patch: <T = any>(endpoint: string, body?: any, options?: Omit<ApiOptions, 'method' | 'body'>) =>
    apiClient.patch<T>(endpoint, body, options),
    
  delete: <T = any>(endpoint: string, options?: Omit<ApiOptions, 'method'>) =>
    apiClient.delete<T>(endpoint, options),
  
  // 特殊方法
  upload: <T = any>(endpoint: string, file: File, options?: Omit<ApiOptions, 'method' | 'body'>) =>
    apiClient.uploadFile<T>(endpoint, file, options),
    
  batch: <T = any>(requests: Array<{ endpoint: string; options?: ApiOptions }>) =>
    apiClient.batch<T>(requests),
  
  // 缓存管理
  clearCache: (endpoint?: string) => apiClient.clearCache(endpoint),
  getCacheStats: () => apiClient.getCacheStats(),
  
  // 认证相关方法
  getWithAuth: <T = any>(endpoint: string, options?: Omit<ApiOptions, 'method' | 'requireAuth'>) =>
    apiClient.get<T>(endpoint, { ...options, requireAuth: true }),
    
  postWithAuth: <T = any>(endpoint: string, body?: any, options?: Omit<ApiOptions, 'method' | 'body' | 'requireAuth'>) =>
    apiClient.post<T>(endpoint, body, { ...options, requireAuth: true }),
    
  putWithAuth: <T = any>(endpoint: string, body?: any, options?: Omit<ApiOptions, 'method' | 'body' | 'requireAuth'>) =>
    apiClient.put<T>(endpoint, body, { ...options, requireAuth: true }),
    
  deleteWithAuth: <T = any>(endpoint: string, options?: Omit<ApiOptions, 'method' | 'requireAuth'>) =>
    apiClient.delete<T>(endpoint, { ...options, requireAuth: true })
};

export default apiClient;