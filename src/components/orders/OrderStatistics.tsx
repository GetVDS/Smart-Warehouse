'use client';

import { ShoppingCart, Package, User } from 'lucide-react';

interface OrderStats {
  totalAmount: number;
  totalQuantity: number;
  customerCount: number;
}

interface OrderStatisticsProps {
  stats: OrderStats;
}

export function OrderStatistics({ stats }: OrderStatisticsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
        <div className="flex items-center">
          <div className="flex-shrink-0 bg-blue-100 rounded-lg p-2 sm:p-3">
            <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
          </div>
          <div className="ml-3 sm:ml-4">
            <p className="text-xs sm:text-sm font-medium text-gray-500">今日订单总额</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-900">₽{Math.round(stats.totalAmount)}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
        <div className="flex items-center">
          <div className="flex-shrink-0 bg-green-100 rounded-lg p-2 sm:p-3">
            <Package className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
          </div>
          <div className="ml-3 sm:ml-4">
            <p className="text-xs sm:text-sm font-medium text-gray-500">今日出库数量</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.totalQuantity}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
        <div className="flex items-center">
          <div className="flex-shrink-0 bg-purple-100 rounded-lg p-2 sm:p-3">
            <User className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
          </div>
          <div className="ml-3 sm:ml-4">
            <p className="text-xs sm:text-sm font-medium text-gray-500">今日下单客户</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.customerCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
}