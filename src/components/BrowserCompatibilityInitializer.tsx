'use client';

import { useEffect } from 'react';
import { initializeCompatibility } from '@/lib/browser-compatibility';

/**
 * 浏览器兼容性初始化组件
 * 在应用启动时初始化浏览器兼容性检查
 */
export default function BrowserCompatibilityInitializer() {
  useEffect(() => {
    // 只在客户端初始化浏览器兼容性检查
    if (typeof window !== 'undefined') {
      try {
        initializeCompatibility();
        console.log('浏览器兼容性检查已初始化');
      } catch (error) {
        console.warn('浏览器兼容性初始化失败:', error);
      }
    }
  }, []);

  // 这个组件不渲染任何内容
  return null;
}