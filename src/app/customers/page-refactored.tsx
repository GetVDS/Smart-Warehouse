'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { showConfirm, showError } from '@/lib/notification';
import { useCustomers } from '@/hooks/useCustomers';
import { CustomerHeader } from '@/components/customers/CustomerHeader';
import { CustomerSearchBar } from '@/components/customers/CustomerSearchBar';
import { CustomerList } from '@/components/customers/CustomerList';
import { CustomerModal } from '@/components/customers/CustomerModal';

export default function CustomersPageRefactored() {
  const [user, setUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const router = useRouter();

  const {
    customers,
    loading,
    fetchCustomers,
    addCustomer,
    deleteCustomer
  } = useCustomers();

  // 检查登录状态
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          router.push('/login');
        }
      } catch (error) {
        router.push('/login');
      }
    };

    checkAuth();
  }, [router]);

  // 获取客户数据
  useEffect(() => {
    if (user) {
      fetchCustomers();
    }
  }, [user, fetchCustomers]);

  const handleAddCustomer = async (customerData: { name: string; phone: string }) => {
    // 俄罗斯手机号校验（通常为11位数字，以7、8或9开头）
    const phoneRegex = /^[7-9]\d{10}$/;
    if (!phoneRegex.test(customerData.phone.replace(/\D/g, ''))) {
      showError('请输入有效的俄罗斯手机号（11位数字）');
      return;
    }

    const result = await addCustomer(customerData);

    if (result.success) {
      // 客户已通过乐观更新添加到列表中
      setShowAddModal(false);
    }
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    showConfirm(
      `确定要删除客户 ${name} 吗？此操作不可恢复。`,
      async () => {
        const result = await deleteCustomer(id);
        if (result.success) {
          // 客户已通过乐观更新从列表中移除
        }
      }
    );
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CustomerHeader
        onNavigateToOrders={() => router.push('/orders')}
        onNavigateToProducts={() => router.push('/')}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CustomerSearchBar
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          onOpenAddModal={() => setShowAddModal(true)}
        />

        <CustomerList
          customers={customers}
          searchTerm={searchTerm}
          onDeleteCustomer={handleDeleteCustomer}
        />
      </main>

      <CustomerModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddCustomer={handleAddCustomer}
      />
    </div>
  );
}