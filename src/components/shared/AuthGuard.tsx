'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// 在客户端初始化时确保管理员用户存在
const ensureAdminUser = async () => {
  try {
    const response = await fetch('/api/ensure-admin', {
      method: 'POST'
    });
    if (response.ok) {
      console.log('✅ 管理员用户确保完成');
    }
  } catch (error) {
    console.error('❌ 管理员用户确保失败:', error);
  }
};

interface AuthGuardProps {
  children: React.ReactNode;
  onAuthSuccess?: (user: any) => void;
}

export function AuthGuard({ children, onAuthSuccess }: AuthGuardProps) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adminChecked, setAdminChecked] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          onAuthSuccess?.(data.user);
          
          // 只在第一次认证成功时确保管理员用户存在
          if (data.user && !adminChecked) {
            await ensureAdminUser();
            setAdminChecked(true);
          }
        } else {
          router.push('/login');
        }
      } catch (error) {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []); // 移除所有依赖项，只在组件挂载时执行一次

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // 会重定向到登录页
  }

  return <>{children}</>;
}