import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, createErrorResponse, createSuccessResponse } from '@/lib/api-auth';

// GET - 获取订单列表
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(createErrorResponse('未认证', 401), { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    // 构建查询条件
    const whereClause = customerId ? { customerId } : {};

    const orders = await db.order.findMany({
      where: whereClause,
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
                sku: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(createSuccessResponse({ orders }));
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json(
      { error: '获取订单失败' },
      { status: 500 }
    );
  }
}

// POST - 创建新订单
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: '未认证' }, { status: 401 });
    }

    const { customerId, items, note } = await request.json();

    if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(createErrorResponse('客户ID和订单项不能为空', 400), { status: 400 });
    }

    // 验证客户是否存在
    const customer = await db.customer.findUnique({
      where: { id: customerId }
    });

    if (!customer) {
      return NextResponse.json(createErrorResponse('客户不存在', 404), { status: 404 });
    }

    // 批量获取产品信息，避免N+1查询
    const productIds = items.map(item => item.productId);
    const products = await db.product.findMany({
      where: { id: { in: productIds } }
    });

    // 创建产品映射以便快速查找
    const productMap = new Map(products.map(p => [p.id, p]));

    // 计算总金额并验证产品
    let totalAmount = 0;
    const orderItems: Array<{
      productId: string;
      quantity: number;
      price: number;
    }> = [];

    for (const item of items) {
      const product = productMap.get(item.productId);

      if (!product) {
        return NextResponse.json(createErrorResponse(`产品ID ${item.productId} 不存在`, 404), { status: 404 });
      }

      if (product.currentStock < item.quantity) {
        return NextResponse.json(createErrorResponse(`产品 ${product.sku} 库存不足`, 400), { status: 400 });
      }

      const itemTotal = item.quantity * product.price;
      totalAmount += itemTotal;

      orderItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price: product.price
      });
    }

    // 获取下一个订单编号
    const lastOrder = await db.order.findFirst({
      orderBy: { orderNumber: 'desc' }
    });
    const nextOrderNumber = ((lastOrder as any)?.orderNumber || 0) + 1;

    // 使用事务创建订单
    const result = await db.$transaction(async (tx) => {
      // 创建订单
      const order = await tx.order.create({
        data: {
          orderNumber: nextOrderNumber,
          customerId,
          totalAmount,
          status: 'pending',
          orderItems: {
            create: orderItems
          },
          ...(note && { note }),
        } as any,
        include: {
          orderItems: {
            include: {
              product: {
                select: {
                  id: true,
                  sku: true
                }
              }
            }
          },
          customer: {
            select: {
              id: true,
              name: true,
              phone: true
            }
          }
        }
      });

      // 注意：创建订单时不减少库存，只在确认订单时减少库存

      return order;
    });

    return NextResponse.json(createSuccessResponse(result, '订单创建成功'));
  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json(createErrorResponse('创建订单失败', 500), { status: 500 });
  }
}