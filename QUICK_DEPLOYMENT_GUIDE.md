# 智慧库存系统 - 快速部署指南

## 🚀 快速开始

### 1. 获取代码

```bash
# 克隆仓库（使用HTTPS方式，无需SSH密钥）
git clone https://github.com/GetVDS/Smart-Warehouse.git

# 进入项目目录
cd Smart-Warehouse

# 切换到最新版本
git checkout main
```

### 2. 环境配置

```bash
# 复制环境变量模板
cp .env.template .env.production

# 编辑配置文件
nano .env.production
```

**必须修改的关键配置**:
```bash
# 安全配置（请修改为强密码）
JWT_SECRET="your-super-secure-jwt-secret-key-32-chars"
NEXTAUTH_SECRET="your-super-secure-nextauth-secret-key-32-chars"

# 域名配置
NEXTAUTH_URL="https://your-domain.com"
ALLOWED_ORIGINS="https://your-domain.com"
NEXT_PUBLIC_API_URL="https://your-domain.com"
```

### 3. 数据库初始化

```bash
# 运行数据库初始化脚本
chmod +x scripts/init-database.sh
./scripts/init-database.sh full
```

### 4. 应用部署

```bash
# 运行优化部署脚本
chmod +x scripts/deploy-optimized.sh
./scripts/deploy-optimized.sh full
```

### 5. 验证部署

```bash
# 检查应用健康状态
curl -f http://localhost:3000/api/health

# 检查服务状态
docker compose -f docker-compose.unified.yml ps
```

---

## 🔧 手动部署步骤

如果自动脚本遇到问题，可以按以下步骤手动部署：

### 1. 构建和启动

```bash
# 构建镜像
docker compose -f docker-compose.unified.yml build

# 启动服务
docker compose -f docker-compose.unified.yml up -d

# 查看日志
docker compose -f docker-compose.unified.yml logs -f
```

### 2. 初始化管理员用户

```bash
# 进入容器
docker compose -f docker-compose.unified.yml exec app bash

# 手动初始化
node init-admin.js

# 退出容器
exit
```

### 3. 配置Nginx（如需要）

```bash
# 检查Nginx配置
docker compose -f docker-compose.unified.yml exec nginx nginx -t

# 重新加载配置
docker compose -f docker-compose.unified.yml exec nginx nginx -s reload
```

---

## 📊 监控和日志

### 查看应用状态

```bash
# 健康检查
curl http://localhost:3000/api/health | jq .

# 查看实时日志
docker compose -f docker-compose.unified.yml logs -f app

# 查看容器资源使用
docker stats
```

### 日志文件位置

```bash
# 应用日志
tail -f logs/app-$(date +%Y-%m-%d).log

# 错误日志
tail -f logs/errors/errors-$(date +%Y-%m-%d).json

# 性能指标
tail -f logs/metrics/metrics-$(date +%Y-%m-%d).json
```

---

## 🔄 常见操作

### 重启服务

```bash
# 重启所有服务
docker compose -f docker-compose.unified.yml restart

# 重启特定服务
docker compose -f docker-compose.unified.yml restart app
```

### 查看服务状态

```bash
# 查看所有服务状态
docker compose -f docker-compose.unified.yml ps

# 查看容器详细信息
docker compose -f docker-compose.unified.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
```

### 备份数据

```bash
# 创建备份
./scripts/deploy-optimized.sh backup

# 手动备份数据库
cp data/custom.db backups/manual_backup_$(date +%Y%m%d_%H%M%S).db
```

### 回滚部署

```bash
# 查看可用备份
ls -la backups/

# 回滚到指定备份
./scripts/rollback.sh backups/20251208_143022
```

---

## 🚨 故障排除

### 容器无法启动

```bash
# 检查端口占用
netstat -tuln | grep :3000

# 清理端口占用
sudo fuser -k 3000/tcp

# 重新构建
docker compose -f docker-compose.unified.yml up -d --build --force-recreate
```

### 数据库连接失败

```bash
# 检查数据库文件权限
ls -la data/custom.db

# 重新初始化数据库
docker compose -f docker-compose.unified.yml exec app npx prisma migrate deploy
docker compose -f docker-compose.unified.yml exec app node init-admin.js
```

### 网络访问问题

```bash
# 检查防火墙状态
sudo ufw status

# 开放必要端口
sudo ufw allow 3000
sudo ufw allow 80
sudo ufw allow 443

# 检查Nginx配置
docker compose -f docker-compose.unified.yml exec nginx nginx -t
```

---

## 📱️ 联系信息

### 技术支持

- **管理员账号**: 79122706664
- **管理员密码**: PRAISEJEANS.888
- **应用端口**: 3000
- **健康检查**: `/api/health`

### 日志位置

- **应用日志**: `logs/app-YYYY-MM-DD.log`
- **错误日志**: `logs/errors/errors-YYYY-MM-DD.json`
- **性能指标**: `logs/metrics/metrics-YYYY-MM-DD.json`
- **部署日志**: `backups/deployment-report-YYYYMMDD_HHMMSS.txt`

### 配置文件

- **环境变量**: `.env.production`
- **Docker配置**: `docker-compose.unified.yml`
- **Nginx配置**: `nginx.conf`

---

## 🎯️ 生产环境检查清单

### 部署前

- [ ] 服务器规格满足要求
- [ ] Docker和Docker Compose已安装
- [ ] 防火墙规则已配置
- [ ] SSL证书已获取
- [ ] 域名DNS已解析
- [ ] 环境变量已正确配置

### 部署后

- [ ] 所有容器运行正常
- [ ] 健康检查通过
- [ ] API端点响应正常
- [ ] 前端页面加载正常
- [ ] 数据库连接正常
- [ ] 监控系统运行正常
- [ ] 日志记录正常

---

## 📚 相关文档

- [完整审计报告](./COMPREHENSIVE_AUDIT_AND_FIX_REPORT.md)
- [详细部署手册](./DEPLOYMENT_PLAYBOOK.md)
- [API响应格式说明](./src/lib/api-response.ts)
- [监控系统说明](./src/lib/monitoring-system.ts)

---

**快速部署命令总结**:
```bash
# 1. 克隆代码
git clone https://github.com/GetVDS/Smart-Warehouse.git && cd Smart-Warehouse

# 2. 配置环境
cp .env.template .env.production && nano .env.production

# 3. 初始化数据库
chmod +x scripts/init-database.sh && ./scripts/init-database.sh full

# 4. 部署应用
chmod +x scripts/deploy-optimized.sh && ./scripts/deploy-optimized.sh full

# 5. 验证部署
curl -f http://localhost:3000/api/health
```

**注意**: 请确保在生产环境中修改所有默认密码和安全配置！