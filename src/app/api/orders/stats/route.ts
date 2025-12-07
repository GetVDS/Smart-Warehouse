import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 验证认证的辅助函数
async function verifyAuth(request: NextRequest) {
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

// POST - 获取订单统计数据
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: '未认证' }, { status: 401 });
    }

    const { startDate, endDate } = await request.json();

    // 获取指定时间范围内的订单统计
    const orders = await db.order.findMany({
      where: {
        createdAt: {
          gte: startDate ? new Date(startDate) : undefined,
          lt: endDate ? new Date(endDate) : undefined
        },
        status: 'confirmed'
      }
    });

    // 获取订单项以便计算数量
    const orderIds = orders.map(order => order.id);
    const orderItems = await db.orderItem.findMany({
      where: { orderId: { in: orderIds } }
    });

    // 计算统计数据
    const totalAmount = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
    
    // 获取唯一客户数量
    const uniqueCustomers = new Set(orders.map(order => order.customerId));
    const customerCount = uniqueCustomers.size;

    return NextResponse.json({
      success: true,
      stats: {
        totalAmount,
        totalQuantity,
        customerCount
      }
    });
  } catch (error) {
    console.error('Get order stats error:', error);
    return NextResponse.json(
      { error: '获取统计数据失败' },
      { status: 500 }
    );
  }
}