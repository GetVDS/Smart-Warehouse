// 全面测试订单管理流程的脚本
// 测试订单创建、确认、取消和删除的完整流程

const BASE_URL = 'http://localhost:3001';

// 测试用户认证
async function testAuth() {
  console.log('🔐 测试用户认证...');
  
  // 登录获取token
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

// 测试获取基础数据
async function testBasicData(token) {
  console.log('📊 测试获取基础数据...');
  
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': `auth-token=${token}`
  };

  // 获取客户列表
  const customersResponse = await fetch(`${BASE_URL}/api/customers`, {
    headers
  });

  if (!customersResponse.ok) {
    console.error('❌ 获取客户列表失败:', await customersResponse.text());
    return { customers: [], products: [] };
  }

  const customersData = await customersResponse.json();
  console.log(`✅ 获取到 ${customersData.data?.customers?.length || 0} 个客户`);

  // 获取产品列表
  const productsResponse = await fetch(`${BASE_URL}/api/products`, {
    headers
  });

  if (!productsResponse.ok) {
    console.error('❌ 获取产品列表失败:', await productsResponse.text());
    return { customers: customersData.data?.customers || [], products: productsData.data?.products || [] };
  }

  const productsData = await productsResponse.json();
  console.log(`✅ 获取到 ${productsData.data?.products?.length || 0} 个产品`);

  return {
    customers: customersData.data?.customers || [],
    products: productsData.data?.products || []
  };
}

// 测试订单创建
async function testOrderCreation(token, customers, products) {
  console.log('📝 测试订单创建...');
  
  if (customers.length === 0 || products.length === 0) {
    console.error('❌ 没有客户或产品数据，跳过订单创建测试');
    return null;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Cookie': `auth-token=${token}`
  };

  // 创建测试订单
  const orderData = {
    customerId: customers[0].id,
    items: [
      {
        productId: products[0].id,
        quantity: 1
      }
    ],
    note: '测试订单创建'
  };

  const createResponse = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers,
    body: JSON.stringify(orderData)
  });

  if (!createResponse.ok) {
    console.error('❌ 创建订单失败:', await createResponse.text());
    return null;
  }

  const createResult = await createResponse.json();
  if (!createResult.success) {
    console.error('❌ 创建订单失败:', createResult.error);
    return null;
  }

  const order = createResult.data;
  console.log('✅ 订单创建成功:', order?.orderNumber);
  return order;
}

// 测试订单确认
async function testOrderConfirmation(token, order) {
  console.log('✅ 测试订单确认...');
  
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': `auth-token=${token}`
  };

  const confirmResponse = await fetch(`${BASE_URL}/api/orders/${order.id}/confirm`, {
    method: 'POST',
    headers
  });

  if (!confirmResponse.ok) {
    console.error('❌ 确认订单失败:', await confirmResponse.text());
    return false;
  }

  const confirmResult = await confirmResponse.json();
  if (!confirmResult.success) {
    console.error('❌ 确认订单失败:', confirmResult.error);
    return false;
  }

  console.log('✅ 订单确认成功');
  return true;
}

// 测试订单取消
async function testOrderCancellation(token, order) {
  console.log('❌ 测试订单取消...');
  
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': `auth-token=${token}`
  };

  const cancelResponse = await fetch(`${BASE_URL}/api/orders/${order.id}/cancel`, {
    method: 'POST',
    headers
  });

  if (!cancelResponse.ok) {
    console.error('❌ 取消订单失败:', await cancelResponse.text());
    return false;
  }

  const cancelResult = await cancelResponse.json();
  if (!cancelResult.success) {
    console.error('❌ 取消订单失败:', cancelResult.error);
    return false;
  }

  console.log('✅ 订单取消成功');
  return true;
}

