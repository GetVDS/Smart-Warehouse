'use client';

import { ProductCard } from '@/components/ProductCard';

interface ProductListProps {
  products: any[];
  stockInputs: {[key: string]: {decrease: string, increase: string}};
  onStockInputChange: (id: string, field: 'decrease' | 'increase', value: string) => void;
  onStockUpdate: (id: string, field: 'increase' | 'decrease') => void;
  onDeleteProduct: (id: string, sku: string) => void;
  getStockStatus: (stock: number) => { status: string; color: string };
  getStockPercentage: (stock: number) => string;
}

export function ProductList({ 
  products, 
  stockInputs, 
  onStockInputChange, 
  onStockUpdate, 
  onDeleteProduct,
  getStockStatus,
  getStockPercentage
}: ProductListProps) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                款号
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                库存
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                单价
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                价值
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                状态
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                出库
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                入库
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                stockInputs={stockInputs}
                onStockInputChange={onStockInputChange}
                onStockUpdate={onStockUpdate}
                onDeleteProduct={onDeleteProduct}
                getStockStatus={getStockStatus}
                getStockPercentage={getStockPercentage}
              />
            ))}
          </tbody>
        </table>
      </div>
      
      {products.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          暂无产品数据
        </div>
      )}
    </div>
  );
}