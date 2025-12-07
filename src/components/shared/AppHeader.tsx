'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, LogOut, Users, ShoppingCart, Package } from 'lucide-react';

interface AppHeaderProps {
  title: string;
  showBackButton?: boolean;
  activeNav?: 'products' | 'orders' | 'customers';
  onLogout?: () => void;
}

export function AppHeader({ 
  title, 
  showBackButton = true, 
  activeNav,
  onLogout 
}: AppHeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      onLogout?.();
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const navItems = [
    { 
      key: 'products', 
      label: '产品', 
      icon: Package, 
      href: '/',
      mobileOnly: false 
    },
    { 
      key: 'orders', 
      label: '订单', 
      icon: ShoppingCart, 
      href: '/orders',
      mobileOnly: false 
    },
    { 
      key: 'customers', 
      label: '客户', 
      icon: Users, 
      href: '/customers',
      mobileOnly: false 
    }
  ];

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* PC端布局 */}
        <div className="hidden sm:flex justify-between items-center h-16">
          <div className="flex items-center gap-4">
            {showBackButton && (
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                返回
              </button>
            )}
            <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => router.push(item.href)}
                className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                  activeNav === item.key 
                    ? 'text-blue-600 font-medium' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title={item.label}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              title="退出登录"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        {/* 移动端布局 */}
        <div className="sm:hidden">
          <div className="flex justify-between items-center h-12">
            <div className="flex items-center gap-2">
              {showBackButton && (
                <button
                  onClick={() => router.back()}
                  className="p-2 text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <h1 className="text-lg font-bold text-gray-900">{title}</h1>
            </div>
            
            {title === 'PRAISEJEANS' && (
              <button
                onClick={handleLogout}
                className="p-2 text-gray-600 hover:text-gray-900"
                title="退出登录"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
          
          <div className="flex justify-around py-2 border-t">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => router.push(item.href)}
                className={`flex flex-col items-center p-2 transition-colors ${
                  activeNav === item.key 
                    ? 'text-blue-600' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title={item.label}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-xs mt-1">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}