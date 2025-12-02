// 初始化测试数据的脚本
// 创建测试客户和产品

const BASE_URL = 'http://localhost:3001';

// 测试用户认证
async function login() {
  console.log('🔐 登录获取认证token...');
  
  const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phone: '79122706664', // 管理员手机号
      password: 'PRAISEJEANS.888'
    })
  });

  if (!loginResponse.ok) {
    console.error('❌ 登录失败:', await loginResponse.text());
    return null;
  }

  const loginData = await loginResponse.json();
  if (!loginData.success) {
    console.error('❌ 登录失败:', loginData.error);
    return null;
  }

  console.log('✅ 登录成功');
  return loginData.token;
}

// 创建测试客户
async function createTestCustomers(token) {
  console.log('👥 创建测试客户...');
  
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': `auth-token=${token}`
  };

  const testCustomers = [
    { name: '测试客户1', phone: '79123456781' },
    { name: '测试客户2', phone: '79123456782' },
    { name: '测试客户3', phone: '79123456783' }
  ];

  const createdCustomers = [];

  for (const customer of testCustomers) {
    const response = await fetch(`${BASE_URL}/api/customers`, {
      method: 'POST',
      headers,
      body: JSON.stringify(customer)
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        createdCustomers.push(result.customer);
        console.log(`✅ 创建客户成功: ${customer.name}`);
      } else {
        console.error(`❌ 创建客户失败: ${customer.name}, 错误: ${result.error}`);
        // 如果客户已存在，尝试获取现有客户
        if (result.error && result.error.includes('已存在')) {
          console.log(`📝 尝试获取现有客户: ${customer.phone}`);
          const getResponse = await fetch(`${BASE_URL}/api/customers`, { headers });
          if (getResponse.ok) {
            const getData = await getResponse.json();
            if (getData.success && getData.customers) {
              const existingCustomer = getData.customers.find(c => c.phone === customer.phone);
              if (existingCustomer) {
                createdCustomers.push(existingCustomer);
                console.log(`✅ 获取现有客户成功: ${customer.name}`);
              }
            }
          }
        }
      }
    } else {
      console.error(`❌ 创建客户失败: ${customer.name}, HTTP错误: ${response.status}`);
      // 如果客户已存在，尝试获取现有客户
      const errorText = await response.text();
      if (errorText.includes('已存在')) {
        console.log(`📝 尝试获取现有客户: ${customer.phone}`);
        const getResponse = await fetch(`${BASE_URL}/api/customers`, { headers });
        if (getResponse.ok) {
          const getData = await getResponse.json();
          if (getData.success && getData.customers) {
            const existingCustomer = getData.customers.find(c => c.phone === customer.phone);
            if (existingCustomer) {
              createdCustomers.push(existingCustomer);
              console.log(`✅ 获取现有客户成功: ${customer.name}`);
            }
          }
        }
      }
    }
  }

  return createdCustomers;
}

// 创建测试产品
async function createTestProducts(token) {
  console.log('📦 创建测试产品...');
  
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': `auth-token=${token}`
  };

  const testProducts = [
    { sku: 'TEST001', initialStock: 100, price: 1000 },
    { sku: 'TEST002', initialStock: 50, price: 2000 },
    { sku: 'TEST003', initialStock: 75, price: 1500 }
  ];

  const createdProducts = [];

  for (const product of testProducts) {
    const response = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers,
      body: JSON.stringify(product)
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        createdProducts.push(result.product);
        console.log(`✅ 创建产品成功: ${product.sku}`);
      } else {
        console.error(`❌ 创建产品失败: ${product.sku}, 错误: ${result.error}`);
      }
    } else {
      console.error(`❌ 创建产品失败: ${product.sku}, HTTP错误: ${response.status}`);
    }
  }

  return createdProducts;
}

// 主函数
async function initTestData() {
  console.log('🚀 开始初始化测试数据...\n');

  try {
    // 1. 登录获取token
    const token = await login();
    if (!token) {
      console.error('❌ 登录失败，终止测试数据初始化');
      return;
    }

    // 2. 创建测试客户
    const customers = await createTestCustomers(token);
    console.log(`📊 创建了 ${customers.length} 个客户`);

    // 3. 创建测试产品
    const products = await createTestProducts(token);
    console.log(`📊 创建了 ${products.length} 个产品`);

    console.log('\n✅ 测试数据初始化完成！');
    console.log('📊 初始化总结:');
    console.log(`- 客户数量: ${customers.length}`);
    console.log(`- 产品数量: ${products.length}`);

    if (customers.length > 0 && products.length > 0) {
      console.log('\n🎉 现在可以运行订单管理流程测试了！');
      console.log('命令: node test-order-flow.js');
    } else {
      // 如果没有创建成功，尝试获取现有数据
      console.log('\n📝 尝试获取现有数据...');
      
      const customersResponse = await fetch(`${BASE_URL}/api/customers`, {
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth-token=${token}`
        }
      });
      
      const productsResponse = await fetch(`${BASE_URL}/api/products`, {
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth-token=${token}`
        }
      });
      
      if (customersResponse.ok && productsResponse.ok) {
        const customersData = await customersResponse.json();
        const productsData = await productsResponse.json();
        
        const existingCustomers = customersData.customers || [];
        const existingProducts = productsData.products || [];
        
        console.log(`📊 找到 ${existingCustomers.length} 个现有客户`);
        console.log(`📊 找到 ${existingProducts.length} 个现有产品`);
        
        if (existingCustomers.length > 0 && existingProducts.length > 0) {
          console.log('\n🎉 现在可以运行订单管理流程测试了！');
          console.log('命令: node test-order-flow.js');
        }
      }
    }

  } catch (error) {
    console.error('❌ 初始化过程中发生错误:', error);
  }
}

// 运行初始化
initTestData();