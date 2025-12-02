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

// GET - 获取单个客户详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: '未认证' }, { status: 401 });
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: '客户ID不能为空' },
        { status: 400 }
      );
    }

    // 获取客户详情，包括订单和购买记录的数量
    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            orders: true,
            purchaseRecords: true
          }
        }
      }
    });

    if (!customer) {
      return NextResponse.json(
        { error: '客户不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      customer
    });
  } catch (error) {
    console.error('Get customer error:', error);
    return NextResponse.json(
      { error: '获取客户详情失败' },
      { status: 500 }
    );
  }
}

// PUT - 更新客户信息
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: '未认证' }, { status: 401 });
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: '客户ID不能为空' },
        { status: 400 }
      );
    }

    const { name, phone } = await request.json();

    if (!name || !phone) {
      return NextResponse.json(
        { error: '客户姓名和手机号不能为空' },
        { status: 400 }
      );
    }

    // 俄罗斯手机号校验（通常为11位数字，以7、8或9开头）
    const phoneRegex = /^[7-9]\d{10}$/;
    if (!phoneRegex.test(phone.replace(/\D/g, ''))) {
      return NextResponse.json(
        { error: '请输入有效的俄罗斯手机号（11位数字）' },
        { status: 400 }
      );
    }

    // 检查客户是否存在
    const existingCustomer = await db.customer.findUnique({
      where: { id }
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: '客户不存在' },
        { status: 404 }
      );
    }

    // 检查手机号是否已被其他客户使用
    const phoneExists = await db.customer.findFirst({
      where: {
        phone,
        id: { not: id }
      }
    });

    if (phoneExists) {
      return NextResponse.json(
        { error: '手机号已被其他客户使用' },
        { status: 400 }
      );
    }

    // 更新客户信息
    const updatedCustomer = await db.customer.update({
      where: { id },
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

    console.log('✅ 客户更新成功:', { id: updatedCustomer.id, name: updatedCustomer.name, phone: updatedCustomer.phone });

    return NextResponse.json({
      success: true,
      customer: updatedCustomer
    });
  } catch (error) {
    console.error('Update customer error:', error);
    return NextResponse.json(
      { error: '更新客户失败' },
      { status: 500 }
    );
  }
}

// DELETE - 删除客户
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: '未认证' }, { status: 401 });
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: '客户ID不能为空' },
        { status: 400 }
      );
    }

    // 检查客户是否存在
    const existingCustomer = await db.customer.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            orders: true,
            purchaseRecords: true
          }
        }
      }
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: '客户不存在' },
        { status: 404 }
      );
    }

    // 使用事务处理删除操作，确保数据一致性
    await db.$transaction(async (tx) => {
      // 获取客户的所有订单
      const orders = await tx.order.findMany({
        where: { customerId: id },
        include: { orderItems: true }
      });

      // 删除所有订单项
      for (const order of orders) {
        await tx.orderItem.deleteMany({
          where: { orderId: order.id }
        });
      }

      // 删除所有订单
      await tx.order.deleteMany({
        where: { customerId: id }
      });

      // 删除所有购买记录
      await tx.purchaseRecord.deleteMany({
        where: { customerId: id }
      });

      // 最后删除客户
      await tx.customer.delete({
        where: { id }
      });
    });

    console.log('✅ 客户删除成功:', { id, name: existingCustomer.name });

    return NextResponse.json({
      success: true,
      message: '客户及其相关数据删除成功'
    });
  } catch (error) {
    console.error('Delete customer error:', error);
    return NextResponse.json(
      { error: '删除客户失败，请重试' },
      { status: 500 }
    );
  }
}