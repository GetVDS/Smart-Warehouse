'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '@/lib/client-api';

export interface Order {
  id: string;
  orderNumber: number;
  customerId: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  note?: string;
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  orderItems: {
    id: string;
    productId: string;
    quantity: number;
    price: number;
    product: {
      id: string;
      sku: string;
    };
  }[];
}

export const useOrders = (user: any) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      const response = await api.get('/api/orders');
      if (response.success && response.data?.orders) {
        setOrders(response.data.orders);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  }, [setOrders]);

  const fetchCustomers = useCallback(async () => {
    try {
      const response = await api.get('/api/customers');
      if (response.success && response.data?.customers) {
        setCustomers(response.data.customers);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    }
  }, [setCustomers]);

  const fetchProducts = useCallback(async () => {
    try {
      const response = await api.get('/api/products');
      if (response.success && response.data?.products) {
        setProducts(response.data.products);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  }, [setProducts]);

  const createOrder = useCallback(async (orderData: { customerId: string; items: Array<{productId: string, quantity: number}>; note?: string }) => {
    const result = await api.post('/api/orders', orderData, {
      showSuccessMessage: true,
      successMessage: '订单创建成功'
    });

    // 不再在这里自动添加订单到列表，让页面组件处理
    // 这样可以确保订单创建后立即可以执行操作

    return result;
  }, []);

  const deleteOrder = useCallback(async (id: string) => {
    const result = await api.delete(`/api/orders/${id}`, {
      showSuccessMessage: true,
      successMessage: '订单删除成功'
    });

    if (result.success) {
      // 乐观更新：立即从列表中移除订单
      setOrders(prev => prev.filter(order => order.id !== id));
    }

    return result;
  }, [setOrders]);

  useEffect(() => {
    // 只在用户认证完成后才获取数据
    if (user) {
      setLoading(true);
      Promise.all([
        fetchOrders(),
        fetchCustomers(),
        fetchProducts()
      ]).finally(() => {
        setLoading(false);
      });
    } else {
      // 用户未登录时清空数据
      setOrders([]);
      setCustomers([]);
      setProducts([]);
    }
  }, [user, fetchOrders, fetchCustomers, fetchProducts]);

  return {
    orders,
    customers,
    products,
    loading,
    fetchOrders,
    fetchCustomers,
    fetchProducts,
    createOrder,
    deleteOrder,
    setOrders
  };
};