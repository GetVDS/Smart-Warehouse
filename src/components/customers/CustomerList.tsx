'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { User, Phone, Trash2 } from 'lucide-react';
import { Customer } from '@/hooks/useCustomers';

interface CustomerListProps {
  customers: Customer[];
  searchTerm: string;
  onDeleteCustomer: (id: string, name: string) => void;
}

export function CustomerList({ 
  customers, 
  searchTerm, 
  onDeleteCustomer 
}: CustomerListProps) {
  const router = useRouter();

  const filteredCustomers = useMemo(() => {
    return customers.filter(customer => 
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm)
    );
  }, [customers, searchTerm]);

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
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
                订单数量
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
            {filteredCustomers.map((customer) => (
              <CustomerRow
                key={customer.id}
                customer={customer}
                onRowClick={() => router.push(`/customers/${customer.id}`)}
                onDeleteCustomer={onDeleteCustomer}
              />
            ))}
          </tbody>
        </table>
      </div>
      
      {filteredCustomers.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          暂无客户数据
        </div>
      )}
    </div>
  );
}

interface CustomerRowProps {
  customer: Customer;
  onRowClick: () => void;
  onDeleteCustomer: (id: string, name: string) => void;
}

function CustomerRow({ customer, onRowClick, onDeleteCustomer }: CustomerRowProps) {
  return (
    <tr
      className="hover:bg-gray-50 cursor-pointer"
      onClick={onRowClick}
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
        {customer._count?.purchaseRecords || 0}
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
        ₽{customer.totalAmount?.toFixed(2) || '0.00'}
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
        {new Date(customer.createdAt).toLocaleDateString('zh-CN')}
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm">
        <CustomerActions
          customer={customer}
          onDeleteCustomer={onDeleteCustomer}
        />
      </td>
    </tr>
  );
}

interface CustomerActionsProps {
  customer: Customer;
  onDeleteCustomer: (id: string, name: string) => void;
}

function CustomerActions({ customer, onDeleteCustomer }: CustomerActionsProps) {
  return (
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
  );
}