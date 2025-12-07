import { NextRequest, NextResponse } from 'next/server';
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
import { createErrorResponse, addSecurityHeaders, validateRequestBody } from './api-auth';
import { validateRequestMethod, validateContentType, validateRequestSize } from './security';

// 验证规则接口
export interface ValidationRule {
  field: string;
  required?: boolean;
  validator: (value: any) => { isValid: boolean; error?: string; normalizedValue?: any };
  sanitizer?: (value: any) => any;
}

// 验证模式接口
export interface ValidationSchema {
  body?: ValidationRule[];
  query?: ValidationRule[];
  params?: ValidationRule[];
  headers?: ValidationRule[];
}

// 验证中间件
export function withValidation(
  schema: ValidationSchema,
  handler: (request: NextRequest, context?: any, validatedData?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      const validatedData: any = {};
      
      // 验证请求方法
      const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      if (!validateRequestMethod(request, allowedMethods)) {
        const response = NextResponse.json(
          createErrorResponse('不支持的请求方法', 405),
          { status: 405 }
        );
        return addSecurityHeaders(response);
      }

      // 验证内容类型
      if (request.method !== 'GET' && request.method !== 'DELETE') {
        const allowedTypes = ['application/json', 'multipart/form-data', 'application/x-www-form-urlencoded'];
        if (!validateContentType(request, allowedTypes)) {
          const response = NextResponse.json(
            createErrorResponse('不支持的内容类型', 415),
            { status: 415 }
          );
          return addSecurityHeaders(response);
        }
      }

      // 验证请求大小
      if (!validateRequestSize(request, 10 * 1024 * 1024)) { // 10MB限制
        const response = NextResponse.json(
          createErrorResponse('请求体过大', 413),
          { status: 413 }
        );
        return addSecurityHeaders(response);
      }

      // 验证请求体
      if (schema.body) {
        let body: any = {};
        
        if (request.method !== 'GET' && request.method !== 'DELETE') {
          try {
            const contentType = request.headers.get('content-type') || '';
            
            if (contentType.includes('application/json')) {
              body = await request.json();
            } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
              const formData = await request.formData();
              body = Object.fromEntries(formData.entries());
            }
          } catch (error) {
            const response = NextResponse.json(
              createErrorResponse('请求体解析失败', 400),
              { status: 400 }
            );
            return addSecurityHeaders(response);
          }
        }

        const bodyValidation = validateFieldSet(body, schema.body, 'body');
        if (!bodyValidation.isValid) {
          const response = NextResponse.json(
            createErrorResponse(bodyValidation.error || '请求体验证失败', 400),
            { status: 400 }
          );
          return addSecurityHeaders(response);
        }
        
        validatedData.body = bodyValidation.data;
      }

      // 验证查询参数
      if (schema.query) {
        const { searchParams } = new URL(request.url);
        const query: any = {};
        
        for (const [key, value] of searchParams.entries()) {
          query[key] = value;
        }

        const queryValidation = validateFieldSet(query, schema.query, 'query');
        if (!queryValidation.isValid) {
          const response = NextResponse.json(
            createErrorResponse(queryValidation.error || '查询参数验证失败', 400),
            { status: 400 }
          );
          return addSecurityHeaders(response);
        }
        
        validatedData.query = queryValidation.data;
      }

      // 验证路径参数
      if (schema.params && context?.params) {
        const paramsValidation = validateFieldSet(context.params, schema.params, 'params');
        if (!paramsValidation.isValid) {
          const response = NextResponse.json(
            createErrorResponse(paramsValidation.error || '路径参数验证失败', 400),
            { status: 400 }
          );
          return addSecurityHeaders(response);
        }
        
        validatedData.params = paramsValidation.data;
      }

      // 验证请求头
      if (schema.headers) {
        const headers: any = {};
        request.headers.forEach((value, key) => {
          headers[key] = value;
        });

        const headersValidation = validateFieldSet(headers, schema.headers, 'headers');
        if (!headersValidation.isValid) {
          const response = NextResponse.json(
            createErrorResponse(headersValidation.error || '请求头验证失败', 400),
            { status: 400 }
          );
          return addSecurityHeaders(response);
        }
        
        validatedData.headers = headersValidation.data;
      }

      // 调用原始处理函数，传递验证后的数据
      return await handler(request, context, validatedData);
    } catch (error) {
      console.error('验证中间件错误:', error);
      const response = NextResponse.json(
        createErrorResponse('验证过程中发生错误', 500),
        { status: 500 }
      );
      return addSecurityHeaders(response);
    }
  };
}

