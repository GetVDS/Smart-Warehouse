# 智慧库存管理系统 - 手动部署指南

本指南提供详细的手动部署步骤，适用于希望完全控制部署过程的用户。

## 📋 部署前准备

### 服务器要求
- **操作系统**: Ubuntu 20.04+ 或 CentOS 8+
- **内存**: 最低2GB，推荐4GB+
- **存储**: 最低20GB，推荐50GB+
- **网络**: 稳定的互联网连接
- **权限**: sudo权限或root访问

### 必要软件
- Git
- Docker
- Docker Compose
- Nginx（可选，用于反向代理）

---

## 🚀 手动部署步骤

### 第1步：服务器准备

#### 1.1 更新系统
```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y

# CentOS/RHEL
sudo yum update -y
```

#### 1.2 安装必要工具
```bash
# Ubuntu/Debian
sudo apt install -y git curl wget unzip htop

# CentOS/RHEL
sudo yum install -y git curl wget unzip htop
```

#### 1.3 创建部署目录
```bash
sudo mkdir -p /opt/apps
sudo chown $USER:$USER /opt/apps
cd /opt/apps
```

### 第2步：获取项目代码

#### 2.1 克隆项目
```bash
git clone git@github.com:GetVDS/Future-Warehouse.git
cd Future-Warehouse
```

#### 2.2 验证文件完整性
```bash
# 检查关键文件是否存在
ls -la deploy.sh backup.sh restore.sh
ls -la production-docker-compose.yml
ls -la UBUNTU_DEPLOYMENT_GUIDE.md
```

### 第3步：安装Docker环境

#### 3.1 安装Docker
```bash
# 下载Docker安装脚本
curl -fsSL https://get.docker.com -o get-docker.sh

# 运行安装脚本
sudo sh get-docker.sh

# 启动Docker服务
sudo systemctl start docker
sudo systemctl enable docker

# 将当前用户添加到docker组
sudo usermod -aG docker $USER
```

#### 3.2 安装Docker Compose
```bash
# 下载Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# 添加执行权限
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker-compose --version
```

#### 3.3 验证Docker安装
```bash
# 重新登录以使用户组更改生效
# 或者运行以下命令
newgrp docker

# 测试Docker
docker run hello-world
```

### 第4步：配置环境变量

#### 4.1 创建环境变量文件
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
nano .env
```

#### 4.2 设置关键环境变量
```bash
# 数据库配置
DATABASE_URL="file:./dev.db"

# 应用配置
NODE_ENV="production"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-super-secret-key-here"

# 管理员账户
ADMIN_PHONE="13800138000"
ADMIN_PASSWORD="admin123"

# 其他配置
PORT=3000
```

#### 4.3 生成安全密钥
```bash
# 生成NextAuth密钥
openssl rand -base64 32

# 使用生成的密钥更新NEXTAUTH_SECRET
```

### 第5步：构建和启动应用

#### 5.1 构建Docker镜像
```bash
# 使用生产配置构建
docker-compose -f production-docker-compose.yml build
```

#### 5.2 启动应用
```bash
# 启动所有服务
docker-compose -f production-docker-compose.yml up -d

# 查看服务状态
docker-compose -f production-docker-compose.yml ps
```

#### 5.3 初始化数据库
```bash
# 运行数据库迁移
docker-compose -f production-docker-compose.yml exec app npm run db:migrate

# 创建管理员用户
docker-compose -f production-docker-compose.yml exec app npm run db:seed
```

#### 5.4 验证应用运行
```bash
# 检查应用日志
docker-compose -f production-docker-compose.yml logs -f app

# 测试应用健康状态
curl http://localhost:3000/api/health
```

### 第6步：配置Nginx反向代理（可选）

#### 6.1 安装Nginx
```bash
# Ubuntu/Debian
sudo apt install -y nginx

# CentOS/RHEL
sudo yum install -y nginx
```

#### 6.2 创建Nginx配置
```bash
# 创建配置文件
sudo nano /etc/nginx/sites-available/inventory-system
```

#### 6.3 Nginx配置内容
```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为您的域名

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 6.4 启用Nginx配置
```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/inventory-system /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 第7步：配置SSL证书（可选）

#### 7.1 安装Certbot
```bash
# Ubuntu/Debian
sudo apt install -y certbot python3-certbot-nginx

# CentOS/RHEL
sudo yum install -y certbot python3-certbot-nginx
```

#### 7.2 获取SSL证书
```bash
# 替换your-domain.com为您的域名
sudo certbot --nginx -d your-domain.com
```

#### 7.3 设置自动续期
```bash
# 添加定时任务
sudo crontab -e

