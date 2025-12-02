'use client';

interface ProductOutboundRankingProps {
  products: Array<{
    id: string;
    sku: string;
    totalOut: number;
  }>;
  totalOut: number;
}

export function ProductOutboundRanking({ 
  products, 
  totalOut 
}: ProductOutboundRankingProps) {
  const getOutboundRanking = () => {
    return products
      .filter(product => product.totalOut > 0)
      .sort((a, b) => b.totalOut - a.totalOut);
  };

  const rankedProducts = getOutboundRanking();

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b">
        <h3 className="text-sm font-medium text-gray-900">产品出库数量排名</h3>
      </div>
      <div className="p-4">
        {rankedProducts.length > 0 ? (
          <div className="space-y-2">
            {rankedProducts.map((product, index) => (
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
                    占比: {totalOut > 0 ? ((product.totalOut / totalOut) * 100).toFixed(1) : 0}%
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
  );
}