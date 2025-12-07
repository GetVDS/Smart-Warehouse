import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, createErrorResponse, createSuccessResponse } from '@/lib/api-auth';

// POST - 确认订单
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

    // 使用事务确认订单并更新库存
    const result = await db.$transaction(async (tx) => {
      // 更新订单状态
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: 'confirmed' }
      });

      // 获取订单项以便创建购买记录和更新库存
      const orderItems = await tx.orderItem.findMany({
        where: { orderId: orderId }
      });

      // 创建购买记录
      for (const item of orderItems) {
        await tx.purchaseRecord.create({
          data: {
            id: `purchase-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            customerId: order.customerId,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            totalAmount: item.quantity * item.price,
            purchaseDate: new Date()
          }
        });
      }

      // 更新产品库存
      for (const item of orderItems) {
        const currentProduct = await tx.product.findUnique({
          where: { id: item.productId }
        });
        
        if (currentProduct && currentProduct.currentStock >= item.quantity) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              currentStock: {
                decrement: item.quantity
              },
              totalOut: {
                increment: item.quantity
              }
            }
          });
        } else {
          throw new Error(`产品库存不足`);
        }
      }

      return updatedOrder;
    });

    // 获取更新后的完整订单数据
    const completeOrder = await db.order.findUnique({
      where: { id: orderId }
    });

    // 触发产品数据更新事件，确保产品管理页面的统计数据实时更新
    console.log('触发产品数据更新事件：订单确认后更新产品统计数据');
    
    const response = NextResponse.json(createSuccessResponse(completeOrder, '订单确认成功'));
    
    // 在响应中添加一个特殊的头部，前端可以监听到这个变化
    response.headers.set('X-Product-Data-Updated', 'true');
    
    return response;
  } catch (error) {
    console.error('Confirm order error:', error);
    return NextResponse.json(createErrorResponse('确认订单失败', 500), { status: 500 });
  }
}