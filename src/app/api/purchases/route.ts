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

// GET - 获取购买记录列表
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: '未认证' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    // 构建查询条件
    const whereClause = customerId ? { customerId } : {};

    const purchaseRecords = await db.purchaseRecord.findMany({
      where: whereClause,
      orderBy: { purchaseDate: 'desc' }
    });

    // 获取相关的客户和产品信息
    const customerIds = [...new Set(purchaseRecords.map(record => record.customerId))];
    const productIds = [...new Set(purchaseRecords.map(record => record.productId))];

    const customers = await db.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true, phone: true }
    });

    const products = await db.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, sku: true }
    });

    // 创建映射以便快速查找
    const customerMap = new Map(customers.map(c => [c.id, c]));
    const productMap = new Map(products.map(p => [p.id, p]));

    // 组合数据
    const purchaseRecordsWithDetails = purchaseRecords.map(record => ({
      ...record,
      customer: customerMap.get(record.customerId),
      product: productMap.get(record.productId)
    }));

    return NextResponse.json({
      success: true,
      purchaseRecords: purchaseRecordsWithDetails
    });
  } catch (error) {
    console.error('Get purchase records error:', error);
    return NextResponse.json(
      { error: '获取购买记录失败' },
      { status: 500 }
    );
  }
}

// POST - 创建新购买记录
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: '未认证' }, { status: 401 });
    }

    const { customerId, productId, quantity, price, purchaseDate } = await request.json();

    if (!customerId || !productId || quantity === undefined || price === undefined) {
      return NextResponse.json(
        { error: '客户ID、产品ID、数量和价格不能为空' },
        { status: 400 }
      );
    }

    // 验证客户是否存在
    const customer = await db.customer.findUnique({
      where: { id: customerId }
    });

    if (!customer) {
      return NextResponse.json(
        { error: '客户不存在' },
        { status: 404 }
      );
    }

    // 验证产品是否存在
    const product = await db.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return NextResponse.json(
        { error: '产品不存在' },
        { status: 404 }
      );
    }

    // 计算总金额
    const totalAmount = Math.round(quantity * price);

    // 使用事务创建购买记录和更新库存
    const result = await db.$transaction(async (tx) => {
      // 创建购买记录
      const purchaseRecord = await tx.purchaseRecord.create({
        data: {
          id: `purchase-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          customerId,
          productId,
          quantity: parseInt(quantity),
          price: parseFloat(price),
          totalAmount: Math.round(quantity * price),
          purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date()
        }
      });

      // 获取客户和产品信息
      const [customerInfo, productInfo] = await Promise.all([
        tx.customer.findUnique({
          where: { id: customerId },
          select: { id: true, name: true, phone: true }
        }),
        tx.product.findUnique({
          where: { id: productId },
          select: { id: true, sku: true }
        })
      ]);

      // 组合数据
      const purchaseRecordWithDetails = {
        ...purchaseRecord,
        customer: customerInfo,
        product: productInfo
      };

      // 更新产品库存
      await tx.product.update({
        where: { id: productId },
        data: {
          currentStock: {
            decrement: parseInt(quantity)
          },
          totalOut: {
            increment: parseInt(quantity)
          }
        }
      });

      return purchaseRecordWithDetails;
    });

    return NextResponse.json({
      success: true,
      purchaseRecord: result
    });
  } catch (error) {
    console.error('Create purchase record error:', error);
    return NextResponse.json(
      { error: '创建购买记录失败' },
      { status: 500 }
    );
  }
}