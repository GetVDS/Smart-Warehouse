const http = require('http');

// 测试函数
function testApi(path, method = 'GET', data = null) {
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
  console.log('🧪 开始测试API...\n');

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
        authToken = loginResponse.token;
        console.log('✅ 登录成功，获取到令牌\n');
      } catch (e) {
        console.log('❌ 解析登录响应失败\n');
      }
    }

    // 如果有令牌，测试受保护的API
    if (authToken) {
      console.log('3. 测试产品API...');
      const productsOptions = {
        hostname: 'localhost',
        port: 3002,
        path: '/api/products',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      };

      const products = await new Promise((resolve, reject) => {
        const req = http.request(productsOptions, (res) => {
          let body = '';
          res.on('data', (chunk) => {
            body += chunk;
          });
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode,
              body: body
            });
          });
        });

        req.on('error', (err) => {
          reject(err);
        });

        req.end();
      });

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
    }

  } catch (error) {
    console.error('测试出错:', error.message);
  }
}

runTests();