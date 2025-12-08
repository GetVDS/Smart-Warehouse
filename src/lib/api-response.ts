import { NextResponse } from 'next/server';

// 统一API响应接口
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  status?: number;
  timestamp?: string;
  requestId?: string;
  code?: string;
  details?: any;
}

// 分页响应接口
export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// API错误类
export class ApiError extends Error {
  public statusCode: number;
  public code?: string;
  public details?: any;

  constructor(message: string, statusCode: number = 400, code?: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

// 创建成功响应
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  statusCode: number = 200
): NextResponse {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message: message || '操作成功',
    timestamp: new Date().toISOString()
  };

  return NextResponse.json(response, { status: statusCode });
}

// 创建分页响应
export function createPaginatedResponse<T>(
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  },
  message?: string
): NextResponse {
  const response: PaginatedResponse<T> = {
    success: true,
    data,
    pagination,
    message: message || '获取数据成功',
    timestamp: new Date().toISOString()
  };

  return NextResponse.json(response);
}

// 创建错误响应
export function createErrorResponse(
  error: string | ApiError,
  statusCode?: number
): NextResponse {
  let message: string;
  let code: string | undefined;
  let details: any;
  let status: number;

  if (error instanceof ApiError) {
    message = error.message;
    status = error.statusCode;
    code = error.code;
    details = error.details;
  } else {
    message = typeof error === 'string' ? error : '未知错误';
    status = statusCode || 500;
  }

  const response: ApiResponse = {
    success: false,
    error: message,
    status,
    code,
    details,
    timestamp: new Date().toISOString()
  };

  return NextResponse.json(response, { status });
}

// 常用错误响应
export const errorResponses = {
  badRequest: (message: string = '请求参数错误') => 
    createErrorResponse(new ApiError(message, 400, 'BAD_REQUEST')),
  
  unauthorized: (message: string = '未授权访问') => 
    createErrorResponse(new ApiError(message, 401, 'UNAUTHORIZED')),
  
  forbidden: (message: string = '禁止访问') => 
    createErrorResponse(new ApiError(message, 403, 'FORBIDDEN')),
  
  notFound: (message: string = '资源不存在') => 
    createErrorResponse(new ApiError(message, 404, 'NOT_FOUND')),
  
  methodNotAllowed: (message: string = '请求方法不允许') => 
    createErrorResponse(new ApiError(message, 405, 'METHOD_NOT_ALLOWED')),
  
  conflict: (message: string = '资源冲突') => 
    createErrorResponse(new ApiError(message, 409, 'CONFLICT')),
  
  unprocessableEntity: (message: string = '请求格式错误') => 
    createErrorResponse(new ApiError(message, 422, 'UNPROCESSABLE_ENTITY')),
  
  tooManyRequests: (message: string = '请求过于频繁') => 
    createErrorResponse(new ApiError(message, 429, 'TOO_MANY_REQUESTS')),
  
  internalServerError: (message: string = '服务器内部错误') => 
    createErrorResponse(new ApiError(message, 500, 'INTERNAL_SERVER_ERROR')),
  
  serviceUnavailable: (message: string = '服务不可用') => 
    createErrorResponse(new ApiError(message, 503, 'SERVICE_UNAVAILABLE'))
};

// API响应装饰器
export function withApiResponse(
  handler: (request: any, ...args: any[]) => Promise<NextResponse>
) {
  return async (request: any, ...args: any[]): Promise<NextResponse> => {
    try {
      // 生成请求ID
      const requestId = generateRequestId();
      
      // 添加请求ID到响应头
      const response = await handler(request, ...args);
      response.headers.set('X-Request-ID', requestId);
      
      return response;
    } catch (error) {
      console.error('API处理错误:', error);
      
      if (error instanceof ApiError) {
        return createErrorResponse(error);
      }
      
      return errorResponses.internalServerError(
        process.env.NODE_ENV === 'development' 
          ? (error as Error).message 
          : '服务器内部错误'
      );
    }
  };
}

// 生成请求ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 验证响应格式
export function validateApiResponse(response: any): boolean {
  if (typeof response !== 'object' || response === null) {
    return false;
  }
  
  if (!('success' in response)) {
    return false;
  }
  
  if (response.success && !('data' in response)) {
    return false;
  }
  
  if (!response.success && !('error' in response)) {
    return false;
  }
  
  return true;
}

// 标准化错误对象
export function standardizeError(error: any): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new ApiError(error.message, 500, 'INTERNAL_ERROR', {
      stack: error.stack
    });
  }
  
  return new ApiError('未知错误', 500, 'UNKNOWN_ERROR');
}