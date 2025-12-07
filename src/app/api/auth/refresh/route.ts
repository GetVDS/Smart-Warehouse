import { NextRequest, NextResponse } from 'next/server';
import { refreshAccessToken, revokeRefreshToken } from '@/lib/jwt-manager';
import { createSuccessResponse, createErrorResponse, addSecurityHeaders } from '@/lib/api-auth';
import { SECURITY_CONFIG } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = await request.json();

    // 验证输入
    if (!refreshToken) {
      const response = NextResponse.json(
        createErrorResponse('刷新令牌不能为空', 400),
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // 尝试刷新访问令牌
    const tokenPair = refreshAccessToken(refreshToken);
    
    if (!tokenPair) {
      const response = NextResponse.json(
        createErrorResponse('刷新令牌无效或已过期', 401),
        { status: 401 }
      );
      return addSecurityHeaders(response);
    }

    // 撤销旧的刷新令牌
    revokeRefreshToken(refreshToken);

    const responseData = createSuccessResponse({
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      expiresIn: tokenPair.expiresIn
    }, '令牌刷新成功');

    const response = NextResponse.json(responseData);

    // 设置新的访问令牌
    response.cookies.set('auth-token', tokenPair.accessToken, {
      httpOnly: true,
      secure: SECURITY_CONFIG.SECURE_COOKIES,
      sameSite: 'lax',
      maxAge: tokenPair.expiresIn,
      path: '/',
    });

    return addSecurityHeaders(response);
  } catch (error) {
    console.error('Token refresh error:', error);
    
    const response = NextResponse.json(
      createErrorResponse('令牌刷新失败，请稍后重试', 500),
      { status: 500 }
    );
    return addSecurityHeaders(response);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { refreshToken } = await request.json();

    // 验证输入
    if (!refreshToken) {
      const response = NextResponse.json(
        createErrorResponse('刷新令牌不能为空', 400),
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // 撤销刷新令牌
    const revoked = revokeRefreshToken(refreshToken);
    
    if (!revoked) {
      const response = NextResponse.json(
        createErrorResponse('刷新令牌无效', 400),
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    const responseData = createSuccessResponse(null, '刷新令牌已撤销');
    
    const response = NextResponse.json(responseData);

    // 清除访问令牌cookie
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: SECURITY_CONFIG.SECURE_COOKIES,
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return addSecurityHeaders(response);
  } catch (error) {
    console.error('Token revoke error:', error);
    
    const response = NextResponse.json(
      createErrorResponse('令牌撤销失败，请稍后重试', 500),
      { status: 500 }
    );
    return addSecurityHeaders(response);
  }
}