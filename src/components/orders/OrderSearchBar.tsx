'use client';

import { Plus, Search } from 'lucide-react';

interface OrderSearchBarProps {
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  onOpenCreateModal: () => void;
}

export function OrderSearchBar({ 
  searchTerm, 
  onSearchTermChange, 
  onOpenCreateModal 
}: OrderSearchBarProps) {
  return (
    <div className="bg-white p-4 rounded-lg shadow mb-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索订单ID、客户姓名或手机号..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <button
          onClick={onOpenCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          创建订单
        </button>
      </div>
    </div>
  );
}