'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { showConfirm } from '@/lib/notification';
import { useOrders } from '@/hooks/useOrders';
import { AuthGuard } from '@/components/shared/AuthGuard';
import { AppHeader } from '@/components/shared/AppHeader';
import { SearchAndActions } from '@/components/shared/SearchAndActions';
import { OrderStatistics } from '@/components/orders/OrderStatistics';
import { OrderList } from '@/components/orders/OrderList';
import { OrderModal } from '@/components/orders/OrderModal';

export default function OrdersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [todayStats, setTodayStats] = useState({
    totalAmount: 0,
    totalQuantity: 0,
    customerCount: 0
  });

  // 缓存今日统计数据的获取函数
  const fetchTodayStatsCallback = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await fetch('/api/orders/stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: today.toISOString(),
          endDate: tomorrow.toISOString()
        })
      });

      if (response.ok) {
        const data = await response.json();
        setTodayStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch today stats:', error);
    }
  }, []);

  const {
    orders,
    customers,
    products,
    loading,
    createOrder,
    deleteOrder,
    fetchOrders,
    setOrders
  } = useOrders(user);

  // 获取订单数据
  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]); // 移除 fetchOrders 依赖，防止无限循环

  // 获取今日统计数据
  useEffect(() => {
    if (user) {
      fetchTodayStatsCallback();
    }
  }, [user]); // 移除 fetchTodayStatsCallback 依赖，防止无限循环

  const handleCreateOrder = useCallback(async (orderData: {
    customerId: string;
    items: Array<{productId: string, quantity: number}>;
    note?: string;
  }) => {
    const result = await createOrder(orderData);
    
    if (result.success) {
      setShowAddModal(false);
      fetchTodayStatsCallback();
    }
    
    return result;
  }, [createOrder, fetchTodayStatsCallback]);

  const handleDeleteOrder = useCallback(async (id: string) => {
    showConfirm(
      '确定要删除此订单吗？此操作不可恢复。',
      async () => {
        await deleteOrder(id);
      }
    );
  }, [deleteOrder]);

  const handleConfirmOrder = useCallback(async (id: string) => {
    showConfirm(
      '确定要确认此订单吗？确认后将减少库存。',
      async () => {
        try {
          const response = await fetch(`/api/orders/${id}/confirm`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              const updatedOrder = data.data;
              
              setOrders(prevOrders => 
                prevOrders.map(order =>
                  order.id === id ? { ...order, status: 'confirmed', ...updatedOrder } : order
                )
              );
              
              // 触发客户和产品数据更新事件
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('customerDataUpdated', {
                  detail: { customerId: updatedOrder.customerId }
                }));
                
                window.dispatchEvent(new CustomEvent('productDataUpdated', {
                  detail: {
                    action: 'orderConfirmed',
                    orderId: id,
                    timestamp: Date.now()
                  }
                }));
              }
              
              fetchTodayStatsCallback();
            }
          } else {
            const errorData = await response.json();
            showConfirm(errorData.error || '确认订单失败', () => {}, { title: '操作失败', confirmText: '确定' });
          }
        } catch (error) {
          console.error('Confirm order error:', error);
          showConfirm('确认订单失败，请重试', () => {}, { title: '操作失败', confirmText: '确定' });
        }
      }
    );
  }, [setOrders, fetchTodayStatsCallback]);

  const handleCancelOrder = useCallback(async (id: string) => {
    showConfirm(
      '确定要取消此订单吗？此操作不可恢复。',
      async () => {
        try {
          const response = await fetch(`/api/orders/${id}/cancel`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              const updatedOrder = data.data;
              
              setOrders(prevOrders => 
                prevOrders.map(order =>
                  order.id === id ? { ...order, status: 'cancelled', ...updatedOrder } : order
                )
              );
              
              // 触发客户和产品数据更新事件
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('customerDataUpdated', {
                  detail: { customerId: updatedOrder.customerId }
                }));
                
                window.dispatchEvent(new CustomEvent('productDataUpdated', {
                  detail: {
                    action: 'orderCancelled',
                    orderId: id,
                    timestamp: Date.now()
                  }
                }));
              }
              
              fetchTodayStatsCallback();
            }
          } else {
            const errorData = await response.json();
            showConfirm(errorData.error || '取消订单失败', () => {}, { title: '操作失败', confirmText: '确定' });
          }
        } catch (error) {
          console.error('Cancel order error:', error);
          showConfirm('取消订单失败，请重试', () => {}, { title: '操作失败', confirmText: '确定' });
        }
      }
    );
  }, [setOrders, fetchTodayStatsCallback]);

  // 使用 useMemo 优化过滤，避免每次渲染都重新计算
  const filteredOrders = useMemo(() => {
    if (!searchTerm) return orders;
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    return orders.filter(order =>
      order.customer?.name?.toLowerCase().includes(lowerSearchTerm) ||
      order.customer?.phone?.includes(searchTerm) ||
      order.id.toLowerCase().includes(lowerSearchTerm) ||
      (order.orderNumber ? `PRAISE${String(Number(order.orderNumber)).padStart(4, '0')}` : '').toLowerCase().includes(lowerSearchTerm)
    );
  }, [orders, searchTerm]);

  return (
    <AuthGuard onAuthSuccess={setUser}>
      <div className="min-h-screen bg-gray-50">
        <AppHeader 
          title="订单管理" 
          activeNav="orders"
          showBackButton={true}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <OrderStatistics stats={todayStats} />
          
          <SearchAndActions
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="搜索订单ID、客户姓名或手机号..."
            actionButtonText="创建订单"
            onActionClick={() => setShowAddModal(true)}
          />

          <OrderList
            orders={filteredOrders}
            onConfirmOrder={handleConfirmOrder}
            onCancelOrder={handleCancelOrder}
            onDeleteOrder={handleDeleteOrder}
          />
        </main>

        <OrderModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onCreateOrder={handleCreateOrder}
          customers={customers}
          products={products}
        />
      </div>
    </AuthGuard>
  );
}