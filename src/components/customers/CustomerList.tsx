'use client';

import { useRouter } from 'next/navigation';
import { User, Phone, Trash2 } from 'lucide-react';
import { Customer } from '@/types';

interface CustomerListProps {
  customers: Customer[];
  onDeleteCustomer: (id: string, name: string) => void;
}

export function CustomerList({ customers, onDeleteCustomer }: CustomerListProps) {
  const router = useRouter();

  const handleCustomerClick = (customerId: string) => {
    router.push(`/customers/${customerId}`);
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* PC端表格布局 */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                客户姓名
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                手机号
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                购买记录
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                购买金额
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                创建时间
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {customers.map((customer) => (
              <tr
                key={customer.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => handleCustomerClick(customer.id)}
              >
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">
                      {customer.name}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-900">
                      {customer.phone}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {customer._count?.orders || 0}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  ₽{Math.round(customer.totalAmount || 0)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                  {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('zh-CN') : ''}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteCustomer(customer.id, customer.name);
                      }}
                      className="text-red-600 hover:text-red-900"
                      title="删除客户"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* 移动端卡片布局 */}
      <div className="sm:hidden">
        {customers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            暂无客户数据
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {customers.map((customer) => (
              <div
                key={customer.id}
                className="p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => handleCustomerClick(customer.id)}
              >
                {/* 客户基本信息 */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="text-base font-medium text-gray-900 mb-1">{customer.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="h-4 w-4" />
                      <span>{customer.phone}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteCustomer(customer.id, customer.name);
                    }}
                    className="p-2 text-red-600 hover:text-red-900"
                    title="删除客户"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                
                {/* 客户统计信息网格 */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-gray-500 text-xs mb-1">购买记录</div>
                    <div className="font-medium text-gray-900">{customer._count?.orders || 0}</div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-gray-500 text-xs mb-1">购买金额</div>
                    <div className="font-medium text-gray-900">₽{Math.round(customer.totalAmount || 0)}</div>
                  </div>
                </div>
                
                {/* 创建时间 */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>创建时间:</span>
                    <span>{customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('zh-CN') : ''}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}