# 添加以下行（每天凌晨2点检查续期）
0 2 * * * /usr/bin/certbot renew --quiet
```

### 第8步：配置防火墙

#### 8.1 配置UFW（Ubuntu）
```bash
# 启用防火墙
sudo ufw enable

# 允许SSH
sudo ufw allow ssh

# 允许HTTP和HTTPS
sudo ufw allow 80
sudo ufw allow 443

# 查看状态
sudo ufw status
```

#### 8.2 配置firewalld（CentOS）
```bash
# 启用防火墙
sudo systemctl enable firewalld
sudo systemctl start firewalld

# 允许服务
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https

# 重载配置
sudo firewall-cmd --reload
```

---

## 🔧 应用管理

### 查看应用状态
```bash
# 查看所有服务状态
docker-compose -f production-docker-compose.yml ps

# 查看资源使用情况
docker stats
```

### 查看日志
```bash
# 查看应用日志
docker-compose -f production-docker-compose.yml logs -f app

# 查看数据库日志
docker-compose -f production-docker-compose.yml logs -f db
```

### 重启应用
```bash
# 重启所有服务
docker-compose -f production-docker-compose.yml restart

# 重启特定服务
docker-compose -f production-docker-compose.yml restart app
```

### 更新应用
```bash
# 拉取最新代码
git pull origin main

# 重新构建镜像
docker-compose -f production-docker-compose.yml build

# 重启服务
docker-compose -f production-docker-compose.yml up -d
```

---

## 📊 监控和维护

### 设置监控脚本
```bash
# 创建监控脚本
nano /opt/apps/monitor.sh
```

```bash
#!/bin/bash
# 监控脚本内容

# 检查应用健康状态
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)

if [ $HEALTH_CHECK -ne 200 ]; then
    echo "应用健康检查失败，HTTP状态码: $HEALTH_CHECK"
    # 发送告警邮件或通知
fi

# 检查磁盘空间
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "磁盘空间不足，当前使用率: $DISK_USAGE%"
    # 发送告警邮件或通知
fi
```

```bash
# 添加执行权限
chmod +x /opt/apps/monitor.sh

# 添加到定时任务
crontab -e

# 每5分钟检查一次
*/5 * * * * /opt/apps/monitor.sh
```

### 数据备份
```bash
# 运行备份脚本
./backup.sh

# 查看备份文件
ls -la backups/
```

### 日志轮转
```bash
# 创建logrotate配置
sudo nano /etc/logrotate.d/inventory-system
```

```
/opt/apps/Future-Warehouse/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        docker-compose -f /opt/apps/Future-Warehouse/production-docker-compose.yml restart app
    endscript
}
```

---

## 🚨 故障排查

### 常见问题及解决方案

#### 1. 应用无法启动
```bash
# 查看详细日志
docker-compose -f production-docker-compose.yml logs app

# 检查端口占用
sudo netstat -tlnp | grep :3000

# 检查环境变量
docker-compose -f production-docker-compose.yml exec app env
```

#### 2. 数据库连接失败
```bash
# 检查数据库状态
docker-compose -f production-docker-compose.yml ps db

# 查看数据库日志
docker-compose -f production-docker-compose.yml logs db

# 手动连接数据库
docker-compose -f production-docker-compose.yml exec db sqlite3 data/dev.db
```

#### 3. Nginx配置错误
```bash
# 测试Nginx配置
sudo nginx -t

# 查看Nginx日志
sudo tail -f /var/log/nginx/error.log

# 重启Nginx
sudo systemctl restart nginx
```

#### 4. SSL证书问题
```bash
# 检查证书状态
sudo certbot certificates

# 手动续期
sudo certbot renew --dry-run

# 查看证书日志
sudo journalctl -u certbot
```

---

## 📞 技术支持

如果在部署过程中遇到问题，可以：

1. 查看 [UBUNTU_DEPLOYMENT_GUIDE.md](UBUNTU_DEPLOYMENT_GUIDE.md) 获取更详细的说明
2. 检查项目的 [Issues](https://github.com/GetVDS/Future-Warehouse/issues) 页面
3. 运行 `./deploy.sh` 脚本进行自动化部署
4. 联系技术支持团队

---

## 🎯 部署验证

部署完成后，请验证以下功能：

1. **应用访问**: 在浏览器中打开应用地址
2. **用户登录**: 使用管理员账户登录系统
3. **基本功能**: 测试产品、客户、订单管理功能
4. **API接口**: 访问 `/api/health` 检查接口状态
5. **数据持久化**: 重启应用后确认数据保存正常

恭喜！您已成功手动部署智慧库存管理系统！🎉