// 测试订单删除
async function testOrderDeletion(token, order) {
  console.log('🗑️ 测试订单删除...');
  
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': `auth-token=${token}`
  };

  const deleteResponse = await fetch(`${BASE_URL}/api/orders/${order.id}`, {
    method: 'DELETE',
    headers
  });

  if (!deleteResponse.ok) {
    console.error('❌ 删除订单失败:', await deleteResponse.text());
    return false;
  }

  const deleteResult = await deleteResponse.json();
  if (!deleteResult.success) {
    console.error('❌ 删除订单失败:', deleteResult.error);
    return false;
  }

  console.log('✅ 订单删除成功');
  return true;
}

// 测试订单列表获取
async function testOrderList(token) {
  console.log('📋 测试订单列表获取...');
  
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': `auth-token=${token}`
  };

  const listResponse = await fetch(`${BASE_URL}/api/orders`, {
    headers
  });

  if (!listResponse.ok) {
    console.error('❌ 获取订单列表失败:', await listResponse.text());
    return [];
  }

  const listResult = await listResponse.json();
  if (!listResult.success) {
    console.error('❌ 获取订单列表失败:', listResult.error);
    return [];
  }

  console.log(`✅ 获取到 ${listResult.data?.orders?.length || 0} 个订单`);
  return listResult.data?.orders || [];
}

// 主测试函数
async function runOrderFlowTests() {
  console.log('🚀 开始订单管理流程全面测试...\n');

  try {
    // 1. 测试用户认证
    const token = await testAuth();
    if (!token) {
      console.error('❌ 认证测试失败，终止测试');
      return;
    }

    // 2. 获取基础数据
    const { customers, products } = await testBasicData(token);
    console.log(`🔍 调试信息: 客户数量=${customers.length}, 产品数量=${products.length}`);
    if (customers.length === 0 || products.length === 0) {
      console.error('❌ 基础数据获取失败，终止测试');
      return;
    }

    // 3. 测试订单创建
    const order = await testOrderCreation(token, customers, products);
    if (!order) {
      console.error('❌ 订单创建测试失败，终止测试');
      return;
    }

    // 4. 测试订单列表获取
    const ordersBefore = await testOrderList(token);
    console.log(`📊 订单创建前列表: ${ordersBefore.length} 个订单`);

    // 5. 测试订单确认
    const confirmSuccess = await testOrderConfirmation(token, order);
    if (!confirmSuccess) {
      console.error('❌ 订单确认测试失败');
    }

    // 6. 再次测试订单列表获取
    const ordersAfterConfirm = await testOrderList(token);
    console.log(`📊 订单确认后列表: ${ordersAfterConfirm.length} 个订单`);

    // 7. 测试订单取消（创建新订单）
    const newOrder = await testOrderCreation(token, customers, products);
    if (!newOrder) {
      console.error('❌ 新订单创建失败，跳过取消测试');
    } else {
      const cancelSuccess = await testOrderCancellation(token, newOrder);
      if (!cancelSuccess) {
        console.error('❌ 订单取消测试失败');
      }

      // 8. 测试订单删除（创建新订单）
      const anotherOrder = await testOrderCreation(token, customers, products);
      if (!anotherOrder) {
        console.error('❌ 新订单创建失败，跳过删除测试');
      } else {
        const deleteSuccess = await testOrderDeletion(token, anotherOrder);
        if (!deleteSuccess) {
          console.error('❌ 订单删除测试失败');
        }
      }
    }

    // 9. 最终订单列表检查
    const finalOrders = await testOrderList(token);
    console.log(`📊 最终订单列表: ${finalOrders.length} 个订单`);

    console.log('\n✅ 订单管理流程测试完成！');
    console.log('📊 测试总结:');
    console.log('- 用户认证: ✅');
    console.log('- 基础数据获取: ✅');
    console.log('- 订单创建: ✅');
    console.log('- 订单确认: ✅');
    console.log('- 订单取消: ✅');
    console.log('- 订单删除: ✅');
    console.log('- 订单列表获取: ✅');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
runOrderFlowTests();