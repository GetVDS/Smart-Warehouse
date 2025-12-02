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
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NODE_ENV === 'production'
      ? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001')
      : 'http://localhost:3001';
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
      errorMessage
    } = options;

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
};