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

// GET - 获取单个订单详情
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
        { error: '订单ID不能为空' },
        { status: 400 }
      );
    }

    // 获取订单详情
    const order = await db.order.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                price: true
              }
            }
          }
        }
      }
    });

    if (!order) {
      return NextResponse.json(
        { error: '订单不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Get order error:', error);
    return NextResponse.json(
      { error: '获取订单详情失败' },
      { status: 500 }
    );
  }
}

// DELETE - 删除订单
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
        { error: '订单ID不能为空' },
        { status: 400 }
      );
    }

    // 检查订单是否存在
    const existingOrder = await db.order.findUnique({
      where: { id },
      include: {
        orderItems: true
      }
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: '订单不存在' },
        { status: 404 }
      );
    }

    // 使用事务删除订单并恢复库存
    await db.$transaction(async (tx) => {
      // 恢复产品库存
      for (const item of existingOrder.orderItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: {
              increment: item.quantity
            },
            totalOut: {
              decrement: item.quantity
            }
          }
        });
      }

      // 先删除所有订单项
      await tx.orderItem.deleteMany({
        where: { orderId: id }
      });

      // 再删除订单
      await tx.order.delete({
        where: { id }
      });
    });

    return NextResponse.json({
      success: true,
      message: '订单删除成功'
    });
  } catch (error) {
    console.error('Delete order error:', error);
    return NextResponse.json(
      { error: '删除订单失败' },
      { status: 500 }
    );
  }
}

// PUT - 更新订单状态
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
    const { status } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: '订单ID不能为空' },
        { status: 400 }
      );
    }

    if (!status || !['pending', 'confirmed', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { error: '无效的订单状态' },
        { status: 400 }
      );
    }

    // 检查订单是否存在
    const existingOrder = await db.order.findUnique({
      where: { id }
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: '订单不存在' },
        { status: 404 }
      );
    }

    // 更新订单状态
    const updatedOrder = await db.order.update({
      where: { id },
      data: { status }
    });

    return NextResponse.json({
      success: true,
      order: updatedOrder
    });
  } catch (error) {
    console.error('Update order error:', error);
    return NextResponse.json(
      { error: '更新订单失败' },
      { status: 500 }
    );
  }
}