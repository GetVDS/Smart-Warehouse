'use client';

import { ShoppingCart, Package, User } from 'lucide-react';

interface OrderStatsProps {
  stats: {
    totalAmount: number;
    totalQuantity: number;
    customerCount: number;
  };
}

export function OrderStats({ stats }: OrderStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center">
          <div className="flex-shrink-0 bg-blue-100 rounded-lg p-3">
            <ShoppingCart className="h-6 w-6 text-blue-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">今日订单总额</p>
            <p className="text-2xl font-bold text-gray-900">₽{stats.totalAmount.toFixed(2)}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center">
          <div className="flex-shrink-0 bg-green-100 rounded-lg p-3">
            <Package className="h-6 w-6 text-green-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">今日出库数量</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalQuantity}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center">
          <div className="flex-shrink-0 bg-purple-100 rounded-lg p-3">
            <User className="h-6 w-6 text-purple-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">今日下单客户</p>
            <p className="text-2xl font-bold text-gray-900">{stats.customerCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
}