#!/usr/bin/env node

/**
 * 智慧库存管理系统 - 嵌入式数据库初始化脚本
 * 用于Docker容器内的数据库初始化，解决模块导入问题
 */

const fs = require('fs');
const path = require('path');

// 模拟ES6模块导入的CommonJS版本
let PrismaClient, bcrypt;

async function loadDependencies() {
  try {
    // 尝试加载Prisma
    const prismaPath = path.join(process.cwd(), 'node_modules', '@prisma', 'client');
    if (fs.existsSync(prismaPath)) {
      const prisma = require('@prisma/client');
      PrismaClient = prisma.PrismaClient;
      console.log('✅ Prisma客户端加载成功');
    } else {
      throw new Error('Prisma客户端未找到');
    }

    // 尝试加载bcryptjs
    const bcryptPath = path.join(process.cwd(), 'node_modules', 'bcryptjs');
    if (fs.existsSync(bcryptPath)) {
      bcrypt = require('bcryptjs');
      console.log('✅ bcryptjs加载成功');
    } else {
      throw new Error('bcryptjs未找到');
    }
  } catch (error) {
    console.error('❌ 依赖加载失败:', error.message);
    process.exit(1);
  }
}

// 管理员信息
const ADMIN_INFO = {
  id: 'admin-user-001',
  phone: '79122706664',
  password: 'PRAISEJEANS.888',
  name: 'PRAISEJEANS管理员'
};

// 数据库初始化函数
async function initDatabase() {
  console.log('🚀 开始数据库初始化...');
  
  try {
    // 加载依赖
    await loadDependencies();
    
    // 创建Prisma客户端
    const prisma = new PrismaClient({
      log: ['error', 'warn']
    });
    
    console.log('📊 连接数据库...');
    
    // 测试数据库连接
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log('✅ 数据库连接成功');
    } catch (error) {
      console.error('❌ 数据库连接失败:', error.message);
      throw error;
    }
    
    // 检查并创建管理员用户
    console.log('👤 检查管理员用户...');
    
    try {
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
        
        // 验证密码是否正确
        const isPasswordCorrect = await bcrypt.compare(ADMIN_INFO.password, adminUser.password);
        
        if (!isPasswordCorrect) {
          console.log('🔄 管理员密码不正确，正在更新...');
          
          const hashedPassword = await bcrypt.hash(ADMIN_INFO.password, 10);
          adminUser = await prisma.user.update({
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

      console.log('📋 管理员信息:');
      console.log(`手机号: ${ADMIN_INFO.phone}`);
      console.log(`密码: ${ADMIN_INFO.password}`);
      
    } catch (error) {
      console.error('❌ 管理员用户操作失败:', error.message);
      throw error;
    }
    
    // 验证数据库完整性
    console.log('🔍 验证数据库完整性...');
    
    try {
      const userCount = await prisma.user.count();
      const customerCount = await prisma.customer.count();
      const productCount = await prisma.product.count();
      const orderCount = await prisma.order.count();
      
      console.log(`📊 数据库统计:`);
      console.log(`  用户数: ${userCount}`);
      console.log(`  客户数: ${customerCount}`);
      console.log(`  产品数: ${productCount}`);
      console.log(`  订单数: ${orderCount}`);
      
      console.log('✅ 数据库完整性验证通过');
      
    } catch (error) {
      console.warn('⚠️ 数据库完整性验证失败，但继续初始化:', error.message);
    }
    
    // 关闭数据库连接
    await prisma.$disconnect();
    
    console.log('🎉 数据库初始化完成！');
    
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    process.exit(1);
  }
}

// 执行初始化
if (require.main === module) {
  initDatabase().catch(error => {
    console.error('❌ 初始化过程中发生未捕获的错误:', error);
    process.exit(1);
  });
}

module.exports = { initDatabase };