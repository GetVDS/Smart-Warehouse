# 智慧库存系统 - 部署操作手册

## 📋 目录

1. [环境准备](#环境准备)
2. [代码获取](#代码获取)
3. [环境配置](#环境配置)
4. [数据库初始化](#数据库初始化)
5. [应用部署](#应用部署)
6. [部署验证](#部署验证)
7. [监控配置](#监控配置)
8. [故障排除](#故障排除)
9. [维护操作](#维护操作)

---

## 🚀 环境准备

### 系统要求

#### 最低配置
- **操作系统**: Ubuntu 20.04+ / CentOS 8+ / RHEL 8+
- **CPU**: 2核心
- **内存**: 4GB RAM
- **存储**: 20GB 可用空间
- **网络**: 稳定的互联网连接

#### 推荐配置
- **操作系统**: Ubuntu 22.04 LTS
- **CPU**: 4核心
- **内存**: 8GB RAM
- **存储**: 50GB SSD
- **网络**: 1Gbps带宽

#### 必需软件
```bash
# 更新系统包
sudo apt update && sudo apt upgrade -y

# 安装基础工具
sudo apt install -y curl wget git unzip

# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker compose version
```

---

## 📥 代码获取

### 从Git仓库获取

```bash
# 克隆仓库
git clone https://github.com/GetVDS/Smart-Warehouse.git

# 进入项目目录
cd Smart-Warehouse

# 切换到最新标签（推荐）
git checkout $(git describe --tags `git rev-list --tags --max-count=1`)

# 或者切换到main分支
git checkout main
```

### 验证代码完整性

```bash
# 检查Git状态
git status

# 验证文件完整性
ls -la scripts/
ls -la src/lib/
```

---

## ⚙️ 环境配置

### 1. 复制环境变量模板

```bash
# 复制模板文件
cp .env.template .env.production

# 编辑生产环境配置
nano .env.production
```

### 2. 配置必要的环境变量

```bash
# .env.production 关键配置示例

# 数据库配置
DATABASE_URL="file:/app/data/custom.db"
DB_PATH="/app/data"
DB_BACKUP_PATH="/app/data/backups"

# 应用配置
NODE_ENV="production"
PORT="3000"
HOSTNAME="0.0.0.0"

# 安全配置（必须修改！）
JWT_SECRET="your-super-secure-jwt-secret-key-min-32-chars"
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="your-super-secure-nextauth-secret-key-min-32-chars"
ALLOWED_ORIGINS="https://your-domain.com"

# 性能配置
NODE_OPTIONS="--max-old-space-size=2048"
NEXT_TELEMETRY_DISABLED="1"

# 监控配置
ENABLE_MONITORING="true"
LOG_LEVEL="info"
ENABLE_SECURITY_LOGGING="true"
ENABLE_QUERY_MONITORING="true"
SLOW_QUERY_THRESHOLD="1000"
MAX_CONNECTIONS="10"

# API配置
NEXT_PUBLIC_API_URL="https://your-domain.com"

# Docker资源限制
APP_MEMORY_LIMIT="1G"
APP_CPU_LIMIT="0.5"
NGINX_MEMORY_LIMIT="512M"
NGINX_CPU_LIMIT="0.25"
```

### 3. SSL证书配置（生产环境）

```bash
# 使用Let's Encrypt获取免费SSL证书
sudo apt install -y certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 证书路径配置
# /etc/letsencrypt/live/your-domain.com/fullchain.pem
# /etc/letsencrypt/live/your-domain.com/privkey.pem
```

---

## 🗄️ 数据库初始化

### 自动初始化（推荐）

```bash
# 使用优化后的初始化脚本
./scripts/init-database.sh full

# 或者分步执行
./scripts/init-database.sh migrate
./scripts/init-database.sh admin
./scripts/init-database.sh verify
```

### 手动初始化（备选）

```bash
# 生成Prisma客户端
npx prisma generate

# 运行迁移
npx prisma migrate deploy

# 初始化管理员用户
node init-admin.js
```

### 验证数据库初始化

```bash
# 检查数据库文件
ls -la data/

# 验证表结构
npx prisma db pull --force

# 检查管理员用户
npx prisma db execute "SELECT COUNT(*) FROM User WHERE phone = '79122706664';"
```

---

## 🚀 应用部署

### 1. 使用优化部署脚本（推荐）

```bash
# 完整部署
./scripts/deploy-optimized.sh full

# 仅验证部署
./scripts/deploy-optimized.sh verify

# 仅备份当前版本
./scripts/deploy-optimized.sh backup
```

### 2. 手动部署步骤

```bash
# 1. 构建Docker镜像
docker compose -f docker-compose.unified.yml build --no-cache

# 2. 启动服务
docker compose -f docker-compose.unified.yml up -d

# 3. 等待服务启动
sleep 30

# 4. 检查服务状态
docker compose -f docker-compose.unified.yml ps
```

### 3. 验证服务启动

```bash
# 检查容器状态
docker compose -f docker-compose.unified.yml ps

# 查看应用日志
docker compose -f docker-compose.unified.yml logs app

# 查看Nginx日志
docker compose -f docker-compose.unified.yml logs nginx
```

---

## ✅ 部署验证

### 1. 健康检查

```bash
# 应用健康检查
curl -f http://localhost:3000/api/health

# 通过Nginx检查
curl -f https://your-domain.com/api/health

# 检查响应内容
curl https://your-domain.com/api/health | jq .
```

### 2. 功能测试

```bash
# 测试登录
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"79122706664","password":"PRAISEJEANS.888"}'

# 测试API访问
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-domain.com/api/products

# 测试静态资源
curl -I https://your-domain.com/_next/static/css/app.css
```

### 3. 性能测试

```bash
# 响应时间测试
curl -o /dev/null -s -w "%{time_total}" \
  https://your-domain.com/api/health

# 并发测试
ab -n 100 -c 10 https://your-domain.com/api/health
```

---

## 📊 监控配置

### 1. 应用监控

```bash
# 查看实时日志
docker compose -f docker-compose.unified.yml logs -f app

# 查看监控指标
curl http://localhost:3000/api/health | jq '.metrics'

# 查看错误统计
curl http://localhost:3000/api/health | jq '.errors'
```

### 2. 系统监控

```bash
# 检查系统资源
docker stats

# 检查磁盘使用
df -h

# 检查内存使用
free -h

# 检查系统负载
uptime
```

### 3. 日志管理

```bash
# 查看应用日志
tail -f logs/app-$(date +%Y-%m-%d).log

# 查看错误日志
tail -f logs/errors/errors-$(date +%Y-%m-%d).log

# 查看性能指标
tail -f logs/metrics/metrics-$(date +%Y-%m-%d).json
```

---

## 🔧 故障排除

### 常见问题及解决方案

#### 1. 容器启动失败

```bash
# 检查容器状态
docker compose -f docker-compose.unified.yml ps

# 查看容器日志
docker compose -f docker-compose.unified.yml logs app

# 重新构建容器
docker compose -f docker-compose.unified.yml up -d --build --force-recreate

# 检查资源使用
docker system df
```

#### 2. 数据库连接问题

```bash
# 检查数据库文件权限
ls -la data/custom.db

# 重新初始化数据库
./scripts/init-database.sh full

# 检查Prisma配置
npx prisma validate
```

#### 3. 网络访问问题

```bash
# 检查端口占用
netstat -tuln | grep :3000
netstat -tuln | grep :80
netstat -tuln | grep :443

# 检查防火墙
sudo ufw status

# 检查Nginx配置
docker compose -f docker-compose.unified.yml exec nginx nginx -t

# 重新加载Nginx配置
docker compose -f docker-compose.unified.yml exec nginx nginx -s reload
```

#### 4. 性能问题

```bash
# 检查系统资源
docker stats --no-stream

# 检查慢查询
grep "slow query" logs/app-*.log

# 重启服务
docker compose -f docker-compose.unified.yml restart
```

### 回滚操作

```bash
# 查看可用备份
ls -la backups/

# 回滚到指定备份
./scripts/rollback.sh backups/20251208_143022

# 验证回滚结果
curl -f https://your-domain.com/api/health
```

---

## 🔄 维护操作

### 1. 备份操作

```bash
# 手动备份
./scripts/deploy-optimized.sh backup

# 备份数据库
cp data/custom.db backups/custom_$(date +%Y%m%d_%H%M%S).db

# 备份配置文件
tar -czf backups/config_$(date +%Y%m%d_%H%M%S).tar.gz \
  .env.production docker-compose.unified.yml nginx/
```

### 2. 更新操作

```bash
# 拉取最新代码
git pull origin main

# 重新部署
./scripts/deploy-optimized.sh full

# 验证更新
curl -f https://your-domain.com/api/health
```

### 3. 日志清理

```bash
# 清理旧日志（保留30天）
find logs/ -name "*.log" -mtime +30 -delete
find logs/ -name "*.json" -mtime +30 -delete

# 清理Docker镜像
docker system prune -f

# 清理旧备份
find backups/ -name "*" -mtime +7 -delete
```

### 4. 安全维护

```bash
# 更新SSL证书
sudo certbot renew

# 检查安全配置
curl -I https://your-domain.com

# 扫描安全漏洞
docker scan your-domain.com

# 更新系统包
sudo apt update && sudo apt upgrade -y
```

---

## 📞 监控仪表板

### 访问监控端点

```bash
# 系统健康状态
curl https://your-domain.com/api/health

# 应用指标
curl https://your-domain.com/api/health | jq '.metrics'

# 错误统计
curl https://your-domain.com/api/health | jq '.errors'

# 性能统计
curl https://your-domain.com/api/health | jq '.performance'
```

### 设置监控告警

```bash
# 创建监控脚本
cat > monitor.sh << 'EOF'
#!/bin/bash
HEALTH_URL="https://your-domain.com/api/health"
ALERT_EMAIL="admin@your-domain.com"

while true; do
    if ! curl -f \$HEALTH_URL > /dev/null 2>&1; then
        echo "健康检查失败，发送告警邮件"
        echo "系统健康检查失败" | mail -s "智慧库存系统告警" \$ALERT_EMAIL
    fi
    sleep 60
done
EOF

chmod +x monitor.sh
nohup ./monitor.sh &
```

---

## 📋 部署检查清单

### 部署前检查

- [ ] 系统要求满足
- [ ] Docker和Docker Compose已安装
- [ ] 环境变量已配置
- [ ] SSL证书已获取
- [ ] 防火墙规则已配置
- [ ] 代码已获取到最新版本

### 部署过程检查

- [ ] 数据库初始化成功
- [ ] Docker镜像构建成功
- [ ] 容器启动正常
- [ ] 健康检查通过
- [ ] 网络访问正常
- [ ] SSL证书有效

### 部署后验证

- [ ] 所有API端点响应正常
- [ ] 前端页面加载正常
- [ ] 数据库连接正常
- [ ] 监控系统运行正常
- [ ] 性能指标在预期范围
- [ ] 错误日志无异常

---

## 🆘 紧急联系信息

### 技术支持
- **主要联系人**: 系统管理员
- **邮箱**: admin@your-domain.com
- **电话**: +86-xxx-xxxx-xxxx

### 服务商联系
- **域名服务商**: 域名注册商
- **服务器提供商**: 云服务提供商
- **CDN提供商**: 内容分发网络服务商

---

## 📚 相关文档

- [综合审计报告](./COMPREHENSIVE_AUDIT_AND_FIX_REPORT.md)
- [API文档](./docs/api-documentation.md)
- [架构设计](./docs/architecture.md)
- [安全指南](./docs/security-guide.md)

---

**最后更新**: 2025-12-08  
**版本**: v2.0  
**维护者**: 资深全栈与DevOps工程师