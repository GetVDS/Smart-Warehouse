'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

interface ProductHeaderProps {
  onNavigateToCustomers: () => void;
  onNavigateToOrders: () => void;
  onLogout: () => void;
}

export function ProductHeader({ 
  onNavigateToCustomers, 
  onNavigateToOrders, 
  onLogout 
}: ProductHeaderProps) {
  const router = useRouter();

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div>
            <h1 className="text-xl font-bold text-gray-900">PRAISEJEANS库存管理系统</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onNavigateToCustomers}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              客户管理
            </button>
            <button
              onClick={onNavigateToOrders}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              订单管理
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <LogOut className="h-4 w-4" />
              退出登录
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}