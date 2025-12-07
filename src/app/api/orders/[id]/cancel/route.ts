import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, createErrorResponse, createSuccessResponse } from '@/lib/api-auth';

// POST - 取消订单
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(createErrorResponse('未认证', 401), { status: 401 });
    }

    const { id: orderId } = await params;

    // 获取订单详情
    const order = await db.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return NextResponse.json(createErrorResponse('订单不存在', 404), { status: 404 });
    }

    if (order.status !== 'pending') {
      return NextResponse.json(createErrorResponse('订单状态不正确', 400), { status: 400 });
    }

    // 更新订单状态为取消
    const updatedOrder = await db.order.update({
      where: { id: orderId },
      data: { status: 'cancelled' }
    });

    // 获取更新后的完整订单数据，确保所有关联信息都包含在内
    const completeOrder = await db.order.findUnique({
      where: { id: orderId }
    });

    return NextResponse.json(createSuccessResponse(completeOrder, '订单取消成功'));
  } catch (error) {
    console.error('Cancel order error:', error);
    return NextResponse.json(createErrorResponse('取消订单失败', 500), { status: 500 });
  }
}