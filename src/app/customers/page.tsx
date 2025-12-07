'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { showConfirm, showError } from '@/lib/notification';
import { useCustomers } from '@/hooks/useCustomers';
import { AuthGuard } from '@/components/shared/AuthGuard';
import { AppHeader } from '@/components/shared/AppHeader';
import { SearchAndActions } from '@/components/shared/SearchAndActions';
import { CustomerList } from '@/components/customers/CustomerList';
import { CustomerModal } from '@/components/customers/CustomerModal';

export default function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [user, setUser] = useState<any>(null);

  const {
    customers,
    loading,
    fetchCustomers,
    addCustomer,
    deleteCustomer
  } = useCustomers();

  // 监听客户数据更新事件
  useEffect(() => {
    // 确保只在客户端运行
    if (typeof window === 'undefined') return;
    
    const handleCustomerDataUpdate = () => {
      if (user) {
        fetchCustomers();
      }
    };

    window.addEventListener('customerDataUpdated', handleCustomerDataUpdate);
    
    return () => {
      window.removeEventListener('customerDataUpdated', handleCustomerDataUpdate);
    };
  }, [user]); // 移除 fetchCustomers 依赖，防止无限循环

  const handleAddCustomer = useCallback(async (customerData: { name: string; phone: string }) => {
    const result = await addCustomer(customerData);
    
    if (result.success) {
      setShowAddModal(false);
    }
    
    return result;
  }, [addCustomer]);

  const handleDeleteCustomer = useCallback(async (id: string, name: string) => {
    showConfirm(
      `确定要删除客户 ${name} 吗？此操作不可恢复。`,
      async () => {
        await deleteCustomer(id);
        // 不需要手动调用 fetchCustomers，因为 useCustomers hook 已经处理了乐观更新
      }
    );
  }, [deleteCustomer]);

  // 使用 useMemo 优化过滤
  const filteredCustomers = useMemo(() => {
    return customers.filter(customer =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm)
    );
  }, [customers, searchTerm]);

  return (
    <AuthGuard onAuthSuccess={setUser}>
      <div className="min-h-screen bg-gray-50">
        <AppHeader
          title="客户管理"
          activeNav="customers"
          showBackButton={true}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <SearchAndActions
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="搜索客户姓名或手机号..."
            actionButtonText="添加客户"
            onActionClick={() => setShowAddModal(true)}
          />

          <CustomerList
            customers={filteredCustomers}
            onDeleteCustomer={handleDeleteCustomer}
          />
        </main>

        <CustomerModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onAddCustomer={handleAddCustomer}
        />
      </div>
    </AuthGuard>
  );
}