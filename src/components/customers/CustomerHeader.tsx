'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface CustomerHeaderProps {
  onNavigateToOrders: () => void;
  onNavigateToProducts: () => void;
}

export function CustomerHeader({ onNavigateToOrders, onNavigateToProducts }: CustomerHeaderProps) {
  const router = useRouter();

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              返回
            </button>
            <h1 className="text-xl font-bold text-gray-900">客户管理</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onNavigateToOrders}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              订单管理
            </button>
            <button
              onClick={onNavigateToProducts}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              产品管理
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}