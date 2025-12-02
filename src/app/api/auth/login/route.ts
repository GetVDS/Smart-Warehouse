import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { ensureAdminExists } from '@/lib/admin-init';
import {
  generateJWT,
  checkLoginAttempts,
  recordLoginAttempt,
  SECURITY_CONFIG
} from '@/lib/security';
import {
  createSuccessResponse,
  createErrorResponse,
  validateRussianPhone,
  addSecurityHeaders
} from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    // 首先确保管理员用户存在
    await ensureAdminExists();
    
    const { phone, password } = await request.json();

    // 验证输入
    if (!phone || !password) {
      const response = NextResponse.json(
        createErrorResponse('手机号和密码不能为空', 400),
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // 验证手机号格式
    const phoneValidation = validateRussianPhone(phone);
    if (!phoneValidation.isValid) {
      const response = NextResponse.json(
        createErrorResponse(phoneValidation.error || '手机号格式无效', 400),
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // 检查登录尝试次数
    const cleanPhone = phone.replace(/\D/g, '');
    const loginAttemptCheck = checkLoginAttempts(cleanPhone);
    
    if (!loginAttemptCheck.canAttempt) {
      const response = NextResponse.json(
        createErrorResponse(
          `登录尝试次数过多，请在${loginAttemptCheck.lockoutTime}分钟后重试`,
          429
        ),
        { status: 429 }
      );
      return addSecurityHeaders(response);
    }

    // 查找用户
    const user = await db.user.findUnique({
      where: { phone: cleanPhone }
    });

    if (!user) {
      // 记录失败的登录尝试
      recordLoginAttempt(cleanPhone, false);
      
      const response = NextResponse.json(
        createErrorResponse('用户名或密码错误', 401),
        { status: 401 }
      );
      return addSecurityHeaders(response);
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      // 记录失败的登录尝试
      recordLoginAttempt(cleanPhone, false);
      
      const response = NextResponse.json(
        createErrorResponse('用户名或密码错误', 401),
        { status: 401 }
      );
      return addSecurityHeaders(response);
    }

    // 记录成功的登录尝试
    recordLoginAttempt(cleanPhone, true);

    // 生成JWT token
    const token = generateJWT({
      userId: user.id,
      phone: user.phone
    });

    const responseData = createSuccessResponse({
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name
      }
    }, '登录成功');

    const response = NextResponse.json(responseData);

    // 设置安全的HTTP-only cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: SECURITY_CONFIG.SECURE_COOKIES,
      sameSite: 'lax',
      maxAge: SECURITY_CONFIG.SESSION_TIMEOUT_MS / 1000, // 转换为秒
      path: '/',
    });

    return addSecurityHeaders(response);
  } catch (error) {
    console.error('Login error:', error);
    
    const response = NextResponse.json(
      createErrorResponse('登录失败，请稍后重试', 500),
      { status: 500 }
    );
    return addSecurityHeaders(response);
  }
}