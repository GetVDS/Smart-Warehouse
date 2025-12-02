'use client';

import { useMemo } from 'react';
import { Trash2, User } from 'lucide-react';
import { Order } from '@/hooks/useOrders';

interface OrderListProps {
  orders: Order[];
  searchTerm: string;
  onConfirmOrder: (id: string) => void;
  onCancelOrder: (id: string) => void;
  onDeleteOrder: (id: string) => void;
}

export function OrderList({ 
  orders, 
  searchTerm, 
  onConfirmOrder, 
  onCancelOrder, 
  onDeleteOrder 
}: OrderListProps) {
  const filteredOrders = useMemo(() => {
    return orders.filter(order =>
      order.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer.phone.includes(searchTerm) ||
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.orderNumber ? `PRAISE${String(Number(order.orderNumber)).padStart(4, '0')}` : '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [orders, searchTerm]);

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
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
              <OrderRow
                key={order.id}
                order={order}
                onConfirmOrder={onConfirmOrder}
                onCancelOrder={onCancelOrder}
                onDeleteOrder={onDeleteOrder}
              />
            ))}
          </tbody>
        </table>
      </div>
      
      {filteredOrders.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          暂无订单数据
        </div>
      )}
    </div>
  );
}

interface OrderRowProps {
  order: Order;
  onConfirmOrder: (id: string) => void;
  onCancelOrder: (id: string) => void;
  onDeleteOrder: (id: string) => void;
}

function OrderRow({ order, onConfirmOrder, onCancelOrder, onDeleteOrder }: OrderRowProps) {
  return (
    <tr className="hover:bg-gray-50">
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
        <div>₽{order.totalAmount.toFixed(2)}</div>
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
        <OrderActions
          order={order}
          onConfirmOrder={onConfirmOrder}
          onCancelOrder={onCancelOrder}
          onDeleteOrder={onDeleteOrder}
        />
      </td>
    </tr>
  );
}

interface OrderActionsProps {
  order: Order;
  onConfirmOrder: (id: string) => void;
  onCancelOrder: (id: string) => void;
  onDeleteOrder: (id: string) => void;
}

function OrderActions({ order, onConfirmOrder, onCancelOrder, onDeleteOrder }: OrderActionsProps) {
  return (
    <div className="flex flex-col gap-2">
      {order.status === 'pending' && (
        <div className="flex gap-2">
          <button
            onClick={() => onConfirmOrder(order.id)}
            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            确认出售
          </button>
          <button
            onClick={() => onCancelOrder(order.id)}
            className="px-3 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
          >
            取消订单
          </button>
          <button
            onClick={() => onDeleteOrder(order.id)}
            className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            title="删除订单"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
      {order.status !== 'pending' && (
        <button
          onClick={() => onDeleteOrder(order.id)}
          className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          title="删除订单"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}