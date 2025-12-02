'use client';

import { memo } from 'react';
import { Package, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { Statistics } from '@/types';

interface StatisticsCardProps {
  statistics: Statistics;
}

export const StatisticsCard = memo<StatisticsCardProps>(({ statistics }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-blue-600" />
          <div>
            <p className="text-sm text-gray-600">产品总数</p>
            <p className="text-xl font-bold">{statistics.totalProducts}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-green-600" />
          <div>
            <p className="text-sm text-gray-600">总库存</p>
            <p className="text-xl font-bold">{statistics.totalStock}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-red-600" />
          <div>
            <p className="text-sm text-gray-600">总出库</p>
            <p className="text-xl font-bold">{statistics.totalOut}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          <div>
            <p className="text-sm text-gray-600">总入库</p>
            <p className="text-xl font-bold">{statistics.totalIn}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          <div>
            <p className="text-sm text-gray-600">库存预警</p>
            <p className="text-xl font-bold">{statistics.lowStockCount}</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-purple-600" />
          <div>
            <p className="text-sm text-gray-600">总价值</p>
            <p className="text-xl font-bold">₽{statistics.totalValue.toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  );
});

StatisticsCard.displayName = 'StatisticsCard';