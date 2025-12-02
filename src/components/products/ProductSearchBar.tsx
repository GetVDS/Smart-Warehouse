'use client';

import { Plus, Search } from 'lucide-react';

interface ProductSearchBarProps {
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  sortBy: 'stock' | 'sku';
  onSortByChange: (sortBy: 'stock' | 'sku') => void;
  onOpenAddModal: () => void;
}

export function ProductSearchBar({ 
  searchTerm, 
  onSearchTermChange, 
  sortBy,
  onSortByChange,
  onOpenAddModal 
}: ProductSearchBarProps) {
  return (
    <div className="bg-white p-4 rounded-lg shadow mb-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索产品款号..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <select
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value as 'stock' | 'sku')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="stock">按库存排序</option>
          <option value="sku">按款号排序</option>
        </select>
        
        <button
          onClick={onOpenAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          添加产品
        </button>
      </div>
    </div>
  );
}