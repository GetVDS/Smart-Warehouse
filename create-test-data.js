const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const db = new PrismaClient();

async function createTestData() {
  try {
    console.log('🔧 开始创建测试数据...');

    // 创建测试产品
    const products = [
      {
        id: 'product-001',
        sku: 'PJ-001',
        currentStock: 100,
        totalOut: 0,
        totalIn: 100,
        price: 299.99,
        updatedAt: new Date()
      },
      {
        id: 'product-002',
        sku: 'PJ-002',
        currentStock: 50,
        totalOut: 0,
        totalIn: 50,
        price: 399.99,
        updatedAt: new Date()
      },
      {
        id: 'product-003',
        sku: 'PJ-003',
        currentStock: 75,
        totalOut: 0,
        totalIn: 75,
        price: 199.99,
        updatedAt: new Date()
      }
    ];

    console.log('📦 创建产品...');
    for (const product of products) {
      await db.product.upsert({
        where: { id: product.id },
        update: product,
        create: product
      });
    }

    // 创建测试客户
    const customers = [
      {
        id: 'customer-001',
        name: '张三',
        phone: '13800138001',
        updatedAt: new Date()
      },
      {
        id: 'customer-002',
        name: '李四',
        phone: '13800138002',
        updatedAt: new Date()
      },
      {
        id: 'customer-003',
        name: '王五',
        phone: '13800138003',
        updatedAt: new Date()
      }
    ];

    console.log('👥 创建客户...');
    for (const customer of customers) {
      await db.customer.upsert({
        where: { id: customer.id },
        update: customer,
        create: customer
      });
    }

    // 创建测试订单
    const orders = [
      {
        id: 'order-001',
        orderNumber: 1001,
        customerId: 'customer-001',
        status: 'pending',
        totalAmount: 599.98,
        note: '测试订单1',
        updatedAt: new Date()
      },
      {
        id: 'order-002',
        orderNumber: 1002,
        customerId: 'customer-002',
        status: 'confirmed',
        totalAmount: 399.99,
        note: '测试订单2',
        updatedAt: new Date()
      }
    ];

    console.log('📋 创建订单...');
    for (const order of orders) {
      await db.order.upsert({
        where: { id: order.id },
        update: order,
        create: order
      });
    }

    // 创建订单项
    const orderItems = [
      {
        id: 'order-item-001',
        orderId: 'order-001',
        productId: 'product-001',
        quantity: 2,
        price: 299.99
      },
      {
        id: 'order-item-002',
        orderId: 'order-002',
        productId: 'product-002',
        quantity: 1,
        price: 399.99
      }
    ];

    console.log('📦 创建订单项...');
    for (const item of orderItems) {
      await db.orderItem.upsert({
        where: { id: item.id },
        update: item,
        create: item
      });
    }

    console.log('✅ 测试数据创建成功！');
    console.log('');
    console.log('📊 数据统计：');
    console.log(`- 产品数量: ${products.length}`);
    console.log(`- 客户数量: ${customers.length}`);
    console.log(`- 订单数量: ${orders.length}`);
    console.log(`- 订单项数量: ${orderItems.length}`);

  } catch (error) {
    console.error('❌ 创建测试数据失败:', error);
  } finally {
    await db.$disconnect();
  }
}

createTestData();