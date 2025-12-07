const fetch = require('node-fetch');

async function testFixes() {
  console.log('🔧 测试修复后的系统...\n');

  // 测试1: 检查API端口配置
  console.log('1. 测试API端口配置...');
  try {
    const response = await fetch('http://localhost:3002/api/health');
    if (response.ok) {
      console.log('   ✅ API端口3002正常工作');
    } else {
      console.log('   ❌ API端口3002无法访问');
    }
  } catch (error) {
    console.log('   ❌ API端口3002连接失败:', error.message);
  }

  // 测试2: 检查customers API路径
  console.log('\n2. 测试customers API路径...');
  try {
    const response = await fetch('http://localhost:3002/api/customers');
    if (response.ok) {
      console.log('   ✅ customers API路径正常');
    } else {
      console.log('   ❌ customers API路径错误');
    }
  } catch (error) {
    console.log('   ❌ customers API连接失败:', error.message);
  }

  // 测试3: 检查重复请求问题
  console.log('\n3. 检查重复请求问题...');
  console.log('   📊 请观察浏览器开发者工具中的网络请求');
  console.log('   📊 应该不再有无限循环的ensure-admin和auth/me请求');

  console.log('\n🎉 修复测试完成！');
  console.log('\n📋 系统访问信息:');
  console.log('   🌐 前端地址: http://localhost:3002');
  console.log('   👤 管理员账号: 79122706664');
  console.log('   🔑 管理员密码: PRAISEJEANS.888');
}

testFixes().catch(console.error);