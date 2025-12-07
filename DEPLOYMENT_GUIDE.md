# 智慧库存系统 - 完整部署与运行指南

## 项目概述

智慧库存系统是一个基于 Next.js 15 的现代化库存管理系统，具有以下特点：
- 完整的库存管理功能
- 客户管理和订单跟踪
- 实时数据统计和分析
- 响应式设计，支持多设备访问
- 高性能架构，优化的数据库查询
- 完善的安全机制和错误处理

## 环境要求

### 开发环境
- Node.js 18.17 或更高版本
- npm 或 yarn 包管理器
- Git

### 生产环境
- Ubuntu 20.04 或更高版本
- Docker 和 Docker Compose
- Nginx (反向代理)
- SSL 证书 (推荐使用 Let's Encrypt)
- 至少 2GB RAM 和 10GB 存储空间

## 快速开始

### 1. 克隆仓库

```bash
# 克隆项目
git clone git@github.com:GetVDS/Warehouse-Creativity.git
cd Warehouse-Creativity

# 或者使用 HTTPS
git clone https://github.com/GetVDS/Warehouse-Creativity.git
cd Warehouse-Creativity
```

### 2. 本地开发运行

```bash
# 安装依赖
npm install

# 初始化数据库
npm run db:init

# 启动开发服务器
npm run dev
```

访问 http://localhost:3000 查看应用。

默认管理员账户：
- 用户名: admin
- 密码: admin123

### 3. 生产环境部署

#### 方法一：使用自动部署脚本 (推荐)

```bash
# 设置域名 (替换为您的实际域名)
export DOMAIN=your-domain.com

# 设置 JWT 密钥
export JWT_SECRET=$(openssl rand -hex 32)

# 运行部署脚本
chmod +x deploy.sh
sudo ./deploy.sh
```

#### 方法二：手动部署

1. **安装 Docker 和 Docker Compose**
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install docker.io docker-compose -y
   sudo systemctl enable docker
   sudo usermod -aG docker $USER
   ```

2. **配置环境变量**
   ```bash
   # 创建 .env.production 文件
   cat > .env.production << EOF
   # Database configuration
   DATABASE_URL="file:./db/custom.db"
   
   # JWT key
   JWT_SECRET="your-jwt-secret-here"
   
   # Application configuration
   NODE_ENV="production"
   NEXTAUTH_URL="https://your-domain.com"
   NEXTAUTH_SECRET="your-nextauth-secret-here"
   NEXT_PUBLIC_API_URL="https://your-domain.com"
   
   # Security configuration
   SECURE_COOKIES="true"
   ALLOWED_ORIGINS="https://your-domain.com"
   
   # Log level
   LOG_LEVEL="error"
   EOF
   ```

3. **构建和启动服务**
   ```bash
   # 构建镜像
   docker-compose -f docker-compose.prod.yml build
   
   # 启动服务
   docker-compose -f docker-compose.prod.yml up -d
   ```

4. **配置 Nginx 反向代理**
   ```bash
   # 复制 Nginx 配置文件
   sudo cp nginx.conf /etc/nginx/sites-available/warehouse
   sudo ln -s /etc/nginx/sites-available/warehouse /etc/nginx/sites-enabled/
   
   # 替换域名
   sudo sed -i 's/your-domain.com/your-actual-domain.com/g' /etc/nginx/sites-available/warehouse
   
   # 测试配置
   sudo nginx -t
   
   # 重启 Nginx
   sudo systemctl restart nginx
   ```

5. **配置 SSL 证书 (Let's Encrypt)**
   ```bash
   # 安装 Certbot
   sudo apt install certbot python3-certbot-nginx -y
   
   # 获取证书
   sudo certbot --nginx -d your-domain.com
   
   # 设置自动续期
   sudo crontab -e
   # 添加以下行
   0 12 * * * /usr/bin/certbot renew --quiet
   ```

## 系统架构

### 前端技术栈
- **Next.js 15**: React 框架，支持 SSR 和 API 路由
- **TypeScript**: 类型安全的 JavaScript
- **Tailwind CSS**: 实用优先的 CSS 框架
- **React Query**: 数据获取和缓存
- **Prisma**: 数据库 ORM

### 后端技术栈
- **Node.js**: JavaScript 运行时
- **SQLite**: 轻量级数据库
- **Prisma**: 数据库 ORM
- **JWT**: 身份验证
- **Docker**: 容器化部署

### 部署架构
- **Nginx**: 反向代理和静态文件服务
- **Docker Compose**: 多容器编排
- **Let's Encrypt**: SSL 证书
- **Systemd**: 服务管理

## 主要功能

### 1. 库存管理
- 产品添加、编辑和删除
- 库存数量跟踪
- 库存预警和统计
- 出入库记录

### 2. 客户管理
- 客户信息管理
- 购买历史记录
- 客户统计分析

### 3. 订单管理
- 订单创建和跟踪
- 订单状态管理
- 订单统计分析

### 4. 数据统计
- 实时库存统计
- 销售数据分析
- 客户购买行为分析

## 故障排除

### 常见问题

1. **网络错误 (502 Bad Gateway)**
   - 检查 Docker 容器状态: `docker ps`
   - 查看容器日志: `docker logs container-name`
   - 检查 Nginx 配置: `sudo nginx -t`

2. **数据库连接错误**
   - 检查数据库文件权限: `ls -la db/`
   - 重新初始化数据库: `npm run db:init`

3. **SSL 证书问题**
   - 检查证书状态: `sudo certbot certificates`
   - 手动续期: `sudo certbot renew`

4. **性能问题**
   - 检查系统资源: `htop`, `df -h`
   - 优化数据库: `npm run db:optimize`

### 日志位置

- **应用日志**: `docker logs warehouse-app`
- **Nginx 日志**: `/var/log/nginx/`
- **系统日志**: `journalctl -u nginx`

## 维护和更新

### 定期维护任务

1. **数据库备份**
   ```bash
   # 创建备份脚本
   cat > backup.sh << 'EOF'
   #!/bin/bash
   DATE=$(date +%Y%m%d_%H%M%S)
   docker exec warehouse-app npm run db:backup
   EOF
   
   chmod +x backup.sh
   ./backup.sh
   ```

2. **系统更新**
   ```bash
   # 更新系统包
   sudo apt update && sudo apt upgrade -y
   
   # 更新 Docker 镜像
   docker-compose -f docker-compose.prod.yml pull
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **日志清理**
   ```bash
   # 清理 Docker 日志
   docker system prune -f
   
   # 清理 Nginx 日志
   sudo logrotate -f /etc/logrotate.d/nginx
   ```

### 版本更新

```bash
# 拉取最新代码
git pull origin main

# 重新构建和部署
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

## 安全建议

1. **定期更新依赖**
   ```bash
   npm audit
   npm audit fix
   ```

2. **强密码策略**
   - 使用强密码
   - 定期更换密码
   - 启用双因素认证 (如果支持)

3. **防火墙配置**
   ```bash
   # 启用 UFW
   sudo ufw enable
   
   # 允许必要端口
   sudo ufw allow ssh
   sudo ufw allow 80
   sudo ufw allow 443
   ```

4. **监控和告警**
   - 设置系统监控
   - 配置日志告警
   - 定期安全扫描

## 性能优化

### 1. 数据库优化
- 定期清理旧数据
- 优化查询索引
- 使用连接池

### 2. 缓存策略
- 启用浏览器缓存
- 使用 CDN 加速静态资源
- 实现 API 响应缓存

### 3. 服务器优化
- 调整 Nginx 工作进程数
- 优化 PHP-FPM 设置
- 启用 Gzip 压缩

## 支持和联系

如果您在使用过程中遇到问题，请：

1. 查看本文档的故障排除部分
2. 检查项目的 GitHub Issues
3. 提交新的 Issue 并提供详细信息

## 许可证

本项目采用 MIT 许可证。详情请查看 LICENSE 文件。

---

**注意**: 在生产环境中部署前，请确保：
1. 更改所有默认密码
2. 配置适当的防火墙规则
3. 设置定期备份
4. 监控系统性能和安全