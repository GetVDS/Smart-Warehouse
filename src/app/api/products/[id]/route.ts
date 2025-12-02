import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/api-auth';

// 简单的响应格式
function createSuccessResponse(data?: any, message?: string) {
  return {
    success: true,
    data,
    message: message || '操作成功'
  };
}

function createErrorResponse(message: string, status: number = 400) {
  return {
    success: false,
    error: message,
    status
  };
}

function handleApiError(error: any, context: string) {
  console.error(`${context} error:`, error);
  return createErrorResponse(`${context}失败`, 500);
}

// DELETE - 删除产品
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(createErrorResponse('未授权访问', 401), { status: 401 });
    }

    const { id } = await params;
    const product = await db.product.findUnique({
      where: { id }
    });

    if (!product) {
      return NextResponse.json(createErrorResponse('产品不存在', 404), { status: 404 });
    }

    // 检查是否有订单项引用此产品
    const orderItems = await db.orderItem.findMany({
      where: { productId: id }
    });

    if (orderItems.length > 0) {
      return NextResponse.json(createErrorResponse('该产品被订单引用，无法删除', 400), { status: 400 });
    }

    // 使用事务处理删除操作，确保数据一致性
    await db.$transaction(async (tx) => {
      // 如果没有被引用，可以安全删除
      await tx.product.delete({
        where: { id }
      });
    });

    return NextResponse.json(createSuccessResponse(null, '产品删除成功'));
  } catch (error) {
    return handleApiError(error, 'Delete product') as any;
  }
}