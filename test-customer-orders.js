const fetch = require('node-fetch');

async function testCustomerOrders() {
  try {
    // 首先登录获取token
    const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: '79122706664',
        password: 'PRAISEJEANS.888'
      })
    });

    if (!loginResponse.ok) {
      console.error('登录失败:', await loginResponse.text());
      return;
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;

    console.log('✅ 登录成功');

    // 测试获取客户订单
    const customerId = 'cmiojwasp003zfy22h9wygvpp';
    const ordersResponse = await fetch(`http://localhost:3001/api/orders?customerId=${customerId}`, {
      headers: {
        'Cookie': `auth-token=${token}`
      }
    });

    if (!ordersResponse.ok) {
      console.error('获取客户订单失败:', await ordersResponse.text());
      return;
    }

    const ordersData = await ordersResponse.json();
    console.log('✅ 获取客户订单成功');
    console.log('订单数据:', JSON.stringify(ordersData, null, 2));

    // 测试获取客户购买记录
    const purchasesResponse = await fetch(`http://localhost:3001/api/purchases?customerId=${customerId}`, {
      headers: {
        'Cookie': `auth-token=${token}`
      }
    });

    if (!purchasesResponse.ok) {
      console.error('获取客户购买记录失败:', await purchasesResponse.text());
      return;
    }

    const purchasesData = await purchasesResponse.json();
    console.log('✅ 获取客户购买记录成功');
    console.log('购买记录数据:', JSON.stringify(purchasesData, null, 2));

  } catch (error) {
    console.error('测试失败:', error);
  }
}

testCustomerOrders();