// 验证字段集合
function validateFieldSet(
  data: any, 
  rules: ValidationRule[], 
  context: string
): { isValid: boolean; error?: string; data?: any } {
  const validatedData: any = {};
  const errors: string[] = [];

  for (const rule of rules) {
    const { field, required = false, validator, sanitizer } = rule;
    let value = data[field];

    // 检查必填字段
    if (required && (value === undefined || value === null || value === '')) {
      errors.push(`${context}.${field} 是必填字段`);
      continue;
    }

    // 如果字段不存在且不是必填，跳过验证
    if (value === undefined || value === null || value === '') {
      continue;
    }

    // 应用清理器
    if (sanitizer) {
      try {
        value = sanitizer(value);
      } catch (error) {
        errors.push(`${context}.${field} 清理失败: ${error}`);
        continue;
      }
    }

    // 应用验证器
    const validation = validator(value);
    if (!validation.isValid) {
      errors.push(`${context}.${field}: ${validation.error}`);
      continue;
    }

    // 使用标准化后的值
    validatedData[field] = validation.normalizedValue !== undefined ? validation.normalizedValue : value;
  }

  if (errors.length > 0) {
    return { isValid: false, error: errors.join('; ') };
  }

  return { isValid: true, data: validatedData };
}

// 常用验证模式
export const commonSchemas = {
  // 用户登录验证
  login: {
    body: [
      {
        field: 'phone',
        required: true,
        validator: validateRussianPhone
      },
      {
        field: 'password',
        required: true,
        validator: (value: string) => validateStringLength(value, 8, 128)
      }
    ]
  },

  // 产品创建验证
  createProduct: {
    body: [
      {
        field: 'sku',
        required: true,
        validator: validateProductSKU
      },
      {
        field: 'name',
        required: true,
        validator: (value: string) => validateStringLength(value, 2, 200)
      },
      {
        field: 'price',
        required: true,
        validator: validatePrice
      },
      {
        field: 'stock',
        required: true,
        validator: (value: any) => validateNumberRange(value, 0, 99999)
      }
    ]
  },

  // 客户创建验证
  createCustomer: {
    body: [
      {
        field: 'name',
        required: true,
        validator: validateCustomerName
      },
      {
        field: 'phone',
        required: true,
        validator: validateRussianPhone
      },
      {
        field: 'email',
        required: false,
        validator: validateEmail
      }
    ]
  },

  // 订单创建验证
  createOrder: {
    body: [
      {
        field: 'customerId',
        required: true,
        validator: validateId
      },
      {
        field: 'items',
        required: true,
        validator: validateOrderItems
      },
      {
        field: 'note',
        required: false,
        validator: validateOrderNote
      }
    ]
  },

  // ID参数验证
  idParam: {
    params: [
      {
        field: 'id',
        required: true,
        validator: validateId
      }
    ]
  },

  // 分页查询验证
  pagination: {
    query: [
      {
        field: 'page',
        required: false,
        validator: (value: any) => validateNumberRange(value, 1, 1000)
      },
      {
        field: 'limit',
        required: false,
        validator: (value: any) => validateNumberRange(value, 1, 100)
      },
      {
        field: 'search',
        required: false,
        validator: (value: string) => validateStringLength(value, 0, 100)
      }
    ]
  }
};

// 组合验证模式
export function combineSchemas(...schemas: ValidationSchema[]): ValidationSchema {
  return schemas.reduce((combined, schema) => {
    return {
      body: [...(combined.body || []), ...(schema.body || [])],
      query: [...(combined.query || []), ...(schema.query || [])],
      params: [...(combined.params || []), ...(schema.params || [])],
      headers: [...(combined.headers || []), ...(schema.headers || [])]
    };
  }, {} as ValidationSchema);
}

// 导出便捷函数
export const validateLogin = (handler: any) => withValidation(commonSchemas.login, handler);
export const validateCreateProduct = (handler: any) => withValidation(commonSchemas.createProduct, handler);
export const validateCreateCustomer = (handler: any) => withValidation(commonSchemas.createCustomer, handler);
export const validateCreateOrder = (handler: any) => withValidation(commonSchemas.createOrder, handler);
export const validateIdParam = (handler: any) => withValidation(commonSchemas.idParam, handler);
export const validatePagination = (handler: any) => withValidation(commonSchemas.pagination, handler);