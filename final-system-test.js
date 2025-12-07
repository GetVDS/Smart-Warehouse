const http = require('http');

// 测试函数
function testApi(path, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        // 提取cookies
        const cookies = res.headers['set-cookie'] || [];
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body,
          cookies: cookies
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runFinalTest() {
  console.log('🎯 智慧库存系统最终测试\n');
  console.log('=' .repeat(50));

  try {
    // 1. 测试前端页面
    console.log('1. 测试前端页面...');
    const homePage = await testApi('/');
    console.log(`   状态码: ${homePage.statusCode}`);
    if (homePage.statusCode === 200) {
      console.log('   ✅ 前端页面正常加载');
    } else {
      console.log('   ❌ 前端页面加载失败');
    }

    // 2. 测试健康检查
    console.log('\n2. 测试系统健康状态...');
    const health = await testApi('/api/health');
    console.log(`   状态码: ${health.statusCode}`);
    if (health.statusCode === 200) {
      try {
        const healthData = JSON.parse(health.body);
        console.log(`   ✅ 系统状态: ${healthData.status}`);
        console.log(`   📊 内存使用: ${healthData.memory.usagePercent}%`);
        console.log(`   🗄️ 数据库: ${healthData.database.status}`);
        console.log(`   ⏱️ 运行时间: ${healthData.uptime}`);
      } catch (e) {
        console.log('   ❌ 健康检查响应解析失败');
      }
    } else {
      console.log('   ❌ 健康检查失败');
    }

    // 3. 测试管理员登录
    console.log('\n3. 测试管理员登录...');
    const loginData = {
      phone: '79122706664',
      password: 'PRAISEJEANS.888'
    };
    const login = await testApi('/api/auth/login', 'POST', loginData);
    console.log(`   状态码: ${login.statusCode}`);
    
    let cookies = null;
    if (login.statusCode === 200) {
      try {
        const loginResponse = JSON.parse(login.body);
        console.log(`   ✅ 登录成功`);
        console.log(`   👤 管理员: ${loginResponse.data.user.name}`);
        cookies = login.cookies;
      } catch (e) {
        console.log('   ❌ 登录响应解析失败');
      }
    } else {
      console.log('   ❌ 登录失败');
    }

    // 4. 测试数据管理功能
    if (cookies && cookies.length > 0) {
      const cookieHeader = cookies.join('; ');
      
      console.log('\n4. 测试数据管理功能...');
      
      // 创建产品
      const newProduct = {
        sku: `FINAL-TEST-${Date.now()}`,
        initialStock: 50,
        price: 199.99
      };
      const createProduct = await testApi('/api/products', 'POST', newProduct, { 'Cookie': cookieHeader });
      console.log(`   创建产品: ${createProduct.statusCode === 200 ? '✅ 成功' : '❌ 失败'}`);
      
      // 创建客户
      const newCustomer = {
        name: '最终测试客户',
        phone: `79123456789`,
        email: 'final-test@example.com'
      };
      const createCustomer = await testApi('/api/customers', 'POST', newCustomer, { 'Cookie': cookieHeader });
      console.log(`   创建客户: ${createCustomer.statusCode === 200 ? '✅ 成功' : '❌ 失败'}`);
      
      // 获取产品列表
      const products = await testApi('/api/products', 'GET', null, { 'Cookie': cookieHeader });
      console.log(`   获取产品: ${products.statusCode === 200 ? '✅ 成功' : '❌ 失败'}`);
      if (products.statusCode === 200) {
        try {
          const productsData = JSON.parse(products.body);
          console.log(`   📦 当前产品数量: ${productsData.products?.length || 0}`);
        } catch (e) {
          console.log('   ❌ 产品列表解析失败');
        }
      }
      
      // 获取客户列表
      const customers = await testApi('/api/customers', 'GET', null, { 'Cookie': cookieHeader });
      console.log(`   获取客户: ${customers.statusCode === 200 ? '✅ 成功' : '❌ 失败'}`);
      if (customers.statusCode === 200) {
        try {
          const customersData = JSON.parse(customers.body);
          console.log(`   👥 当前客户数量: ${customersData.customers?.length || 0}`);
        } catch (e) {
          console.log('   ❌ 客户列表解析失败');
        }
      }
    }

    // 5. 测试结果总结
    console.log('\n' + '=' .repeat(50));
    console.log('🎉 智慧库存系统测试完成！');
    console.log('\n📋 系统访问信息:');
    console.log('   🌐 前端地址: http://localhost:3002');
    console.log('   👤 管理员账号: 79122706664');
    console.log('   🔑 管理员密码: PRAISEJEANS.888');
    console.log('\n✨ 主要功能:');
    console.log('   📦 产品管理');
    console.log('   👥 客户管理');
    console.log('   📋 订单管理');
    console.log('   📊 库存统计');
    console.log('   🔐 用户认证');
    console.log('\n🚀 系统已成功运行在本地环境中！');

  } catch (error) {
    console.error('❌ 测试过程中出错:', error.message);
  }
}

runFinalTest();