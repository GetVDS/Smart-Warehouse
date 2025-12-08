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
    orderId: string;
    productId: string;
    quantity: number;
    price: number;
    product: {
      id: string;
      sku: string;
      currentStock: number;
      totalOut: number;
      totalIn: number;
      price: number;
    };
  }[];
}

export const useOrders = (user: any) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataFetched, setDataFetched] = useState(false); // 防止重复获取

  const fetchOrders = useCallback(async () => {
    try {
      // 启用客户端缓存，缓存5分钟
      const response = await api.get('/api/orders', { cache: true });
      if (response.success && response.data?.orders) {
        setOrders(response.data.orders);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      // 启用客户端缓存，缓存5分钟
      const response = await api.get('/api/customers', { cache: true });
      if (response.success && response.data?.customers) {
        setCustomers(response.data.customers);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      // 启用客户端缓存，缓存5分钟
      const response = await api.get('/api/products', { cache: true });
      if (response.success && response.data?.products) {
        setProducts(response.data.products);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    if (dataFetched) return; // 防止重复调用
    
    setLoading(true);
    try {
      await Promise.all([
        fetchOrders(),
        fetchCustomers(),
        fetchProducts()
      ]);
      setDataFetched(true);
    } finally {
      setLoading(false);
    }
  }, [fetchOrders, fetchCustomers, fetchProducts, dataFetched]);

  const createOrder = useCallback(async (orderData: { customerId: string; items: Array<{productId: string, quantity: number}>; note?: string }) => {
    const result = await api.post('/api/orders', orderData, {
      showSuccessMessage: true,
      successMessage: '订单创建成功'
    });

    // 乐观更新：立即添加新订单到列表
    if (result.success && result.data?.order) {
      setOrders(prev => [result.data.order, ...prev]);
    }

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
  }, []);

  useEffect(() => {
    // 只在用户认证完成后才获取数据，且只获取一次
    if (user && !dataFetched) {
      fetchAllData();
    } else if (!user) {
      // 用户未登录时清空数据和重置获取标志
      setOrders([]);
      setCustomers([]);
      setProducts([]);
      setDataFetched(false);
    }
  }, [user, fetchAllData]);

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