// 简单的测试数据创建脚本
// 直接通过API创建测试数据

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
async function createSimpleCustomers(token) {
  console.log('👥 创建测试客户...');
  
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': `auth-token=${token}`
  };

  // 使用随机手机号避免冲突
  const randomSuffix = Math.floor(Math.random() * 10000);
  const testCustomers = [
    { name: '测试客户A', phone: `7912345${randomSuffix.toString().padStart(4, '0')}` },
    { name: '测试客户B', phone: `7912345${(randomSuffix + 1).toString().padStart(4, '0')}` }
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
        console.log(`✅ 创建客户成功: ${customer.name} (${customer.phone})`);
      } else {
        console.error(`❌ 创建客户失败: ${customer.name}, 错误: ${result.error}`);
      }
    } else {
      console.error(`❌ 创建客户失败: ${customer.name}, HTTP错误: ${response.status}`);
    }
  }

  return createdCustomers;
}

// 创建测试产品
async function createSimpleProducts(token) {
  console.log('📦 创建测试产品...');
  
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': `auth-token=${token}`
  };

  // 使用随机SKU避免冲突
  const randomSuffix = Math.floor(Math.random() * 1000);
  const testProducts = [
    { sku: `TEST${randomSuffix.toString().padStart(3, '0')}`, initialStock: 100, price: 1000 },
    { sku: `TEST${(randomSuffix + 1).toString().padStart(3, '0')}`, initialStock: 50, price: 2000 }
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
async function createSimpleTestData() {
  console.log('🚀 开始创建简单测试数据...\n');

  try {
    // 1. 登录获取token
    const token = await login();
    if (!token) {
      console.error('❌ 登录失败，终止测试数据创建');
      return;
    }

    // 2. 创建测试客户
    const customers = await createSimpleCustomers(token);
    console.log(`📊 创建了 ${customers.length} 个客户`);

    // 3. 创建测试产品
    const products = await createSimpleProducts(token);
    console.log(`📊 创建了 ${products.length} 个产品`);

    console.log('\n✅ 测试数据创建完成！');
    console.log('📊 创建总结:');
    console.log(`- 客户数量: ${customers.length}`);
    console.log(`- 产品数量: ${products.length}`);

    if (customers.length > 0 && products.length > 0) {
      console.log('\n🎉 现在可以运行订单管理流程测试了！');
      console.log('命令: node test-order-flow.js');
    }

  } catch (error) {
    console.error('❌ 创建过程中发生错误:', error);
  }
}

// 运行创建
createSimpleTestData();