'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { showSuccess, showError } from '@/lib/notification';
import { api } from '@/lib/client-api';
import { Product } from '@/types';
import { useProducts } from '@/hooks/useProducts';
import { ProductHeader } from '@/components/products/ProductHeader';
import { StatisticsCard } from '@/components/StatisticsCard';
import { ProductSearchBar } from '@/components/products/ProductSearchBar';
import { ProductList } from '@/components/products/ProductList';
import { ProductOutboundRanking } from '@/components/products/ProductOutboundRanking';

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

export default function HomePageRefactored() {
  const [user, setUser] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProductSku, setNewProductSku] = useState('');
  const [newProductStock, setNewProductStock] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteProductId, setDeleteProductId] = useState('');
  const [deleteProductSku, setDeleteProductSku] = useState('');
  const [stockInputs, setStockInputs] = useState<{[key: string]: {decrease: string, increase: string}}>({});
  const router = useRouter();

  const {
    products,
    setProducts,
    statistics,
    loading,
    searchTerm,
    sortBy,
    filteredProducts,
    getStockStatus,
    getStockPercentage,
    getOutboundRanking,
    setSearchTerm,
    setSortBy,
    fetchProducts,
    calculateStatistics
  } = useProducts();

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

    // 首先确保管理员用户存在
    ensureAdminUser().then(() => {
      checkAuth();
    });
  }, [router]);

  // 获取产品数据
  useEffect(() => {
    if (user) {
      fetchProducts();
    }
  }, [user, fetchProducts]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleAddProduct = async () => {
    if (!newProductSku || !newProductStock || !newProductPrice) {
      showError('请填写完整信息');
      return;
    }

    const result = await api.post('/api/products', {
      sku: newProductSku,
      initialStock: parseInt(newProductStock),
      price: parseFloat(newProductPrice)
    }, {
      showSuccessMessage: true,
      successMessage: '产品添加成功'
    });

    if (result.success) {
      setShowAddModal(false);
      setNewProductSku('');
      setNewProductStock('');
      setNewProductPrice('');
      
      // 如果API返回了新产品数据，使用乐观更新
      if (result.data?.product) {
        setProducts((prev: any[]) => [result.data.product, ...prev]);
        calculateStatistics([result.data.product, ...products]);
      }
    }
  };

  const handleDeleteProduct = useCallback((id: string, sku: string) => {
    setDeleteProductId(id);
    setDeleteProductSku(sku);
    setShowDeleteModal(true);
  }, []);

  const confirmDeleteProduct = async () => {
    // 乐观更新：立即从列表中移除
    const productToDelete = products.find((p: any) => p.id === deleteProductId);
    if (!productToDelete) return;

    const result = await api.delete(`/api/products/${deleteProductId}`, {
      showSuccessMessage: true,
      successMessage: '产品删除成功'
    });

    if (result.success) {
      // 只有API成功后才更新UI
      const updatedProducts = products.filter((p: any) => p.id !== deleteProductId);
      setProducts(updatedProducts);
      calculateStatistics(updatedProducts);
      setShowDeleteModal(false);
      setDeleteProductId('');
      setDeleteProductSku('');
    } else {
      // 如果删除失败，恢复产品到列表
      setProducts((prev: any[]) => [...prev, productToDelete]);
    }
  };

  const handleStockInputChange = useCallback((id: string, field: 'decrease' | 'increase', value: string) => {
    setStockInputs(prev => ({
      ...prev,
      [id]: {
        decrease: prev[id]?.decrease || '',
        increase: prev[id]?.increase || '',
        [field]: value
      }
    }));
  }, []);

  const handleStockUpdate = async (id: string, field: 'increase' | 'decrease') => {
    const value = stockInputs[id]?.[field === 'increase' ? 'increase' : 'decrease'];
    if (!value || parseInt(value) <= 0) {
      showError('请输入有效的数量');
      return;
    }

    const currentValue = products.find((p: any) => p.id === id);
    if (!currentValue) return;

    const changeAmount = parseInt(value);
    
    // 乐观更新：立即更新UI
    const optimisticUpdates = {
      currentStock: field === 'increase'
        ? currentValue.currentStock + changeAmount
        : Math.max(0, currentValue.currentStock - changeAmount),
      totalIn: field === 'increase'
        ? currentValue.totalIn + changeAmount
        : currentValue.totalIn,
      totalOut: field === 'decrease'
        ? currentValue.totalOut + changeAmount
        : currentValue.totalOut,
      updatedAt: new Date().toISOString()
    };

    // 立即更新UI和统计数据
    setProducts((prev: any[]) => prev.map((p: any) =>
      p.id === id ? { ...p, ...optimisticUpdates } : p
    ));
    
    // 立即更新统计数据
    calculateStatistics(products.map((p: any) =>
      p.id === id ? { ...p, ...optimisticUpdates } : p
    ));

    // 清空输入框
    setStockInputs(prev => ({
      ...prev,
      [id]: {
        decrease: prev[id]?.decrease || '',
        increase: prev[id]?.increase || '',
        [field === 'increase' ? 'increase' : 'decrease']: ''
      }
    }));

    // 发送API请求
    const result = await api.post(`/api/products/${id}/stock`, {
      [field]: changeAmount
    }, {
      showSuccessMessage: true,
      successMessage: `${field === 'increase' ? '入库' : '出库'}操作成功！`
    });

    // 如果API调用失败，回滚到原始数据
    if (!result.success) {
      setProducts((prev: any[]) => prev.map((p: any) =>
        p.id === id ? currentValue : p
      ));
    }
  };

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
      <ProductHeader
        onNavigateToCustomers={() => router.push('/customers')}
        onNavigateToOrders={() => router.push('/orders')}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StatisticsCard statistics={statistics} />

        <ProductSearchBar
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          onOpenAddModal={() => setShowAddModal(true)}
        />

        <ProductList
          products={filteredProducts}
          stockInputs={stockInputs}
          onStockInputChange={handleStockInputChange}
          onStockUpdate={handleStockUpdate}
          onDeleteProduct={handleDeleteProduct}
          getStockStatus={getStockStatus}
          getStockPercentage={getStockPercentage}
        />

        <ProductOutboundRanking
          products={getOutboundRanking()}
          totalOut={statistics.totalOut}
        />
      </main>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md border border-gray-200 relative">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">添加新产品</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  产品款号
                </label>
                <input
                  type="text"
                  value={newProductSku}
                  onChange={(e) => setNewProductSku(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入产品款号"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  初始库存
                </label>
                <input
                  type="number"
                  value={newProductStock}
                  onChange={(e) => setNewProductStock(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入初始库存"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  产品单价 (₽)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newProductPrice}
                  onChange={(e) => setNewProductPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入产品单价"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddProduct}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                添加产品
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewProductSku('');
                  setNewProductStock('');
                  setNewProductPrice('');
                }}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md border border-gray-200 relative">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">确认删除</h3>
            
            <p className="text-gray-600 mb-6">
              确定要删除产品 <span className="font-semibold text-gray-900">{deleteProductSku}</span> 吗？此操作不可恢复。
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={confirmDeleteProduct}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                确认删除
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteProductId('');
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