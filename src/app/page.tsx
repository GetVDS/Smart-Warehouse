'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { showSuccess, showError } from '@/lib/notification';
import { api } from '@/lib/client-api';
import { AuthGuard } from '@/components/shared/AuthGuard';
import { AppHeader } from '@/components/shared/AppHeader';
import { SearchAndActions } from '@/components/shared/SearchAndActions';
import { StatisticsCard } from '@/components/StatisticsCard';
import { ProductCard } from '@/components/ProductCard';

// 移除重复的 ensureAdminUser 函数，已在 AuthGuard 中实现

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

    window.addEventListener('productDataUpdated', handleProductDataUpdate as EventListener);
    
    return () => {
      window.removeEventListener('productDataUpdated', handleProductDataUpdate as EventListener);
    };
  }, [user]); // 移除 fetchProducts 依赖，防止无限循环

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
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
    
    // 立即清空输入框，防止重复提交
    setStockInputs(prev => ({
      ...prev,
      [id]: {
        decrease: prev[id]?.decrease || '',
        increase: prev[id]?.increase || '',
        [field === 'increase' ? 'increase' : 'decrease']: ''
      }
    }));
    
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

  return (
    <AuthGuard onAuthSuccess={(userData) => {
      setUser(userData);
      // 只在用户认证成功后获取产品数据
      if (userData) {
        fetchProducts();
      }
    }}>
      <div className="min-h-screen bg-gray-50">
        <AppHeader
          title="PRAISEJEANS"
          activeNav="products"
          showBackButton={false}
          onLogout={handleLogout}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <StatisticsCard statistics={statistics} />
          
          <SearchAndActions
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="搜索产品款号..."
            actionButtonText="添加产品"
            onActionClick={() => setShowAddModal(true)}
            showSort={true}
            sortValue={sortBy}
            onSortChange={(value) => setSortBy(value as 'stock' | 'sku')}
            sortOptions={[
              { value: 'stock', label: '按库存排序' },
              { value: 'sku', label: '按款号排序' }
            ]}
          />

          {/* Product List - 移动端优化 */}
          <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
            {/* PC端表格布局 */}
            <div className="hidden sm:block overflow-x-auto">
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
            
            {/* 移动端卡片布局 */}
            <div className="sm:hidden">
              {filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  暂无产品数据
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredProducts.map((product) => {
                    // 直接计算，不使用 useMemo（因为 hooks 不能在循环中使用）
                    const stockStatus = getStockStatus(product.currentStock);
                    const stockPercentage = getStockPercentage(product.currentStock);
                    
                    return (
                      <div key={product.id} className="p-4 space-y-3">
                        {/* 产品基本信息和删除按钮 */}
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-medium text-gray-900">{product.sku}</h3>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${stockStatus.className}`}>
                                {stockStatus.text}
                              </span>
                            </div>
                          </div>
                          {/* 删除按钮移到右上角 */}
                          <button
                            onClick={() => handleDeleteProduct(product.id, product.sku)}
                            className="p-2 text-red-600 hover:text-red-900"
                            title="删除产品"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        
                        {/* 库存数据和操作区域 */}
                        <div className="grid grid-cols-2 gap-3">
                          {/* 左侧：库存数据 */}
                          <div className="space-y-1">
                            <div className="text-sm text-black font-medium">库存: {product.currentStock}</div>
                            <div className="flex justify-between">
                              <span className="text-xs text-gray-500">出库: {product.totalOut}</span>
                              <span className="text-xs text-gray-500">入库: {product.totalIn}</span>
                            </div>
                          </div>
                          
                          {/* 右侧：单价和价值 */}
                          <div className="text-right space-y-1">
                            <div className="text-sm font-medium text-gray-900">单价: ₽{product.price}</div>
                            <div className="text-xs text-gray-500">价值: ₽{Math.round(product.currentStock * product.price)}</div>
                          </div>
                        </div>
                        
                        {/* 库存操作区域 */}
                        <div className="space-y-2">
                          {/* 出库操作 */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-12">出库:</span>
                            <input
                              type="number"
                              placeholder="数量"
                              value={stockInputs[product.id]?.decrease || ''}
                              onChange={(e) => handleStockInputChange(product.id, 'decrease', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                              onClick={() => handleStockUpdate(product.id, 'decrease')}
                              className="p-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                              title="确认出库"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                          </div>
                          
                          {/* 入库操作 */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-12">入库:</span>
                            <input
                              type="number"
                              placeholder="数量"
                              value={stockInputs[product.id]?.increase || ''}
                              onChange={(e) => handleStockInputChange(product.id, 'increase', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                              onClick={() => handleStockUpdate(product.id, 'increase')}
                              className="p-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                              title="确认入库"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Outbound Ranking - 移动端优化 */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b">
              <h3 className="text-sm font-medium text-gray-900">产品出库数量排名</h3>
            </div>
            <div className="p-4">
              {(() => {
                const ranking = getOutboundRanking();
                return ranking.length > 0 ? (
                  <div className="space-y-2">
                    {ranking.map((product, index) => (
                    <div key={product.id} className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <span className="text-sm font-medium text-gray-600 w-6">
                          {index + 1}.
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {product.sku}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4">
                        <span className="text-xs sm:text-sm text-gray-600">
                          出库: {product.totalOut}
                        </span>
                        <span className="text-xs sm:text-sm text-gray-600">
                          {statistics.totalOut > 0 ? ((product.totalOut / statistics.totalOut) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    暂无出库数据
                  </div>
                );
              })()}
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
                    value={newProductPrice}
                    onChange={(e) => {
                      // 只允许输入整数，不允许小数点
                      const value = e.target.value.replace(/[^\d-]/g, '');
                      setNewProductPrice(value);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="请输入产品单价（整数）"
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
    </AuthGuard>
  );
}