import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 验证认证的辅助函数
export async function verifyAuth(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value;
  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return decoded;
  } catch (error) {
    return null;
  }
}

// API响应辅助函数
export const apiResponse = {
  success: (data: any, message?: string) => ({
    success: true,
    data,
    message: message || '操作成功'
  }),
  
  error: (message: string) => ({
    success: false,
    error: message
  }),
  
  unauthorized: () => ({
    success: false,
    error: '未认证'
  }),
  
  notFound: (resource: string = '资源') => ({
    success: false,
    error: `${resource}不存在`
  }),
  
  serverError: (message: string = '服务器内部错误') => ({
    success: false,
    error: message
  })
};

// 处理API错误的统一函数
export const handleApiError = (error: any, context: string) => {
  console.error(`${context} error:`, error);
  return apiResponse.serverError(`${context}失败`);
};

// 验证必填字段
export const validateRequired = (data: any, fields: string[]) => {
  const missing = fields.filter(field => !data[field]);
  if (missing.length > 0) {
    return {
      isValid: false,
      error: `缺少必填字段: ${missing.join(', ')}`
    };
  }
  return { isValid: true, error: undefined };
};