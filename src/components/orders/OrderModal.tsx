'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateOrder: (orderData: {
    customerId: string;
    items: Array<{productId: string, quantity: number}>;
    note?: string;
  }) => Promise<void>;
  customers: Array<{id: string, name: string, phone: string}>;
  products: Array<{id: string, sku: string, currentStock: number}>;
}

interface OrderItem {
  productId: string;
  quantity: number;
}

export function OrderModal({ 
  isOpen, 
  onClose, 
  onCreateOrder, 
  customers, 
  products 
}: OrderModalProps) {
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderNote, setOrderNote] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');

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

  const handleCreateOrder = async () => {
    if (!selectedCustomer || orderItems.length === 0 || orderItems.some(item => !item.productId || item.quantity <= 0)) {
      return;
    }

    await onCreateOrder({
      customerId: selectedCustomer,
      items: orderItems,
      note: orderNote
    });

    // 重置表单
    setSelectedCustomer('');
    setOrderItems([]);
    setOrderNote('');
    setCustomerSearchTerm('');
    onClose();
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    customer.phone.includes(customerSearchTerm)
  );

  if (!isOpen) return null;

  return (
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
                {filteredCustomers.map((customer) => (
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
                添加项
              </button>
            </div>
            
            {orderItems.map((item, index) => (
              <OrderItemRow
                key={index}
                item={item}
                products={products}
                index={index}
                onItemChange={handleOrderItemChange}
                onRemoveItem={handleRemoveOrderItem}
              />
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
            disabled={!selectedCustomer || orderItems.length === 0 || orderItems.some(item => !item.productId || item.quantity <= 0)}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            创建订单
          </button>
          <button
            onClick={() => {
              setSelectedCustomer('');
              setOrderItems([]);
              setOrderNote('');
              setCustomerSearchTerm('');
              onClose();
            }}
            className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

interface OrderItemRowProps {
  item: OrderItem;
  products: Array<{id: string, sku: string, currentStock: number}>;
  index: number;
  onItemChange: (index: number, field: 'productId' | 'quantity', value: string | number) => void;
  onRemoveItem: (index: number) => void;
}

function OrderItemRow({ item, products, index, onItemChange, onRemoveItem }: OrderItemRowProps) {
  const selectedProduct = products.find(p => p.id === item.productId);
  const maxStock = selectedProduct?.currentStock || 0;

  return (
    <div className="flex gap-2 mb-2">
      <select
        value={item.productId}
        onChange={(e) => onItemChange(index, 'productId', e.target.value)}
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
        max={maxStock}
        value={item.quantity}
        onChange={(e) => {
          const value = parseInt(e.target.value) || 0;
          if (value <= maxStock) {
            onItemChange(index, 'quantity', e.target.value);
          } else {
            onItemChange(index, 'quantity', maxStock.toString());
          }
        }}
        className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="数量"
      />
      
      <button
        type="button"
        onClick={() => onRemoveItem(index)}
        className="px-2 py-1 text-red-600 hover:text-red-800"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}