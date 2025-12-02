import { toast } from "@/hooks/use-toast";

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationOptions {
  title?: string;
  description?: string;
  duration?: number;
}

export const showNotification = (
  type: NotificationType,
  message: string,
  options?: NotificationOptions
) => {
  const { title, description, duration = 3000 } = options || {};
  
  return toast({
    title: title || (type === 'success' ? '成功' : 
           type === 'error' ? '错误' : 
           type === 'warning' ? '警告' : '提示'),
    description: description || message,
    variant: type === 'error' ? 'destructive' : 'default',
    duration,
  });
};

export const showSuccess = (message: string, options?: Omit<NotificationOptions, 'title'>) => {
  return showNotification('success', message, { ...options, title: '成功' });
};

export const showError = (message: string, options?: Omit<NotificationOptions, 'title'>) => {
  return showNotification('error', message, { ...options, title: '错误' });
};

export const showWarning = (message: string, options?: Omit<NotificationOptions, 'title'>) => {
  return showNotification('warning', message, { ...options, title: '警告' });
};

export const showInfo = (message: string, options?: Omit<NotificationOptions, 'title'>) => {
  return showNotification('info', message, { ...options, title: '提示' });
};

export const showConfirm = (message: string, onConfirm: () => void, options?: {
  confirmText?: string;
  cancelText?: string;
  title?: string;
}) => {
  const { confirmText = '确认', cancelText = '取消', title = '确认操作' } = options || {};
  
  // 创建自定义确认弹窗
  const confirmDialog = document.createElement('div');
  confirmDialog.className = 'fixed inset-0 flex items-center justify-center p-4 z-50';
  confirmDialog.innerHTML = `
    <div class="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md border border-gray-200 relative">
      <h3 class="text-lg font-semibold mb-4 text-gray-900">${title}</h3>
      <p class="text-sm text-gray-600 mb-6">${message}</p>
      <div class="flex gap-3">
        <button id="confirm-btn" class="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors">
          ${confirmText}
        </button>
        <button id="cancel-btn" class="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 transition-colors">
          ${cancelText}
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(confirmDialog);
  
  const confirmBtn = confirmDialog.querySelector('#confirm-btn');
  const cancelBtn = confirmDialog.querySelector('#cancel-btn');
  
  const handleConfirm = () => {
    document.body.removeChild(confirmDialog);
    onConfirm();
  };
  
  const handleCancel = () => {
    document.body.removeChild(confirmDialog);
  };
  
  confirmBtn?.addEventListener('click', handleConfirm);
  cancelBtn?.addEventListener('click', handleCancel);
  
  // ESC键关闭
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
      document.removeEventListener('keydown', handleEsc);
    }
  };
  document.addEventListener('keydown', handleEsc);
};