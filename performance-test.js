const http = require('http');
const { performance } = require('perf_hooks');

// 测试页面加载性能
function testPageLoad() {
  return new Promise((resolve) => {
    const start = performance.now();
    
    const req = http.get('http://localhost:3001', (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const end = performance.now();
        const loadTime = end - start;
        
        console.log(`页面加载性能测试:`);
        console.log(`- 状态码: ${res.statusCode}`);
        console.log(`- 响应时间: ${loadTime.toFixed(2)}ms`);
        console.log(`- 响应大小: ${data.length} bytes`);
        console.log('');
        
        resolve({ loadTime, statusCode: res.statusCode, size: data.length });
      });
    });
    
    req.on('error', (err) => {
      console.error('请求错误:', err.message);
      resolve({ error: err.message });
    });
    
    req.end();
  });
}

// 测试API性能
function testApiPerformance() {
  return new Promise((resolve) => {
    const start = performance.now();
    
    const req = http.get('http://localhost:3001/api/products', (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const end = performance.now();
        const responseTime = end - start;
        
        console.log(`API性能测试:`);
        console.log(`- 状态码: ${res.statusCode}`);
        console.log(`- 响应时间: ${responseTime.toFixed(2)}ms`);
        console.log(`- 响应大小: ${data.length} bytes`);
        console.log('');
        
        resolve({ responseTime, statusCode: res.statusCode, size: data.length });
      });
    });
    
    req.on('error', (err) => {
      console.error('API请求错误:', err.message);
      resolve({ error: err.message });
    });
    
    req.end();
  });
}

// 运行性能测试
async function runPerformanceTests() {
  console.log('=== 库存管理系统性能测试 ===\n');
  
  // 测试页面加载
  const pageResult = await testPageLoad();
  
  // 等待一秒
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 测试API
  const apiResult = await testApiPerformance();
  
  // 总结
  console.log('=== 性能测试总结 ===');
  if (pageResult.loadTime) {
    console.log(`页面加载时间: ${pageResult.loadTime.toFixed(2)}ms`);
  }
  if (apiResult.responseTime) {
    console.log(`API响应时间: ${apiResult.responseTime.toFixed(2)}ms`);
  }
  
  // 性能评估
  console.log('\n=== 性能评估 ===');
  if (pageResult.loadTime < 500) {
    console.log('✅ 页面加载性能: 优秀 (< 500ms)');
  } else if (pageResult.loadTime < 1000) {
    console.log('⚠️ 页面加载性能: 良好 (500-1000ms)');
  } else {
    console.log('❌ 页面加载性能: 需要优化 (> 1000ms)');
  }
  
  if (apiResult.responseTime < 100) {
    console.log('✅ API响应性能: 优秀 (< 100ms)');
  } else if (apiResult.responseTime < 300) {
    console.log('⚠️ API响应性能: 良好 (100-300ms)');
  } else {
    console.log('❌ API响应性能: 需要优化 (> 300ms)');
  }
}

// 运行测试
runPerformanceTests().catch(console.error);