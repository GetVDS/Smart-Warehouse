# 智慧库存系统 - 部署指南

## 项目概述

智慧库存系统是一个基于 Next.js 15 的现代化库存管理解决方案，具有以下特点：

- 🚀 Next.js 15 + TypeScript + Tailwind CSS
- 📦 Prisma ORM + SQLite 数据库
- 🐳 Docker 容器化部署
- 🔐 JWT 身份验证和安全防护
- 📊 实时库存监控和统计
- 🔄 自动备份和恢复功能

## 环境要求

### 服务器要求
- Ubuntu 20.04+ 或 CentOS 8+
- 最小 2GB RAM，推荐 4GB+
- 最小 20GB 存储空间
- Docker 20.10+ 和 Docker Compose 2.0+

### 域名和SSL
- 已注册的域名
- SSL 证书（支持自动申请）

## 快速部署

### 1. 克隆项目

```bash
git clone git@github.com:GetVDS/Warehouse-Creativity.git
cd Warehouse-Creativity
```

### 2. 配置域名

编辑 `deploy.sh` 文件，修改以下变量：

```bash
DOMAIN="your-domain.com"  # 替换为您的域名
EMAIL="admin@your-domain.com"  # 替换为您的邮箱
```

### 3. 执行部署

```bash
chmod +x deploy.sh
sudo ./deploy.sh
```

## 详细部署步骤

### 第一步：系统准备

1. **更新系统包**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **安装 Docker**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker $USER
   ```

3. **安装 Docker Compose**
   ```bash
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

### 第二步：项目配置

1. **环境变量配置**
   - 生产环境变量会自动生成
   - JWT 密钥和数据库密码会自动创建

2. **SSL 证书**
   - 自动申请 Let's Encrypt 证书
   - 自动配置续期任务

### 第三步：服务启动

1. **构建和启动容器**
   ```bash
   docker-compose up -d
   ```

2. **数据库初始化**
   ```bash
   npm run db:init
   ```

3. **创建管理员账户**
   ```bash
   npm run admin:init
   ```

## 验证部署

### 检查服务状态

```bash
# 检查容器状态
docker-compose ps

# 检查服务健康状态
curl https://your-domain.com/api/health

# 检查前端访问
curl -I https://your-domain.com
```

### 功能测试

1. **访问系统**
   - 前端：https://your-domain.com
   - 登录：使用创建的管理员账户

2. **测试功能**
   - 产品管理
   - 库存操作
   - 订单处理
   - 数据统计

## 故障排除

### 常见问题

1. **502 Bad Gateway**
   ```bash
   # 检查容器状态
   docker-compose logs app
   
   # 检查端口占用
   sudo netstat -tlnp | grep :80
   ```

2. **数据库连接失败**
   ```bash
   # 检查数据库权限
   ls -la db/
   
   # 重新初始化数据库
   npm run db:reset
   ```

3. **SSL 证书问题**
   ```bash
   # 检查证书状态
   sudo certbot certificates
   
   # 手动续期
   sudo certbot renew
   ```

### 日志查看

```bash
# 应用日志
docker-compose logs -f app

# Nginx 日志
docker-compose logs -f nginx

# 数据库日志
docker-compose logs -f db
```

## 维护和更新

### 备份数据

```bash
# 自动备份（每日）
./backup.sh

# 手动备份
./backup.sh manual
```

### 更新系统

```bash
# 拉取最新代码
git pull origin main

# 重新构建和部署
docker-compose down
docker-compose up -d --build
```

### 监控和维护

1. **系统监控**
   - 磁盘空间使用
   - 内存使用情况
   - 服务运行状态

2. **日志管理**
   - 定期清理旧日志
   - 监控错误日志

## 安全配置

### 防火墙设置

```bash
# 开放必要端口
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 22
sudo ufw enable
```

### 安全加固

1. **定期更新**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **监控异常访问**
   - 检查访问日志
   - 设置告警机制

## 性能优化

### 数据库优化

1. **定期清理**
   ```bash
   # 清理旧数据
   npm run db:cleanup
   ```

2. **索引优化**
   - 自动优化查询性能
   - 定期分析慢查询

### 缓存配置

- Redis 缓存（可选）
- 静态资源缓存
- API 响应缓存

## 联系支持

如果遇到部署问题，请：

1. 查看日志文件
2. 检查配置文件
3. 提交 Issue 到 GitHub 仓库

## 版本信息

- 当前版本：v2.0.0
- 更新日期：2025-12-07
- 兼容性：Next.js 15, Node.js 18+

---

**注意**：在生产环境中部署前，请确保：
1. 域名已正确解析到服务器
2. 防火墙配置正确
3. 备份策略已制定
4. 监控系统已配置