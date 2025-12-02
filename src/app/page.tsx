'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, LogOut, Check } from 'lucide-react';
import { ProductCard } from '@/components/ProductCard';
import { StatisticsCard } from '@/components/StatisticsCard';
import { useProducts } from '@/hooks/useProducts';
import { showSuccess, showError } from '@/lib/notification';
import { api } from '@/lib/client-api';
import { Product } from '@/types';

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

export default function OptimizedHomePage() {
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
    ensureAdminUser().then(checkAuth).catch(console.error);
  }, [router]);

  // 获取产品数据
  useEffect(() => {
    if (user) {
      fetchProducts();
    }
  }, [user, fetchProducts]);

  // 监听产品数据更新事件（订单确认后触发）
  useEffect(() => {
    // 确保只在客户端运行
    if (typeof window === 'undefined') return;
    
    const handleProductDataUpdate = (event: CustomEvent) => {
      console.log('收到产品数据更新事件:', event.detail);
      if (user) {
        // 添加延迟确保数据库事务完成
        setTimeout(() => {
          console.log('开始获取最新产品数据...');
          fetchProducts().then(() => {
            console.log('产品数据获取完成');
          });
        }, 200); // 增加延迟时间确保数据库事务完全完成
      }
    };

    if (typeof window === 'undefined') return;
    
    window.addEventListener('productDataUpdated', handleProductDataUpdate as EventListener);
    
    return () => {
      window.removeEventListener('productDataUpdated', handleProductDataUpdate as EventListener);
    };
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
        setProducts(prev => [result.data.product, ...prev]);
        // 使用更新后的产品列表计算统计数据
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
    const productToDelete = products.find(p => p.id === deleteProductId);
    if (!productToDelete) return;

    const result = await api.delete(`/api/products/${deleteProductId}`, {
      showSuccessMessage: true,
      successMessage: '产品删除成功'
    });

    if (result.success) {
      // 只有API成功后才更新UI
      const updatedProducts = products.filter(p => p.id !== deleteProductId);
      setProducts(updatedProducts);
      calculateStatistics(updatedProducts);
      setShowDeleteModal(false);
      setDeleteProductId('');
      setDeleteProductSku('');
    } else {
      // 如果删除失败，恢复产品到列表
      setProducts(prev => [...prev, productToDelete]);
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

  const handleStockUpdate = useCallback(async (id: string, field: 'increase' | 'decrease') => {
    const value = stockInputs[id]?.[field === 'increase' ? 'increase' : 'decrease'];
    if (!value || parseInt(value) <= 0) {
      showError('请输入有效的数量');
      return;
    }

    const currentValue = products.find(p => p.id === id);
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
    setProducts(prev => prev.map(p =>
      p.id === id ? { ...p, ...optimisticUpdates } : p
    ));
    
    // 立即更新统计数据
    calculateStatistics(products.map(p =>
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
      setProducts(prev => prev.map(p =>
        p.id === id ? currentValue : p
      ));
    }
  }, [stockInputs, products, calculateStatistics]);

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
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-xl font-bold text-gray-900">PRAISEJEANS库存管理系统</h1>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/customers')}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                客户管理
              </button>
              <button
                onClick={() => router.push('/orders')}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                订单管理
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <LogOut className="h-4 w-4" />
                退出登录
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Statistics Cards */}
        <StatisticsCard statistics={statistics} />

        {/* Search and Actions */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索产品款号..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'stock' | 'sku')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="stock">按库存排序</option>
              <option value="sku">按款号排序</option>
            </select>
            
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              添加产品
            </button>
          </div>
        </div>

        {/* Product List */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    款号
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    库存
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    单价
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    价值
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    出库
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    入库
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    stockInputs={stockInputs}
                    onStockInputChange={handleStockInputChange}
                    onStockUpdate={handleStockUpdate}
                    onDeleteProduct={handleDeleteProduct}
                    getStockStatus={getStockStatus}
                    getStockPercentage={getStockPercentage}
                  />
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredProducts.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              暂无产品数据
            </div>
          )}
        </div>

        {/* Outbound Ranking */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <h3 className="text-sm font-medium text-gray-900">产品出库数量排名</h3>
          </div>
          <div className="p-4">
            {getOutboundRanking().length > 0 ? (
              <div className="space-y-2">
                {getOutboundRanking().map((product, index) => (
                  <div key={product.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-600 w-6">
                        {index + 1}.
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {product.sku}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">
                        出库: {product.totalOut}
                      </span>
                      <span className="text-sm text-gray-600">
                        占比: {statistics.totalOut > 0 ? ((product.totalOut / statistics.totalOut) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm">
                暂无出库数据
              </div>
            )}
          </div>
        </div>
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