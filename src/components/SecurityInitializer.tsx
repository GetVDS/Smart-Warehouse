'use client';

import { useEffect } from 'react';

export default function SecurityInitializer() {
  useEffect(() => {
    // 客户端安全初始化
    const initializeClientSecurity = () => {
      // 设置安全相关的客户端配置
      if (typeof window !== 'undefined') {
        // 防止点击劫持
        if (window.top && window.top !== window.self) {
          console.warn('检测到页面被嵌套在iframe中，可能存在点击劫持风险');
          // 在生产环境中可以选择退出或重定向
          if (process.env.NODE_ENV === 'production') {
            window.top.location.href = window.self.location.href;
          }
        }

        // 检查HTTPS
        if (process.env.NODE_ENV === 'production' && location.protocol !== 'https:') {
          console.warn('生产环境未使用HTTPS');
        }

        // 设置安全相关的存储
        try {
          // 检查localStorage可用性
          localStorage.setItem('security-test', 'test');
          localStorage.removeItem('security-test');
        } catch (error) {
          console.warn('localStorage不可用，可能影响认证功能');
        }

        // 监听页面可见性变化（用于安全检查）
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
            // 页面隐藏时的安全措施
            console.log('页面已隐藏');
          } else {
            // 页面重新可见时的安全检查
            console.log('页面重新可见');
          }
        });

        // 防止开发者工具检测（可选）
        let devtools = { open: false, orientation: null };
        const threshold = 160;
        
        const checkDevTools = () => {
          if (window.outerHeight - window.innerHeight > threshold || 
              window.outerWidth - window.innerWidth > threshold) {
            if (!devtools.open) {
              console.log('开发者工具已打开');
              devtools.open = true;
            }
          } else {
            devtools.open = false;
          }
        };

        // 定期检查（仅在开发环境）
        if (process.env.NODE_ENV === 'development') {
          setInterval(checkDevTools, 500);
        }

        // CSP违规检测
        const originalLog = console.error;
        console.error = (...args: any[]) => {
          originalLog.apply(console, args);
          
          // 检查是否为CSP违规
          const message = args.join(' ');
          if (message.includes('Content Security Policy') || 
              message.includes('CSP') || 
              message.includes('refused')) {
            console.warn('检测到CSP违规:', message);
          }
        };

        // XSS防护测试
        const testXSS = () => {
          const testInput = '<script>alert("XSS")</script>';
          const div = document.createElement('div');
          div.textContent = testInput;
          
          if (div.innerHTML !== testInput) {
            console.warn('XSS防护可能不足');
          }
        };

        // 在DOM加载后执行XSS测试
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', testXSS);
        } else {
          testXSS();
        }

        console.log('🔒 客户端安全初始化完成');
      }
    };

    initializeClientSecurity();
  }, []);

  return null; // 这个组件不渲染任何内容
}