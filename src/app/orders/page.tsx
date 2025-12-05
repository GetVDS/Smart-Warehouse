'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, ArrowLeft, Trash2, ShoppingCart, User, Package, Users } from 'lucide-react';
import { showConfirm } from '@/lib/notification';
import { useOrders } from '@/hooks/useOrders';

export default function OrdersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [orderItems, setOrderItems] = useState<Array<{productId: string, quantity: number}>>([]);
  const [orderNote, setOrderNote] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
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

  const handleAddOrderItem = () => {
    setOrderItems([...orderItems, { productId: '', quantity: 1 }]);
  };

  const handleRemoveOrderItem = (index: number) => {
    const newItems = orderItems.filter((_, i) => i !== index);
    setOrderItems(newItems);
  };

  const handleOrderItemChange = (index: number, field: 'productId' | 'quantity', value: string | number) => {
    const newItems = [...orderItems];
    if (newItems[index]) {
      if (field === 'productId') {
        newItems[index].productId = value as string;
      } else {
        newItems[index].quantity = parseInt(value as string) || 0;
      }
      setOrderItems(newItems);
    }
  };

  const handleCreateOrder = useCallback(async () => {
    if (!selectedCustomer || orderItems.length === 0 || orderItems.some(item => !item.productId || item.quantity <= 0)) {
      showConfirm('请填写完整的订单信息', () => {}, { title: '验证失败', confirmText: '确定' });
      return;
    }

    // 验证每个订单项都有对应的产品
    for (const item of orderItems) {
      const product = products.find(p => p.id === item.productId);
      if (!product) {
        showConfirm(`产品ID ${item.productId} 不存在，请重新选择`, () => {}, { title: '产品验证失败', confirmText: '确定' });
        return;
      }
    }

    // 创建订单时不进行乐观更新，等待服务器返回真实订单ID
    const result = await createOrder({
      customerId: selectedCustomer,
      items: orderItems,
      note: orderNote
    });

    if (result.success) {
      setShowAddModal(false);
      setSelectedCustomer('');
      setOrderItems([]);
      setOrderNote('');
      
      // 服务器返回真实订单数据后，添加到列表开头
      if (result.data?.order) {
        setOrders(prevOrders => [result.data.order, ...prevOrders]);
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
    }
  }, [selectedCustomer, orderItems, products, customers, createOrder, setOrders]);

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
            console.log('Order confirm response:', data); // 添加调试日志
            if (data.success && data.data) {
              // 乐观更新：立即更新订单状态
              const updatedOrder = data.data;
              console.log('Updated order data:', updatedOrder); // 添加更多调试日志
              
              // 强制触发重新渲染
              setOrders(prevOrders => {
                const newOrders = prevOrders.map(order =>
                  order.id === id ? { ...order, status: 'confirmed', ...updatedOrder } : order
                );
                console.log('New orders after confirm:', newOrders); // 调试日志
                return newOrders;
              });
              
              // 触发客户列表更新事件，以便客户管理页面可以实时更新购买金额
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('customerDataUpdated', {
                  detail: { customerId: updatedOrder.customerId }
                }));
                
                // 触发产品数据更新事件，确保产品管理页面的统计数据实时更新
                console.log('触发产品数据更新事件：订单确认后更新产品统计数据');
                window.dispatchEvent(new CustomEvent('productDataUpdated', {
                  detail: {
                    action: 'orderConfirmed',
                    orderId: id,
                    timestamp: Date.now()
                  }
                }));
              }
              
              // 刷新今日统计数据
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const tomorrow = new Date(today);
              tomorrow.setDate(tomorrow.getDate() + 1);

              try {
                const statsResponse = await fetch('/api/orders/stats', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    startDate: today.toISOString(),
                    endDate: tomorrow.toISOString()
                  })
                });

                if (statsResponse.ok) {
                  const statsData = await statsResponse.json();
                  console.log('Updated stats data:', statsData.stats); // 调试日志
                  setTodayStats(statsData.stats);
                }
              } catch (error) {
                console.error('Failed to fetch today stats:', error);
              }
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
  }, [setOrders, fetchOrders]);

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
            console.log('Order cancel response:', data); // 添加调试日志
            if (data.success && data.data) {
              // 乐观更新：立即更新订单状态
              const updatedOrder = data.data;
              console.log('Updated order data:', updatedOrder); // 添加更多调试日志
              
              // 强制触发重新渲染
              setOrders(prevOrders => {
                const newOrders = prevOrders.map(order =>
                  order.id === id ? { ...order, status: 'cancelled', ...updatedOrder } : order
                );
                console.log('New orders after cancel:', newOrders); // 调试日志
                return newOrders;
              });
              
              // 触发客户列表更新事件，以便客户管理页面可以实时更新购买金额
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('customerDataUpdated', {
                  detail: { customerId: updatedOrder.customerId }
                }));
                
                // 触发产品数据更新事件，确保产品管理页面的统计数据实时更新
                console.log('触发产品数据更新事件：订单取消后更新产品统计数据');
                window.dispatchEvent(new CustomEvent('productDataUpdated', {
                  detail: {
                    action: 'orderCancelled',
                    orderId: id,
                    timestamp: Date.now()
                  }
                }));
              }
              
              // 刷新今日统计数据
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const tomorrow = new Date(today);
              tomorrow.setDate(tomorrow.getDate() + 1);

              try {
                const statsResponse = await fetch('/api/orders/stats', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    startDate: today.toISOString(),
                    endDate: tomorrow.toISOString()
                  })
                });

                if (statsResponse.ok) {
                  const statsData = await statsResponse.json();
                  console.log('Updated stats data:', statsData.stats); // 调试日志
                  setTodayStats(statsData.stats);
                }
              } catch (error) {
                console.error('Failed to fetch today stats:', error);
              }
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
  }, [setOrders, fetchOrders]);

  // 使用 useMemo 优化过滤
  const filteredOrders = useMemo(() => {
    return orders.filter(order =>
      order.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer.phone.includes(searchTerm) ||
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.orderNumber ? `PRAISE${String(Number(order.orderNumber)).padStart(4, '0')}` : '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [orders, searchTerm]);

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
          {/* PC端布局 */}
          <div className="hidden sm:flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                返回
              </button>
              <h1 className="text-xl font-bold text-gray-900">订单管理</h1>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/customers')}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                客户管理
              </button>
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                产品管理
              </button>
            </div>
          </div>
          
          {/* 移动端布局 */}
          <div className="sm:hidden">
            <div className="flex justify-between items-center h-12">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push('/')}
                  className="p-2 text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <h1 className="text-lg font-bold text-gray-900">订单管理</h1>
              </div>
            </div>
            <div className="flex justify-around py-2 border-t">
              <button
                onClick={() => router.push('/')}
                className="flex flex-col items-center p-2 text-gray-600 hover:text-gray-900"
              >
                <Package className="h-5 w-5" />
                <span className="text-xs mt-1">产品</span>
              </button>
              <button
                onClick={() => router.push('/customers')}
                className="flex flex-col items-center p-2 text-gray-600 hover:text-gray-900"
              >
                <Users className="h-5 w-5" />
                <span className="text-xs mt-1">客户</span>
              </button>
              <div className="flex flex-col items-center p-2 text-blue-600">
                <ShoppingCart className="h-5 w-5" />
                <span className="text-xs mt-1">订单</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">

        {/* 今日统计 - 移动端优化 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-lg p-2 sm:p-3">
                <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-500">今日订单总额</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">₽{Math.round(todayStats.totalAmount)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-lg p-2 sm:p-3">
                <Package className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-500">今日出库数量</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{todayStats.totalQuantity}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-100 rounded-lg p-2 sm:p-3">
                <User className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-500">今日下单客户</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{todayStats.customerCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Actions - 移动端优化 */}
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow mb-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索订单ID、客户姓名或手机号..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              创建订单
            </button>
          </div>
        </div>

        {/* Orders List - 移动端优化 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* PC端表格布局 */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    订单ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    客户信息
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    订单项
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    总金额
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
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
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      PRAISE{String(order.orderNumber || 0).padStart(4, '0')}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{order.customer.name}</div>
                          <div className="text-sm text-gray-500">{order.customer.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">
                        {order.orderItems.map((item, index) => (
                          <div key={item.id} className="mb-1">
                            <div className="font-medium">{item.product.sku} x {item.quantity}</div>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>₽{Math.round(order.totalAmount)}</div>
                      {order.note && (
                        <div className="text-xs text-gray-500 mt-1">备注: {order.note}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        order.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {order.status === 'confirmed' ? '已确认' :
                         order.status === 'pending' ? '待处理' : '已取消'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        {order.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleConfirmOrder(order.id)}
                              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors whitespace-nowrap"
                            >
                              确认出售
                            </button>
                            <button
                              onClick={() => handleCancelOrder(order.id)}
                              className="px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors whitespace-nowrap"
                            >
                              取消订单
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteOrder(order.id)}
                          className="p-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                          title="删除订单"
                        >
                          <Trash2 className="h-3 w-3" />
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
            {filteredOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                暂无订单数据
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredOrders.map((order) => (
                  <div key={order.id} className="p-4 space-y-3">
                    {/* 订单头部信息 */}
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-medium text-gray-900">
                            PRAISE{String(order.orderNumber || 0).padStart(4, '0')}
                          </h3>
                          {/* 订单状态移至订单ID右侧 */}
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            order.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {order.status === 'confirmed' ? '已确认' :
                             order.status === 'pending' ? '待处理' : '已取消'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                          <User className="h-4 w-4" />
                          <div>
                            <div className="font-medium text-gray-900">{order.customer.name}</div>
                            <div className="text-gray-500">{order.customer.phone}</div>
                          </div>
                        </div>
                      </div>
                      {/* 删除按钮移到右上角 */}
                      <button
                        onClick={() => handleDeleteOrder(order.id)}
                        className="p-2 text-red-600 hover:text-red-900"
                        title="删除订单"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    
                    {/* 订单项 */}
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-gray-700">订单项:</div>
                      {order.orderItems.map((item) => (
                        <div key={item.id} className="flex justify-between items-center py-1 border-b border-gray-100">
                          <span className="text-sm text-gray-900">{item.product.sku}</span>
                          <span className="text-sm text-gray-600">x {item.quantity}</span>
                        </div>
                      ))}
                    </div>
                    
                    {/* 金额和时间 */}
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString('zh-CN')}
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        ₽{Math.round(order.totalAmount)}
                      </div>
                    </div>
                    
                    {/* 备注 */}
                    {order.note && (
                      <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                        备注: {order.note}
                      </div>
                    )}
                    
                    {/* 操作按钮 */}
                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                      {order.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleConfirmOrder(order.id)}
                            className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                          >
                            确认出售
                          </button>
                          <button
                            onClick={() => handleCancelOrder(order.id)}
                            className="flex-1 px-3 py-2 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
                          >
                            取消订单
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Order Modal */}
      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-2xl border border-gray-200 relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">创建新订单</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  选择客户
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="搜索客户姓名或手机号..."
                    value={customerSearchTerm}
                    onChange={(e) => setCustomerSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mt-2"
                  >
                    <option value="">请选择客户</option>
                    {customers
                      .filter(customer =>
                        customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
                        customer.phone.includes(customerSearchTerm)
                      )
                      .map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} - {customer.phone}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    订单项
                  </label>
                  <button
                    type="button"
                    onClick={handleAddOrderItem}
                    className="flex items-center gap-1 px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    <Plus className="h-3 w-3" />
                    添加产品
                  </button>
                </div>
                
                {/* 默认显示一个产品选项框 */}
                {orderItems.length === 0 && (
                  <div className="flex gap-2 mb-2">
                    <select
                      value=""
                      onChange={(e) => {
                        setOrderItems([{ productId: e.target.value, quantity: 1 }]);
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">选择产品</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.sku} (库存: {product.currentStock})
                        </option>
                      ))}
                    </select>
                    
                    <input
                      type="number"
                      min="1"
                      value={1}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 1;
                        if (orderItems.length > 0) {
                          handleOrderItemChange(0, 'quantity', value);
                        }
                      }}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="数量"
                    />
                  </div>
                )}
                
                {orderItems.map((item, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <select
                      value={item.productId}
                      onChange={(e) => handleOrderItemChange(index, 'productId', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">选择产品</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.sku} (库存: {product.currentStock})
                        </option>
                      ))}
                    </select>
                    
                    <input
                      type="number"
                      min="1"
                      max={item.productId ? products.find(p => p.id === item.productId)?.currentStock || 1 : ''}
                      value={item.quantity}
                      onChange={(e) => {
                        const maxStock = item.productId ? products.find(p => p.id === item.productId)?.currentStock || 1 : '';
                        const value = parseInt(e.target.value) || 0;
                        if (maxStock && value <= maxStock) {
                          handleOrderItemChange(index, 'quantity', e.target.value);
                        } else if (value > maxStock) {
                          handleOrderItemChange(index, 'quantity', maxStock.toString());
                        }
                      }}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="数量"
                    />
                    
                    <button
                      type="button"
                      onClick={() => handleRemoveOrderItem(index)}
                      className="px-2 py-1 text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  备注（选填）
                </label>
                <textarea
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="订单备注信息..."
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateOrder}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                创建订单
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedCustomer('');
                  setOrderItems([]);
                  setOrderNote('');
                  setCustomerSearchTerm('');
                  setProductSearchTerm('');
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