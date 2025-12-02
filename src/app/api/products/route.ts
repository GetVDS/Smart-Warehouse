import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, apiResponse, handleApiError, validateRequired } from '@/lib/api-utils';

// GET - 获取所有产品
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(apiResponse.unauthorized(), { status: 401 } as any);
    }

    // 优化查询：只选择需要的字段，添加缓存头
    const products = await db.product.findMany({
      select: {
        id: true,
        sku: true,
        currentStock: true,
        totalOut: true,
        totalIn: true,
        price: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    // 添加缓存头 - 缩短缓存时间以确保实时性
    const response = NextResponse.json(apiResponse.success({ products }) as any);
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return response;
  } catch (error) {
    return handleApiError(error, 'Get products') as any;
  }
}

// POST - 添加新产品
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(apiResponse.unauthorized(), { status: 401 } as any);
    }

    const { sku, initialStock, price } = await request.json();

    // 验证必填字段
    const validation = validateRequired({ sku, initialStock, price }, ['sku', 'initialStock', 'price']);
    if (!validation.isValid) {
      return NextResponse.json(apiResponse.error(validation.error || '验证失败'), { status: 400 } as any);
    }

    // 检查产品是否已存在
    const existingProduct = await db.product.findUnique({
      where: { sku }
    });

    if (existingProduct) {
      return NextResponse.json(apiResponse.error('产品款号已存在'), { status: 400 } as any);
    }

    // 创建新产品
    const product = await db.product.create({
      data: {
        sku,
        currentStock: parseInt(initialStock),
        totalIn: parseInt(initialStock),
        totalOut: 0,
        price: parseFloat(price)
      }
    });

    return NextResponse.json(apiResponse.success({ product }) as any);
  } catch (error) {
    return handleApiError(error, 'Create product') as any;
  }
}