import { NextRequest, NextResponse } from 'next/server';
import { secureAuth, SECURITY_CONFIG } from './security';
import { verifyJWT } from './jwt-manager';
import {
  validateRussianPhone,
  validateProductSKU,
  validatePrice,
  validateQuantity,
  validateCustomerName,
  validateOrderNote,
  validateOrderItems,
  validateEmail,
  validateURL,
  validateId,
  validateDate,
  validateBoolean,
  validateStringLength,
  validateNumberRange,
  validateArrayLength,
  validateEnum
} from './validators';

// 统一的API响应格式
export const createSuccessResponse = (data: any, message?: string) => ({
  success: true,
  data,
  message: message || '操作成功'
});

export const createErrorResponse = (message: string, status: number = 400) => ({
  success: false,
  error: message,
  status
});

// 安全的API认证中间件
export function withAuth(
  handler: (request: NextRequest, context?: any, userId?: string) => Promise<NextResponse>
): (request: NextRequest, context?: any) => Promise<NextResponse> {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      // 执行安全认证
      const authResult = await secureAuth(request);
      
      if (!authResult.isValid) {
        return NextResponse.json(
          createErrorResponse(authResult.error || '认证失败', authResult.statusCode || 401),
          { status: authResult.statusCode || 401 }
        );
      }
      
      // 调用原始处理函数，并传递用户ID
      return await handler(request, context, authResult.userId);
    } catch (error) {
      console.error('API认证中间件错误:', error);
      return NextResponse.json(
        createErrorResponse('服务器内部错误', 500),
        { status: 500 }
      );
    }
  };
}

// 验证请求体的辅助函数
export function validateRequestBody(body: any, requiredFields: string[]): { isValid: boolean; error?: string } {
  if (!body || typeof body !== 'object') {
    return { isValid: false, error: '请求体格式无效' };
  }
  
  const missingFields = requiredFields.filter(field => !body[field]);
  if (missingFields.length > 0) {
    return { 
      isValid: false, 
      error: `缺少必填字段: ${missingFields.join(', ')}` 
    };
  }
  
  return { isValid: true };
}


// 添加安全头的辅助函数
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // 添加安全相关的HTTP头
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // 设置Content Security Policy - 根据环境调整安全级别
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const cspDirectives = [
    "default-src 'self'",
    isDevelopment
      ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
      : "script-src 'self'",
    "style-src 'self' 'unsafe-inline'", // 允许内联样式（Tailwind需要）
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss:", // 允许WebSocket连接
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "require-trusted-types-for 'script'" // 启用可信类型
  ].join('; ');
  
  response.headers.set('Content-Security-Policy', cspDirectives);
  
  // 在生产环境中添加HSTS头
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // 添加其他安全头
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  
  return response;
}

// 创建带有安全头的响应
export function createSecureResponse(data: any, status: number = 200): NextResponse {
  const response = NextResponse.json(data, { status });
  return addSecurityHeaders(response);
}

// 错误处理包装器
export function withErrorHandler(
  handler: (request: NextRequest, context?: any, userId?: string) => Promise<NextResponse>
): (request: NextRequest, context?: any) => Promise<NextResponse> {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (error) {
      console.error('API处理错误:', error);
      
      // 根据错误类型返回不同的响应
      if (error instanceof Error) {
        // 开发环境返回详细错误信息
        const errorMessage = process.env.NODE_ENV === 'development'
          ? error.message
          : '服务器内部错误';
          
        return createSecureResponse(
          createErrorResponse(errorMessage, 500),
          500
        );
      }
      
      return createSecureResponse(
        createErrorResponse('未知错误', 500),
        500
      );
    }
  };
}

// 组合多个中间件
export function compose(
  ...middlewares: ((handler: (request: NextRequest, context?: any) => Promise<NextResponse>) => (request: NextRequest, context?: any) => Promise<NextResponse>)[]
) {
  return (handler: (request: NextRequest, context?: any) => Promise<NextResponse>) => {
    return middlewares.reduceRight((acc, middleware) => {
      return middleware(acc);
    }, handler);
  };
}

// 导出常用的中间件组合
export const secureHandler = compose(withErrorHandler, withAuth);

// 创建兼容的verifyAuth函数
export async function verifyAuth(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value;
  if (!token) {
    return null;
  }

  try {
    const decoded = verifyJWT(token);
    return decoded;
  } catch (error) {
    return null;
  }
}

// 重新导出所有验证函数以保持向后兼容
export {
  validateRussianPhone,
  validateProductSKU,
  validatePrice,
  validateQuantity,
  validateCustomerName,
  validateOrderNote,
  validateOrderItems,
  validateEmail,
  validateURL,
  validateId,
  validateDate,
  validateBoolean,
  validateStringLength,
  validateNumberRange,
  validateArrayLength,
  validateEnum
};