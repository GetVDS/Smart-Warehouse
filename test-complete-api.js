const http = require('http');

// 测试函数
function testApi(path, method = 'GET', data = null, authToken = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
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

async function runTests() {
  console.log('🧪 开始完整API测试...\n');

  try {
    // 测试健康检查
    console.log('1. 测试健康检查...');
    const health = await testApi('/api/health');
    console.log(`状态码: ${health.statusCode}`);
    console.log(`响应: ${health.body}\n`);

    // 测试登录
    console.log('2. 测试登录...');
    const loginData = {
      phone: '79122706664',
      password: 'PRAISEJEANS.888'
    };
    const login = await testApi('/api/auth/login', 'POST', loginData);
    console.log(`状态码: ${login.statusCode}`);
    console.log(`响应: ${login.body}\n`);

    let authToken = null;
    if (login.statusCode === 200) {
      try {
        const loginResponse = JSON.parse(login.body);
        authToken = loginResponse.data.token;
        console.log('✅ 登录成功，获取到令牌\n');
        console.log(`令牌信息: 用户ID=${loginResponse.data.user.id}, 用户名=${loginResponse.data.user.name}\n`);
      } catch (e) {
        console.log('❌ 解析登录响应失败\n');
        console.log('错误详情:', e.message);
        console.log('原始响应:', login.body);
      }
    }

    // 如果有令牌，测试受保护的API
    if (authToken) {
      // 测试产品API
      console.log('3. 测试产品API...');
      const products = await testApi('/api/products', 'GET', null, authToken);
      console.log(`状态码: ${products.statusCode}`);
      if (products.statusCode === 200) {
        try {
          const productsData = JSON.parse(products.body);
          console.log(`产品数量: ${productsData.length || 0}`);
          if (productsData.length > 0) {
            console.log(`第一个产品: ${JSON.stringify(productsData[0], null, 2)}`);
          }
        } catch (e) {
          console.log('解析产品响应失败');
          console.log(`原始响应: ${products.body}`);
        }
      } else {
        console.log(`响应: ${products.body}`);
      }

      // 测试客户API
      console.log('\n4. 测试客户API...');
      const customers = await testApi('/api/customers', 'GET', null, authToken);
      console.log(`状态码: ${customers.statusCode}`);
      if (customers.statusCode === 200) {
        try {
          const customersData = JSON.parse(customers.body);
          console.log(`客户数量: ${customersData.length || 0}`);
          if (customersData.length > 0) {
            console.log(`第一个客户: ${JSON.stringify(customersData[0], null, 2)}`);
          }
        } catch (e) {
          console.log('解析客户响应失败');
          console.log(`原始响应: ${customers.body}`);
        }
      } else {
        console.log(`响应: ${customers.body}`);
      }

      // 测试订单API
      console.log('\n5. 测试订单API...');
      const orders = await testApi('/api/orders', 'GET', null, authToken);
      console.log(`状态码: ${orders.statusCode}`);
      if (orders.statusCode === 200) {
        try {
          const ordersData = JSON.parse(orders.body);
          console.log(`订单数量: ${ordersData.length || 0}`);
          if (ordersData.length > 0) {
            console.log(`第一个订单: ${JSON.stringify(ordersData[0], null, 2)}`);
          }
        } catch (e) {
          console.log('解析订单响应失败');
          console.log(`原始响应: ${orders.body}`);
        }
      } else {
        console.log(`响应: ${orders.body}`);
      }

      // 测试创建新产品
      console.log('\n6. 测试创建新产品...');
      const newProduct = {
        id: `test-product-${Date.now()}`,
        name: '测试产品',
        description: '这是一个测试产品',
        price: 99.99,
        stock: 100,
        category: '测试分类'
      };
      const createProduct = await testApi('/api/products', 'POST', newProduct, authToken);
      console.log(`状态码: ${createProduct.statusCode}`);
      console.log(`响应: ${createProduct.body}`);

      // 测试创建新客户
      console.log('\n7. 测试创建新客户...');
      const newCustomer = {
        name: '测试客户',
        phone: `test-phone-${Date.now()}`,
        email: 'test@example.com',
        address: '测试地址'
      };
      const createCustomer = await testApi('/api/customers', 'POST', newCustomer, authToken);
      console.log(`状态码: ${createCustomer.statusCode}`);
      console.log(`响应: ${createCustomer.body}`);

    } else {
      console.log('❌ 无法获取认证令牌，跳过受保护的API测试');
    }

  } catch (error) {
    console.error('测试出错:', error.message);
  }
}

runTests();