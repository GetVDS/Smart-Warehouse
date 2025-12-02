import { NextRequest, NextResponse } from 'next/server';
import { secureAuth, SECURITY_CONFIG, verifyJWT } from './security';

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
export async function withAuth(
  handler: (request: NextRequest, context?: any, userId?: string) => Promise<NextResponse>
) {
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

// 验证手机号格式（俄罗斯）
export function validateRussianPhone(phone: string): { isValid: boolean; error?: string } {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, error: '手机号不能为空' };
  }
  
  // 移除所有非数字字符
  const cleanPhone = phone.replace(/\D/g, '');
  
  // 俄罗斯手机号验证（通常为11位，以7、8或9开头）
  if (!/^[7-9]\d{10}$/.test(cleanPhone)) {
    return { isValid: false, error: '请输入有效的俄罗斯手机号（11位数字）' };
  }
  
  return { isValid: true };
}

// 验证产品SKU
export function validateProductSKU(sku: string): { isValid: boolean; error?: string } {
  if (!sku || typeof sku !== 'string') {
    return { isValid: false, error: '产品款号不能为空' };
  }
  
  if (sku.length < 2 || sku.length > 50) {
    return { isValid: false, error: '产品款号长度应在2-50个字符之间' };
  }
  
  // 检查是否包含非法字符
  if (!/^[a-zA-Z0-9\-_\u4e00-\u9fa5]+$/.test(sku)) {
    return { isValid: false, error: '产品款号只能包含字母、数字、连字符、下划线和中文字符' };
  }
  
  return { isValid: true };
}

// 验证价格
export function validatePrice(price: any): { isValid: boolean; error?: string; normalizedPrice?: number } {
  const numPrice = parseFloat(price);
  
  if (isNaN(numPrice)) {
    return { isValid: false, error: '价格必须是有效数字' };
  }
  
  if (numPrice < 0) {
    return { isValid: false, error: '价格不能为负数' };
  }
  
  if (numPrice > 999999.99) {
    return { isValid: false, error: '价格超出允许范围' };
  }
  
  return { 
    isValid: true, 
    normalizedPrice: Math.round(numPrice * 100) / 100 // 保留两位小数
  };
}

// 验证数量
export function validateQuantity(quantity: any): { isValid: boolean; error?: string; normalizedQuantity?: number } {
  const numQuantity = parseInt(quantity);
  
  if (isNaN(numQuantity)) {
    return { isValid: false, error: '数量必须是整数' };
  }
  
  if (numQuantity <= 0) {
    return { isValid: false, error: '数量必须大于0' };
  }
  
  if (numQuantity > 9999) {
    return { isValid: false, error: '数量超出允许范围' };
  }
  
  return { isValid: true, normalizedQuantity: numQuantity };
}

// 验证客户名称
export function validateCustomerName(name: string): { isValid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: '客户姓名不能为空' };
  }
  
  const trimmedName = name.trim();
  
  if (trimmedName.length < 2 || trimmedName.length > 100) {
    return { isValid: false, error: '客户姓名长度应在2-100个字符之间' };
  }
  
  // 检查是否包含非法字符
  if (!/^[\u4e00-\u9fa5a-zA-Z\s\-']+$/.test(trimmedName)) {
    return { isValid: false, error: '客户姓名只能包含中文、英文字母、空格、连字符和撇号' };
  }
  
  return { isValid: true };
}

// 验证订单备注
export function validateOrderNote(note: string): { isValid: boolean; error?: string; normalizedNote?: string } {
  if (!note) {
    return { isValid: true, normalizedNote: '' };
  }
  
  if (typeof note !== 'string') {
    return { isValid: false, error: '备注必须是字符串' };
  }
  
  const trimmedNote = note.trim();
  
  if (trimmedNote.length > 500) {
    return { isValid: false, error: '备注长度不能超过500个字符' };
  }
  
  return { isValid: true, normalizedNote: trimmedNote };
}

// 验证订单项
export function validateOrderItems(items: any[]): { isValid: boolean; error?: string; normalizedItems?: any[] } {
  if (!Array.isArray(items)) {
    return { isValid: false, error: '订单项必须是数组' };
  }
  
  if (items.length === 0) {
    return { isValid: false, error: '至少需要一个订单项' };
  }
  
  if (items.length > 50) {
    return { isValid: false, error: '订单项数量不能超过50个' };
  }
  
  const normalizedItems: any[] = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // 验证产品ID
    if (!item.productId || typeof item.productId !== 'string') {
      return { isValid: false, error: `第${i + 1}个订单项缺少有效的产品ID` };
    }
    
    // 验证数量
    const quantityResult = validateQuantity(item.quantity);
    if (!quantityResult.isValid) {
      return { isValid: false, error: `第${i + 1}个订单项数量无效: ${quantityResult.error}` };
    }
    
    normalizedItems.push({
      productId: item.productId,
      quantity: quantityResult.normalizedQuantity
    });
  }
  
  return { isValid: true, normalizedItems };
}

// 添加安全头的辅助函数
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // 添加安全相关的HTTP头
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // 在生产环境中添加HSTS头
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
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
) {
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
export function compose(...middlewares: Function[]) {
  return (handler: Function) => {
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