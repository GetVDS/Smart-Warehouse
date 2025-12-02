'use client';

import { memo, useCallback } from 'react';
import { Trash2, Check } from 'lucide-react';
import { Product } from '@/types';

interface ProductCardProps {
  product: Product;
  stockInputs: {[key: string]: {decrease: string, increase: string}};
  onStockInputChange: (id: string, field: 'decrease' | 'increase', value: string) => void;
  onStockUpdate: (id: string, field: 'increase' | 'decrease') => void;
  onDeleteProduct: (id: string, sku: string) => void;
  getStockStatus: (stock: number) => { status: string; color: string };
  getStockPercentage: (stock: number) => string;
}

export const ProductCard = memo<ProductCardProps>(({
  product,
  stockInputs,
  onStockInputChange,
  onStockUpdate,
  onDeleteProduct,
  getStockStatus,
  getStockPercentage
}) => {
  const stockStatus = getStockStatus(product.currentStock);
  const stockValue = product.currentStock * product.price;

  const handleInputChange = useCallback((field: 'decrease' | 'increase', value: string) => {
    onStockInputChange(product.id, field, value);
  }, [product.id, onStockInputChange]);

  const handleUpdate = useCallback((field: 'increase' | 'decrease') => {
    onStockUpdate(product.id, field);
  }, [product.id, onStockUpdate]);

  const handleDelete = useCallback(() => {
    onDeleteProduct(product.id, product.sku);
  }, [product.id, product.sku, onDeleteProduct]);

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        {product.sku}
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
        <div>
          <span className="font-medium">{product.currentStock}</span>
          <span className="text-xs text-gray-500 ml-2">
            ({getStockPercentage(product.currentStock)}%)
          </span>
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
        ₽{product.price.toFixed(2)}
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
        ₽{stockValue.toFixed(2)}
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${stockStatus.color}`}>
          {stockStatus.status}
        </span>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="出库数量"
              value={stockInputs[product.id]?.decrease || ''}
              onChange={(e) => handleInputChange('decrease', e.target.value)}
              className="w-32 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={() => handleUpdate('decrease')}
              className="p-1 bg-red-600 text-white rounded hover:bg-red-700"
              title="确认出库"
            >
              <Check className="h-3 w-3" />
            </button>
          </div>
          <div className="text-xs text-gray-500">
            总出库: {product.totalOut}
          </div>
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="入库数量"
              value={stockInputs[product.id]?.increase || ''}
              onChange={(e) => handleInputChange('increase', e.target.value)}
              className="w-32 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={() => handleUpdate('increase')}
              className="p-1 bg-green-600 text-white rounded hover:bg-green-700"
              title="确认入库"
            >
              <Check className="h-3 w-3" />
            </button>
          </div>
          <div className="text-xs text-gray-500">
            总入库: {product.totalIn}
          </div>
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm">
        <button
          onClick={handleDelete}
          className="text-red-600 hover:text-red-900"
          title="删除产品"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
});

ProductCard.displayName = 'ProductCard';