'use client';

import { useState } from 'react';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCustomer: (customerData: { name: string; phone: string }) => Promise<void>;
}

export function CustomerModal({ isOpen, onClose, onAddCustomer }: CustomerModalProps) {
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  const handleAddCustomer = async () => {
    if (!newCustomerName || !newCustomerPhone) {
      return;
    }

    // 俄罗斯手机号校验（通常为11位数字，以7、8或9开头）
    const phoneRegex = /^[7-9]\d{10}$/;
    if (!phoneRegex.test(newCustomerPhone.replace(/\D/g, ''))) {
      return;
    }

    await onAddCustomer({
      name: newCustomerName,
      phone: newCustomerPhone
    });

    // 重置表单
    setNewCustomerName('');
    setNewCustomerPhone('');
    onClose();
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 只允许输入数字
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 11) {
      setNewCustomerPhone(value);
    }
  };

  if (!isOpen) return null;

  const isFormValid = newCustomerName && newCustomerPhone && /^[7-9]\d{10}$/.test(newCustomerPhone.replace(/\D/g, ''));

  return (
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
              onChange={handlePhoneChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入11位俄罗斯手机号"
              maxLength={11}
            />
          </div>
        </div>
        
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleAddCustomer}
            disabled={!isFormValid}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            添加客户
          </button>
          <button
            onClick={() => {
              setNewCustomerName('');
              setNewCustomerPhone('');
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