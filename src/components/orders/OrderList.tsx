'use client';

import { Trash2, User } from 'lucide-react';
import { Order } from '@/types';

interface OrderListProps {
  orders: Order[];
  onConfirmOrder: (id: string) => void;
  onCancelOrder: (id: string) => void;
  onDeleteOrder: (id: string) => void;
}

export function OrderList({ 
  orders, 
  onConfirmOrder, 
  onCancelOrder, 
  onDeleteOrder 
}: OrderListProps) {
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      confirmed: { className: 'bg-green-100 text-green-800', text: '已确认' },
      pending: { className: 'bg-yellow-100 text-yellow-800', text: '待处理' },
      cancelled: { className: 'bg-red-100 text-red-800', text: '已取消' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return (
      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${config.className}`}>
        {config.text}
      </span>
    );
  };

  return (
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
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  PRAISE{String(order.orderNumber || 0).padStart(4, '0')}
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{order.customer?.name}</div>
                      <div className="text-sm text-gray-500">{order.customer?.phone}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="text-sm text-gray-900">
                    {order.orderItems?.map((item, index) => (
                      <div key={item.id} className="mb-1">
                        <div className="font-medium">{item.product?.sku} x {item.quantity}</div>
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
                  {getStatusBadge(order.status)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                  {order.createdAt ? new Date(order.createdAt).toLocaleDateString('zh-CN') : ''}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center gap-2">
                    {order.status === 'pending' && (
                      <>
                        <button
                          onClick={() => onConfirmOrder(order.id)}
                          className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors whitespace-nowrap"
                        >
                          确认出售
                        </button>
                        <button
                          onClick={() => onCancelOrder(order.id)}
                          className="px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors whitespace-nowrap"
                        >
                          取消订单
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => onDeleteOrder(order.id)}
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
        {orders.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            暂无订单数据
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {orders.map((order) => (
              <div key={order.id} className="p-4 space-y-3">
                {/* 订单头部信息 */}
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-medium text-gray-900">
                        PRAISE{String(order.orderNumber || 0).padStart(4, '0')}
                      </h3>
                      {getStatusBadge(order.status)}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                      <User className="h-4 w-4" />
                      <div>
                        <div className="font-medium text-gray-900">{order.customer?.name}</div>
                        <div className="text-gray-500">{order.customer?.phone}</div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteOrder(order.id)}
                    className="p-2 text-red-600 hover:text-red-900"
                    title="删除订单"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                
                {/* 订单项 */}
                <div className="space-y-1">
                  <div className="text-sm font-medium text-gray-700">订单项:</div>
                  {order.orderItems?.map((item) => (
                    <div key={item.id} className="flex justify-between items-center py-1 border-b border-gray-100">
                      <span className="text-sm text-gray-900">{item.product?.sku}</span>
                      <span className="text-sm text-gray-600">x {item.quantity}</span>
                    </div>
                  ))}
                </div>
                
                {/* 金额和时间 */}
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-500">
                    {order.createdAt ? new Date(order.createdAt).toLocaleDateString('zh-CN') : ''}
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
                        onClick={() => onConfirmOrder(order.id)}
                        className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        确认出售
                      </button>
                      <button
                        onClick={() => onCancelOrder(order.id)}
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
  );
}