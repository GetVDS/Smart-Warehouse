import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    // 验证token
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    
    // 获取用户信息
    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        phone: true,
        name: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { error: '认证失败' },
      { status: 401 }
    );
  }
}