import { generateTokenPair, refreshAccessToken, revokeRefreshToken, isTokenExpiringSoon } from './jwt-manager';

// 客户端认证管理类
export class ClientAuthManager {
  private static instance: ClientAuthManager;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenRefreshPromise: Promise<boolean> | null = null;

  private constructor() {
    this.loadTokensFromStorage();
  }

  static getInstance(): ClientAuthManager {
    if (!ClientAuthManager.instance) {
      ClientAuthManager.instance = new ClientAuthManager();
    }
    return ClientAuthManager.instance;
  }

  // 从本地存储加载令牌
  private loadTokensFromStorage(): void {
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('accessToken');
      this.refreshToken = localStorage.getItem('refreshToken');
    }
  }

  // 保存令牌到本地存储
  private saveTokensToStorage(): void {
    if (typeof window !== 'undefined') {
      if (this.accessToken) {
        localStorage.setItem('accessToken', this.accessToken);
      } else {
        localStorage.removeItem('accessToken');
      }
      
      if (this.refreshToken) {
        localStorage.setItem('refreshToken', this.refreshToken);
      } else {
        localStorage.removeItem('refreshToken');
      }
    }
  }

  // 设置令牌
  setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.saveTokensToStorage();
  }

  // 获取访问令牌
  getAccessToken(): string | null {
    return this.accessToken;
  }

  // 获取刷新令牌
  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  // 检查是否已认证
  isAuthenticated(): boolean {
    return !!this.accessToken && !!this.refreshToken;
  }

  // 检查令牌是否即将过期
  isTokenExpiringSoon(minutesThreshold: number = 5): boolean {
    if (!this.accessToken) {
      return true;
    }
    return isTokenExpiringSoon(this.accessToken, minutesThreshold);
  }

  // 自动刷新令牌
  async autoRefreshToken(): Promise<boolean> {
    // 如果已经在刷新中，返回现有的Promise
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    // 如果没有刷新令牌，无法刷新
    if (!this.refreshToken) {
      return false;
    }

    this.tokenRefreshPromise = this.doTokenRefresh();
    
    try {
      const result = await this.tokenRefreshPromise;
      return result;
    } finally {
      this.tokenRefreshPromise = null;
    }
  }

  // 执行令牌刷新
  private async doTokenRefresh(): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: this.refreshToken
        }),
      });

      if (!response.ok) {
        throw new Error('令牌刷新失败');
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        this.setTokens(data.data.accessToken, data.data.refreshToken);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('令牌刷新错误:', error);
      this.clearTokens();
      return false;
    }
  }

  // 获取有效的访问令牌（自动刷新如果需要）
  async getValidAccessToken(): Promise<string | null> {
    if (!this.accessToken) {
      return null;
    }

    // 如果令牌即将过期，尝试刷新
    if (this.isTokenExpiringSoon()) {
      const refreshed = await this.autoRefreshToken();
      if (!refreshed) {
        return null;
      }
    }

    return this.accessToken;
  }

  // 清除令牌
  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.saveTokensToStorage();
  }

  // 登出
  async logout(): Promise<void> {
    if (this.refreshToken) {
      try {
        await fetch('/api/auth/refresh', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            refreshToken: this.refreshToken
          }),
        });
      } catch (error) {
        console.error('撤销刷新令牌错误:', error);
      }
    }
    
    this.clearTokens();
  }

  // 为API请求添加认证头
  async addAuthHeader(headers: Record<string, string> = {}): Promise<Record<string, string>> {
    const token = await this.getValidAccessToken();
    
    if (token) {
      return {
        ...headers,
        'Authorization': `Bearer ${token}`
      };
    }
    
    return headers;
  }

  // 发起认证的API请求
  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = await this.addAuthHeader(options.headers as Record<string, string>);
    
    let response = await fetch(url, {
      ...options,
      headers
    });

    // 如果401错误，尝试刷新令牌并重试
    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this.autoRefreshToken();
      
      if (refreshed) {
        const newHeaders = await this.addAuthHeader(options.headers as Record<string, string>);
        response = await fetch(url, {
          ...options,
          headers: newHeaders
        });
      }
    }

    return response;
  }
}

// 导出单例实例
export const authManager = ClientAuthManager.getInstance();

// 导出便捷函数
export const setTokens = (accessToken: string, refreshToken: string) => authManager.setTokens(accessToken, refreshToken);
export const getAccessToken = () => authManager.getAccessToken();
export const isAuthenticated = () => authManager.isAuthenticated();
export const logout = () => authManager.logout();
export const authenticatedFetch = (url: string, options?: RequestInit) => authManager.authenticatedFetch(url, options);

// React Hook for authentication
export function useAuth() {
  return {
    isAuthenticated: isAuthenticated(),
    accessToken: getAccessToken(),
    setTokens,
    logout,
    refreshTokens: () => authManager.autoRefreshToken(),
    authenticatedFetch
  };
}