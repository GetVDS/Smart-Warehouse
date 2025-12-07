import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_INFO = {
  id: 'admin-user-001',
  phone: '79122706664',
  password: 'PRAISEJEANS.888',
  name: 'PRAISEJEANS管理员'
};

async function initAdmin() {
  try {
    console.log('正在初始化管理员用户...');
    
    // 检查管理员用户是否存在
    let adminUser = await prisma.user.findUnique({
      where: { phone: ADMIN_INFO.phone }
    });

    if (!adminUser) {
      console.log('🔧 管理员用户不存在，正在创建...');
      
      // 创建管理员用户
      const hashedPassword = await bcrypt.hash(ADMIN_INFO.password, 10);
      adminUser = await prisma.user.create({
        data: {
          id: ADMIN_INFO.id,
          phone: ADMIN_INFO.phone,
          password: hashedPassword,
          name: ADMIN_INFO.name,
          updatedAt: new Date()
        }
      });
      
      console.log('✅ 管理员用户创建成功');
    } else {
      console.log('✅ 管理员用户已存在');
    }

    console.log('管理员信息:');
    console.log(`手机号: ${ADMIN_INFO.phone}`);
    console.log(`密码: ${ADMIN_INFO.password}`);
    
  } catch (error) {
    console.error('❌ 初始化管理员用户失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

initAdmin();