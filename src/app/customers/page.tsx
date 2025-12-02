'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, User, Phone, ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { showConfirm, showError } from '@/lib/notification';
import { useCustomers } from '@/hooks/useCustomers';

export default function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
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

  // 监听客户数据更新事件
  useEffect(() => {
    // 确保只在客户端运行
    if (typeof window === 'undefined') return;
    
    const handleCustomerDataUpdate = () => {
      if (user) {
        fetchCustomers();
      }
    };

    if (typeof window === 'undefined') return;
    
    window.addEventListener('customerDataUpdated', handleCustomerDataUpdate);
    
    return () => {
      window.removeEventListener('customerDataUpdated', handleCustomerDataUpdate);
    };
  }, [user, fetchCustomers]);

  const handleAddCustomer = useCallback(async () => {
    if (!newCustomerName || !newCustomerPhone) {
      showError('请填写完整信息');
      return;
    }

    // 俄罗斯手机号校验（通常为11位数字，以7、8或9开头）
    const phoneRegex = /^[7-9]\d{10}$/;
    if (!phoneRegex.test(newCustomerPhone.replace(/\D/g, ''))) {
      showError('请输入有效的俄罗斯手机号（11位数字）');
      return;
    }

    const result = await addCustomer({
      name: newCustomerName,
      phone: newCustomerPhone
    });

    if (result.success) {
      setShowAddModal(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
    }
  }, [newCustomerName, newCustomerPhone, addCustomer]);

  const handleDeleteCustomer = useCallback(async (id: string, name: string) => {
    showConfirm(
      `确定要删除客户 ${name} 吗？此操作不可恢复。`,
      async () => {
        const result = await deleteCustomer(id);
        // 不需要手动调用 fetchCustomers，因为 useCustomers hook 已经处理了乐观更新
        // 手动刷新会导致页面闪烁
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
      {/* Header */}
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
                onClick={() => router.push('/orders')}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                订单管理
              </button>
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                产品管理
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Search and Actions */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索客户姓名或手机号..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              添加客户
            </button>
          </div>
        </div>

        {/* Customer List */}
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
                  <tr
                    key={customer.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/customers/${customer.id}`)}
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
                      ₽{customer.totalAmount?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(customer.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCustomer(customer.id, customer.name);
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
          
          {filteredCustomers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              暂无客户数据
            </div>
          )}
        </div>
      </main>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md border border-gray-200 relative">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">添加新客户</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  客户姓名
                </label>
                <input
                  type="text"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入客户姓名"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  俄罗斯手机号 (11位数字)
                </label>
                <input
                  type="tel"
                  value={newCustomerPhone}
                  onChange={(e) => {
                    // 只允许输入数字
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 11) {
                      setNewCustomerPhone(value);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入11位俄罗斯手机号"
                  maxLength={11}
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddCustomer}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                添加客户
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewCustomerName('');
                  setNewCustomerPhone('');
                }}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}