import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

// 硬编码的管理员信息
const ADMIN_INFO = {
  phone: '79122706664',
  password: 'PRAISEJEANS.888',
  name: 'PRAISEJEANS管理员'
};

export async function ensureAdminExists() {
  try {
    // 检查管理员用户是否存在
    let adminUser = await db.user.findUnique({
      where: { phone: ADMIN_INFO.phone }
    });

    if (!adminUser) {
      console.log('🔧 管理员用户不存在，正在创建...');
      
      // 创建管理员用户
      const hashedPassword = await bcrypt.hash(ADMIN_INFO.password, 10);
      adminUser = await db.user.create({
        data: {
          phone: ADMIN_INFO.phone,
          password: hashedPassword,
          name: ADMIN_INFO.name
        }
      });
      
      console.log('✅ 管理员用户创建成功');
    } else {
      // 验证密码是否正确
      const isPasswordCorrect = await bcrypt.compare(ADMIN_INFO.password, adminUser.password);
      
      if (!isPasswordCorrect) {
        console.log('🔄 管理员密码不正确，正在更新...');
        
        const hashedPassword = await bcrypt.hash(ADMIN_INFO.password, 10);
        adminUser = await db.user.update({
          where: { phone: ADMIN_INFO.phone },
          data: { 
            password: hashedPassword,
            name: ADMIN_INFO.name
          }
        });
        
        console.log('✅ 管理员密码更新成功');
      } else {
        console.log('✅ 管理员用户已存在且密码正确');
      }
    }

    return adminUser;
  } catch (error) {
    console.error('❌ 确保管理员用户失败:', error);
    throw error;
  }
}