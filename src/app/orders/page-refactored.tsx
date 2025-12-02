'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { showConfirm } from '@/lib/notification';
import { useOrders } from '@/hooks/useOrders';
import { OrderHeader } from '@/components/orders/OrderHeader';
import { OrderStats } from '@/components/orders/OrderStats';
import { OrderSearchBar } from '@/components/orders/OrderSearchBar';
import { OrderList } from '@/components/orders/OrderList';
import { OrderModal } from '@/components/orders/OrderModal';

export default function OrdersPageRefactored() {
  const [user, setUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [todayStats, setTodayStats] = useState({
    totalAmount: 0,
    totalQuantity: 0,
    customerCount: 0
  });
  
  const router = useRouter();

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

  // 获取订单数据
  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user, fetchOrders]);

  // 获取今日统计数据
  useEffect(() => {
    const fetchTodayStats = async () => {
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
    };

    if (user) {
      fetchTodayStats();
    }
  }, [user]);

  const handleCreateOrder = async (orderData: {
    customerId: string;
    items: Array<{productId: string, quantity: number}>;
    note?: string;
  }) => {
    // 验证每个订单项都有对应的产品
    for (const item of orderData.items) {
      const product = products.find(p => p.id === item.productId);
      if (!product) {
        showConfirm(`产品ID ${item.productId} 不存在，请重新选择`, () => {}, { title: '产品验证失败', confirmText: '确定' });
        return;
      }
    }

    // 创建临时订单ID用于乐观更新
    const tempOrderId = `temp-${Date.now()}`;
    // 获取当前最大订单号，如果没有则从1开始
    const maxOrderNumber = orders.length > 0 ? Math.max(...orders.map(o => o.orderNumber || 0)) : 0;
    const tempOrderNumber = maxOrderNumber + 1;

    // 乐观更新：立即在UI中显示新订单
    const selectedCustomerData = customers.find(c => c.id === orderData.customerId);
    const tempOrderItems = orderData.items.map(item => {
      const product = products.find(p => p.id === item.productId);
      return {
        id: `temp-item-${Date.now()}-${Math.random()}`,
        productId: item.productId,
        quantity: item.quantity,
        price: product?.price || 0,
        product: product || { id: item.productId, sku: 'Unknown' }
      };
    });

    const optimisticOrder = {
      id: tempOrderId,
      orderNumber: tempOrderNumber,
      customerId: orderData.customerId,
      status: 'pending',
      totalAmount: tempOrderItems.reduce((sum, item) => sum + (item.quantity * item.price), 0),
      note: orderData.note,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      customer: selectedCustomerData || { id: orderData.customerId, name: 'Unknown', phone: 'Unknown' },
      orderItems: tempOrderItems
    };

    // 立即更新UI
    setOrders(prevOrders => [optimisticOrder, ...prevOrders]);

    const result = await createOrder(orderData);

    if (result.success) {
      // 如果API返回了真实订单数据，使用它替换临时订单
      if (result.data?.order) {
        setOrders(prevOrders => {
          // 移除临时订单
          const filteredOrders = prevOrders.filter(order => order.id !== tempOrderId);
          // 添加真实订单到开头
          return [result.data.order, ...filteredOrders];
        });
      }
      
      // 刷新今日统计数据
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      try {
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
    } else {
      // 如果创建失败，移除乐观更新的订单
      setOrders(prevOrders => prevOrders.filter(order => order.id !== tempOrderId));
    }
  };

  const handleDeleteOrder = async (id: string) => {
    showConfirm(
      '确定要删除此订单吗？此操作不可恢复。',
      async () => {
        // 检查是否为临时订单ID，如果是则不执行操作
        if (id.startsWith('temp-')) {
          showConfirm('临时订单无法删除，请等待订单创建完成', () => {}, { title: '操作无效', confirmText: '确定' });
          return;
        }
        
        await deleteOrder(id);
      }
    );
  };

  const handleConfirmOrder = async (id: string) => {
    // 检查是否为临时订单ID，如果是则不执行操作
    if (id.startsWith('temp-')) {
      showConfirm('临时订单无法确认，请等待订单创建完成', () => {}, { title: '操作无效', confirmText: '确定' });
      return;
    }

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
            if (data.success && data.order) {
              // 乐观更新：立即更新订单状态
              setOrders(prevOrders =>
                prevOrders.map(order =>
                  order.id === id ? { ...order, status: 'confirmed', ...data.order } : order
                )
              );
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
  };

  const handleCancelOrder = async (id: string) => {
    // 检查是否为临时订单ID，如果是则不执行操作
    if (id.startsWith('temp-')) {
      showConfirm('临时订单无法取消，请等待订单创建完成', () => {}, { title: '操作无效', confirmText: '确定' });
      return;
    }

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
            if (data.success && data.order) {
              // 乐观更新：立即更新订单状态
              setOrders(prevOrders =>
                prevOrders.map(order =>
                  order.id === id ? { ...order, status: 'cancelled', ...data.order } : order
                )
              );
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
      <OrderHeader
        onNavigateToCustomers={() => router.push('/customers')}
        onNavigateToProducts={() => router.push('/')}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <OrderStats stats={todayStats} />
        
        <OrderSearchBar
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          onOpenCreateModal={() => setShowAddModal(true)}
        />

        <OrderList
          orders={orders}
          searchTerm={searchTerm}
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
  );
}