'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '@/lib/client-api';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
  totalAmount?: number;
  _count?: {
    orders: number;
    purchaseRecords: number;
  };
}

export const useCustomers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/customers');
      if (response.success && response.data?.customers) {
        setCustomers(response.data.customers);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const addCustomer = useCallback(async (customerData: { name: string; phone: string }) => {
    const result = await api.post('/api/customers', customerData, {
      showSuccessMessage: true,
      successMessage: '客户添加成功'
    });

    if (result.success && result.data?.customer) {
      // 乐观更新：立即将新客户添加到列表中
      setCustomers(prev => [result.data.customer, ...prev]);
    }

    return result;
  }, []);

  const deleteCustomer = useCallback(async (id: string) => {
    // 乐观更新：立即从列表中移除客户，避免页面闪烁
    const originalCustomers = [...customers];
    setCustomers(prev => prev.filter(customer => customer.id !== id));

    const result = await api.delete(`/api/customers/${id}`, {
      showSuccessMessage: true,
      successMessage: '客户删除成功'
    });

    // 如果删除失败，恢复原始列表
    if (!result.success) {
      setCustomers(originalCustomers);
    }

    return result;
  }, [customers]);

  return {
    customers,
    loading,
    fetchCustomers,
    addCustomer,
    deleteCustomer
  };
};