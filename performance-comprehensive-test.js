const http = require('http');
const { performance } = require('perf_hooks');

// 测试页面加载性能
function testPageLoad(path = '/') {
  return new Promise((resolve) => {
    const start = performance.now();
    
    const req = http.get(`http://localhost:3001${path}`, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const end = performance.now();
        const loadTime = end - start;
        
        console.log(`${path} 页面加载性能测试:`);
        console.log(`- 状态码: ${res.statusCode}`);
        console.log(`- 响应时间: ${loadTime.toFixed(2)}ms`);
        console.log(`- 响应大小: ${data.length} bytes`);
        console.log('');
        
        resolve({ path, loadTime, statusCode: res.statusCode, size: data.length });
      });
    });
    
    req.on('error', (err) => {
      console.error(`${path} 请求错误:`, err.message);
      resolve({ path, error: err.message });
    });
    
    req.end();
  });
}

// 测试API性能
function testApiPerformance(path) {
  return new Promise((resolve) => {
    const start = performance.now();
    
    const req = http.get(`http://localhost:3001${path}`, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const end = performance.now();
        const responseTime = end - start;
        
        console.log(`${path} API性能测试:`);
        console.log(`- 状态码: ${res.statusCode}`);
        console.log(`- 响应时间: ${responseTime.toFixed(2)}ms`);
        console.log(`- 响应大小: ${data.length} bytes`);
        console.log('');
        
        resolve({ path, responseTime, statusCode: res.statusCode, size: data.length });
      });
    });
    
    req.on('error', (err) => {
      console.error(`${path} API请求错误:`, err.message);
      resolve({ path, error: err.message });
    });
    
    req.end();
  });
}

// 运行性能测试
async function runComprehensiveTests() {
  console.log('=== 库存管理系统综合性能测试 ===\n');
  
  // 测试所有页面
  const pages = ['/', '/login', '/customers', '/orders'];
  const pageResults = [];
  
  for (const page of pages) {
    const result = await testPageLoad(page);
    pageResults.push(result);
    await new Promise(resolve => setTimeout(resolve, 500)); // 等待500ms
  }
  
  // 测试所有API（预期401，因为需要认证）
  const apis = ['/api/products', '/api/customers', '/api/orders', '/api/purchases'];
  const apiResults = [];
  
  for (const api of apis) {
    const result = await testApiPerformance(api);
    apiResults.push(result);
    await new Promise(resolve => setTimeout(resolve, 500)); // 等待500ms
  }
  
  // 测试不需要认证的API
  const publicApiResults = [];
  const publicApis = ['/api/ensure-admin'];
  
  for (const api of publicApis) {
    // 使用POST请求测试
    await testPostApi(api);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // 总结
  console.log('=== 性能测试总结 ===');
  
  // 页面性能总结
  const validPageResults = pageResults.filter(r => !r.error && r.statusCode === 200);
  if (validPageResults.length > 0) {
    const avgPageLoadTime = validPageResults.reduce((sum, r) => sum + r.loadTime, 0) / validPageResults.length;
    console.log(`页面平均加载时间: ${avgPageLoadTime.toFixed(2)}ms`);
    
    const fastestPage = validPageResults.reduce((min, r) => r.loadTime < min.loadTime ? r : min);
    const slowestPage = validPageResults.reduce((max, r) => r.loadTime > max.loadTime ? r : max);
    console.log(`最快页面: ${fastestPage.path} (${fastestPage.loadTime.toFixed(2)}ms)`);
    console.log(`最慢页面: ${slowestPage.path} (${slowestPage.loadTime.toFixed(2)}ms)`);
  }
  
  // API性能总结
  const validApiResults = apiResults.filter(r => !r.error);
  if (validApiResults.length > 0) {
    const avgApiResponseTime = validApiResults.reduce((sum, r) => sum + r.responseTime, 0) / validApiResults.length;
    console.log(`API平均响应时间: ${avgApiResponseTime.toFixed(2)}ms`);
    
    const fastestApi = validApiResults.reduce((min, r) => r.responseTime < min.responseTime ? r : min);
    const slowestApi = validApiResults.reduce((max, r) => r.responseTime > max.responseTime ? r : max);
    console.log(`最快API: ${fastestApi.path} (${fastestApi.responseTime.toFixed(2)}ms)`);
    console.log(`最慢API: ${slowestApi.path} (${slowestApi.responseTime.toFixed(2)}ms)`);
  }
  
  // 性能评估
  console.log('\n=== 性能评估 ===');
  
  if (validPageResults.length > 0) {
    const avgPageLoadTime = validPageResults.reduce((sum, r) => sum + r.loadTime, 0) / validPageResults.length;
    if (avgPageLoadTime < 200) {
      console.log('✅ 页面加载性能: 优秀 (< 200ms)');
    } else if (avgPageLoadTime < 500) {
      console.log('⚠️ 页面加载性能: 良好 (200-500ms)');
    } else {
      console.log('❌ 页面加载性能: 需要优化 (> 500ms)');
    }
  }
  
  if (validApiResults.length > 0) {
    const avgApiResponseTime = validApiResults.reduce((sum, r) => sum + r.responseTime, 0) / validApiResults.length;
    if (avgApiResponseTime < 100) {
      console.log('✅ API响应性能: 优秀 (< 100ms)');
    } else if (avgApiResponseTime < 300) {
      console.log('⚠️ API响应性能: 良好 (100-300ms)');
    } else {
      console.log('❌ API响应性能: 需要优化 (> 300ms)');
    }
  }
}

// 测试POST API
function testPostApi(path) {
  return new Promise((resolve) => {
    const start = performance.now();
    
    const postData = JSON.stringify({});
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const end = performance.now();
        const responseTime = end - start;
        
        console.log(`${path} API POST测试:`);
        console.log(`- 状态码: ${res.statusCode}`);
        console.log(`- 响应时间: ${responseTime.toFixed(2)}ms`);
        console.log(`- 响应大小: ${data.length} bytes`);
        console.log('');
        
        resolve({ path, responseTime, statusCode: res.statusCode, size: data.length });
      });
    });
    
    req.on('error', (err) => {
      console.error(`${path} POST请求错误:`, err.message);
      resolve({ path, error: err.message });
    });
    
    req.write(postData);
    req.end();
  });
}

// 运行测试
runComprehensiveTests().catch(console.error);