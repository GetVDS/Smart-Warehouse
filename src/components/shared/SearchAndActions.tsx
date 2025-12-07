'use client';

import { Plus, Search } from 'lucide-react';

interface SearchAndActionsProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  actionButtonText: string;
  onActionClick: () => void;
  additionalActions?: React.ReactNode;
  showSort?: boolean;
  sortValue?: string;
  onSortChange?: (value: string) => void;
  sortOptions?: Array<{ value: string; label: string }>;
}

export function SearchAndActions({
  searchTerm,
  onSearchChange,
  searchPlaceholder,
  actionButtonText,
  onActionClick,
  additionalActions,
  showSort = false,
  sortValue,
  onSortChange,
  sortOptions = []
}: SearchAndActionsProps) {
  return (
    <div className="bg-white p-3 sm:p-4 rounded-lg shadow mb-6">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          {showSort && (
            <select
              value={sortValue}
              onChange={(e) => onSortChange?.(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
          
          <div className="flex gap-2">
            <button
              onClick={onActionClick}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {actionButtonText}
            </button>
            
            {additionalActions}
          </div>
        </div>
      </div>
    </div>
  );
}