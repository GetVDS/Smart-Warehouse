# 部署后"网络错误"问题综合分析报告

## 问题概述
项目在本地运行正常，但部署到生产环境后出现"网络错误"，导致前端无法正常调用API。

## 根本原因分析

### 1. API客户端配置问题 (关键问题)

**问题位置**: [`src/lib/client-api.ts:27-30`](src/lib/client-api.ts:27-30)

**问题描述**:
```typescript
constructor() {
  this.baseUrl = process.env.NODE_ENV === 'production'
    ? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001')
    : 'http://localhost:3001';
}
```

**问题分析**:
1. **端口不匹配**: 本地开发使用端口 3001，但Docker容器中应用运行在端口 3000
2. **生产环境逻辑错误**: 在生产环境中使用 `window.location.origin` 会导致HTTPS域名问题
3. **环境变量缺失**: 没有使用正确的环境变量来配置API基础URL

### 2. 登录页面API请求问题

**问题位置**: [`src/app/login/page.tsx:21`](src/app/login/page.tsx:21)

**问题描述**:
```typescript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ phone, password }),
});
```

**问题分析**: 
- 使用相对路径 `/api/auth/login`，在生产环境中会请求 `https://domain.com/api/auth/login`
- 但Nginx配置可能没有正确代理这些路径

### 3. CORS和安全配置问题

**问题位置**: [`src/lib/security.ts:31-33`](src/lib/security.ts:31-33)

**问题描述**:
```typescript
ALLOWED_ORIGINS: process.env.NODE_ENV === 'production'
  ? (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [process.env.NEXTAUTH_URL || 'https://localhost:3000'])
  : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
```

**问题分析**:
- 生产环境CORS配置依赖于环境变量，可能配置不正确
- 本地开发环境包含端口3001，但实际应用运行在3000

### 4. Docker容器网络配置问题

**问题位置**: [`docker-compose.yml:7`](docker-compose.yml:7) 和 [`Dockerfile:69`](Dockerfile:69)

**问题描述**:
- Docker容器暴露端口3000
- 但API客户端配置期望端口3001
- 端口映射不一致导致网络请求失败

### 5. Nginx反向代理配置问题

**问题位置**: [`deploy.sh:425-442`](deploy.sh:425-442)

**问题描述**:
- Nginx配置的API路由可能不完整
- CORS头配置可能与应用不匹配
- 上游服务器配置可能有问题

## 解决方案

### 1. 修复API客户端配置
```typescript
constructor() {
  // 使用环境变量配置API基础URL
  if (process.env.NODE_ENV === 'production') {
    // 生产环境使用当前域名
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 
      (typeof window !== 'undefined' ? window.location.origin : '');
  } else {
    // 开发环境使用配置的端口
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  }
}
```

### 2. 统一端口配置
- 所有配置统一使用端口3000
- 更新环境变量和配置文件
- 确保Docker、Nginx和应用配置一致

### 3. 修复CORS配置
```typescript
ALLOWED_ORIGINS: process.env.NODE_ENV === 'production'
  ? (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
  : ['http://localhost:3000'],
```

### 4. 更新Docker和部署配置
- 统一端口映射为3000
- 修复Nginx上游配置
- 更新环境变量设置

### 5. 添加环境变量支持
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.com
```

## 紧急修复优先级

1. **高优先级**: 修复API客户端端口配置问题
2. **高优先级**: 统一Docker容器端口映射
3. **中优先级**: 修复CORS和安全配置
4. **中优先级**: 更新Nginx反向代理配置
5. **低优先级**: 添加更详细的错误日志

## 测试验证步骤

1. 本地测试：确保所有API请求正常
2. Docker测试：验证容器内网络连接
3. 部署测试：验证生产环境API调用
4. 浏览器测试：检查控制台错误和网络请求
5. 端到端测试：验证完整用户流程

## 预期结果

修复后，应用应该能够：
1. 在本地和生产环境中正常调用API
2. 消除"网络错误"提示
3. 正确处理认证和会话
4. 提供稳定的用户体验