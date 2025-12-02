import { NextResponse } from 'next/server';
import { ensureAdminExists } from '@/lib/admin-init';

export async function POST() {
  try {
    await ensureAdminExists();
    
    return NextResponse.json({
      success: true,
      message: '管理员用户确保完成'
    });
  } catch (error) {
    console.error('确保管理员用户失败:', error);
    return NextResponse.json(
      { error: '确保管理员用户失败' },
      { status: 500 }
    );
  }
}