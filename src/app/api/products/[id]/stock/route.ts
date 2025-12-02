import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, apiResponse, handleApiError } from '@/lib/api-utils';

// POST - 更新库存
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(apiResponse.unauthorized(), { status: 401 } as any);
    }

    const { increase, decrease } = await request.json();

    if (!increase && !decrease) {
      return NextResponse.json(apiResponse.error('请提供增加或减少的库存数量'), { status: 400 } as any);
    }

    const { id } = await params;
    const product = await db.product.findUnique({
      where: { id }
    });

    if (!product) {
      return NextResponse.json(apiResponse.notFound('产品'), { status: 404 } as any);
    }

    let updateData: any = {};

    if (increase && increase > 0) {
      updateData.currentStock = product.currentStock + increase;
      updateData.totalIn = product.totalIn + increase;
    }

    if (decrease && decrease > 0) {
      if (product.currentStock < decrease) {
        return NextResponse.json(apiResponse.error('库存不足'), { status: 400 } as any);
      }
      updateData.currentStock = product.currentStock - decrease;
      updateData.totalOut = product.totalOut + decrease;
    }

    const updatedProduct = await db.product.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json(apiResponse.success({ product: updatedProduct }) as any);
  } catch (error) {
    return handleApiError(error, 'Update stock') as any;
  }
}