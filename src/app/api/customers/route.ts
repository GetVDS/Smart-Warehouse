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

// GET - 获取所有客户
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: '未认证' }, { status: 401 });
    }

    const customers = await db.customer.findMany({
      include: {
        _count: {
          select: {
            orders: {
              where: {
                status: 'confirmed'
              }
            },
            purchaseRecords: true
          }
        },
        purchaseRecords: {
          select: {
            totalAmount: true
          }
        },
        orders: {
          where: {
            status: 'confirmed'
          },
          select: {
            totalAmount: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 计算每个客户的总购买金额（包含已确认订单和购买记录）
    const customersWithTotalAmount = customers.map(customer => {
      const purchaseRecordsTotal = customer.purchaseRecords.reduce((sum, record) => sum + Number(record.totalAmount), 0);
      const confirmedOrdersTotal = customer.orders.reduce((sum, order) => sum + Number(order.totalAmount), 0);
      
      return {
        ...customer,
        totalAmount: purchaseRecordsTotal + confirmedOrdersTotal
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        customers: customersWithTotalAmount
      }
    });
  } catch (error) {
    console.error('Get customers error:', error);
    return NextResponse.json(
      { error: '获取客户失败' },
      { status: 500 }
    );
  }
}

// POST - 添加新客户
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: '未认证' }, { status: 401 });
    }

    const { name, phone } = await request.json();

    if (!name || !phone) {
      return NextResponse.json(
        { error: '客户姓名和手机号不能为空' },
        { status: 400 }
      );
    }

    // 检查客户手机号是否已存在
    const existingCustomer = await db.customer.findUnique({
      where: { phone }
    });

    if (existingCustomer) {
      return NextResponse.json(
        { error: '手机号已存在' },
        { status: 400 }
      );
    }

    // 创建新客户
    const customer = await db.customer.create({
      data: {
        name,
        phone
      },
      include: {
        _count: {
          select: {
            orders: true,
            purchaseRecords: true
          }
        }
      }
    });

    console.log('✅ 客户创建成功:', { id: customer.id, name: customer.name, phone: customer.phone });

    return NextResponse.json({
      success: true,
      data: {
        customer
      }
    });
  } catch (error) {
    console.error('Create customer error:', error);
    return NextResponse.json(
      { error: '创建客户失败' },
      { status: 500 }
    );
  }
}
