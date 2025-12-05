#!/bin/bash

# 智慧库存管理系统 - 快速部署脚本
# 适用于Ubuntu 20.04+系统

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否为root用户
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_error "请不要使用root用户运行此脚本"
        exit 1
    fi
}

# 检查系统版本
check_system() {
    log_info "检查系统版本..."
    if ! grep -q "Ubuntu" /etc/os-release; then
        log_error "此脚本仅支持Ubuntu系统"
        exit 1
    fi
    
    local version=$(lsb_release -rs)
    log_info "系统版本: $version"
}

# 更新系统
update_system() {
    log_info "更新系统软件包..."
    sudo apt update
    sudo apt upgrade -y
}

# 安装基础工具
install_basic_tools() {
    log_info "安装基础工具..."
    sudo apt install -y curl wget git vim htop unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
}

# 安装Docker
install_docker() {
    log_info "安装Docker..."
    
    # 检查Docker是否已安装
    if command -v docker &> /dev/null; then
        log_warn "Docker已安装，跳过安装步骤"
        return
    fi
    
    # 添加Docker官方GPG密钥
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # 添加Docker仓库
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # 更新包索引
    sudo apt update
    
    # 安装Docker Engine
    sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # 验证docker compose命令
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose插件安装失败"
        exit 1
    fi
    
    # 启动Docker服务
    sudo systemctl enable docker
    sudo systemctl start docker
    
    # 将当前用户添加到docker组
    sudo usermod -aG docker $USER
    
    log_info "Docker安装完成，请重新登录以使用户组更改生效"
}

# 安装Nginx
install_nginx() {
    log_info "安装Nginx..."
    
    # 检查Nginx是否已安装
    if command -v nginx &> /dev/null; then
        log_warn "Nginx已安装，跳过安装步骤"
        return
    fi
    
    sudo apt install -y nginx
    sudo systemctl enable nginx
    sudo systemctl start nginx
    
    log_info "Nginx安装完成"
}

# 配置防火墙
setup_firewall() {
    log_info "配置防火墙..."
    
    # 安装UFW
    sudo apt install -y ufw
    
    # 配置防火墙规则
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    sudo ufw allow ssh
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    
    # 启用防火墙
    echo "y" | sudo ufw enable
    
    log_info "防火墙配置完成"
}

# 创建应用目录
create_app_directories() {
    log_info "创建应用目录..."
    
    # 创建应用目录
    sudo mkdir -p /opt/apps/inventory-system
    sudo chown $USER:$USER /opt/apps/inventory-system
    
    # 创建必要的子目录
    mkdir -p /opt/apps/inventory-system/{db,logs,nginx/conf.d,nginx/ssl}
    
    log_info "应用目录创建完成"
}

# 获取环境变量
get_env_variables() {
    log_info "配置环境变量..."
    
    # 域名
    read -p "请输入您的域名 (例如: example.com): " DOMAIN
    if [[ -z "$DOMAIN" ]]; then
        log_error "域名不能为空"
        exit 1
    fi
    
    # 邮箱
    read -p "请输入您的邮箱 (用于SSL证书): " EMAIL
    if [[ -z "$EMAIL" ]]; then
        log_error "邮箱不能为空"
        exit 1
    fi
    
    # JWT密钥
    JWT_SECRET=$(openssl rand -hex 32)
    
    log_info "环境变量配置完成"
}

# 创建环境变量文件
create_env_file() {
    log_info "创建环境变量文件..."
    
    cat > /opt/apps/inventory-system/.env.production <<EOF
# 数据库配置
DATABASE_URL="file:./db/custom.db"

# JWT密钥
JWT_SECRET="$JWT_SECRET"

# 应用配置
NODE_ENV="production"
NEXTAUTH_URL="https://$DOMAIN"
NEXTAUTH_SECRET="$(openssl rand -hex 32)"

# 安全配置
SECURE_COOKIES="true"
ALLOWED_ORIGINS="https://$DOMAIN"

# 日志级别
LOG_LEVEL="error"
EOF

    log_info "环境变量文件创建完成"
}

# 创建生产环境Dockerfile
create_dockerfile() {
    log_info "创建生产环境Dockerfile..."
    
    cat > /opt/apps/inventory-system/Dockerfile <<'EOF'
# 多阶段构建 - 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app

# 复制package文件
COPY package*.json ./
COPY prisma ./prisma/

# 安装依赖
RUN npm ci --only=production && npm cache clean --force

# 生成Prisma客户端
RUN npx prisma generate

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 生产阶段
FROM node:18-alpine AS runner

WORKDIR /app

# 创建非root用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制构建产物
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

# 创建数据库目录
RUN mkdir -p db && chown -R nextjs:nodejs db

# 设置用户
USER nextjs

# 暴露端口
EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# 启动应用
CMD ["node", "server.js"]
EOF

    log_info "Dockerfile创建完成"
}

# 创建Docker Compose配置
create_docker_compose() {
    log_info "创建Docker Compose配置..."
    
    cat > /opt/apps/inventory-system/docker-compose.yml <<EOF
version: '3.8'

services:
  app:
    build: 
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=file:./db/custom.db
      - NODE_ENV=production
      - JWT_SECRET=$JWT_SECRET
      - NEXTAUTH_URL=https://$DOMAIN
      - NEXTAUTH_SECRET=\$(openssl rand -hex 32)
    volumes:
      - ./db:/app/db
      - ./logs:/app/logs
    restart: unless-stopped
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/conf.d:/etc/nginx/conf.d
      - ./nginx/ssl:/etc/nginx/ssl
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - app
    restart: unless-stopped
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
EOF

    log_info "Docker Compose配置创建完成"
}

# 创建Nginx配置
create_nginx_config() {
    log_info "创建Nginx配置..."
    
    # 创建主配置文件
    cat > /opt/apps/inventory-system/nginx/nginx.conf <<'EOF'
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # 日志格式
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    # 基本设置
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;

    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # 包含站点配置
    include /etc/nginx/conf.d/*.conf;
}
EOF

    # 创建站点配置
    cat > /opt/apps/inventory-system/nginx/conf.d/default.conf <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;
    
    # SSL配置
    ssl_certificate /etc/nginx/ssl/certificate.crt;
    ssl_certificate_key /etc/nginx/ssl/private.key;
    ssl_session_timeout 1d;
    ssl_session_cache shared:MozTLS:10m;
    ssl_session_tickets off;
    
    # SSL安全设置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;
    
    # 安全头部
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    
    # 客户端最大请求体大小
    client_max_body_size 10M;
    
    # 代理设置
    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://app:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

    log_info "Nginx配置创建完成"
}

# 安装SSL证书
install_ssl_certificate() {
    log_info "安装SSL证书..."
    
    # 安装Certbot
    sudo apt install -y certbot python3-certbot-nginx
    
    # 获取SSL证书
    sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --email $EMAIL --agree-tos --no-eff-email --non-interactive
    
    # 设置自动续期
    (crontab -l 2>/dev/null; echo "0 2 * * * /usr/bin/certbot renew --quiet") | crontab -
    
    log_info "SSL证书安装完成"
}

# 复制项目文件
copy_project_files() {
    log_info "复制项目文件..."
    
    # 获取当前脚本所在目录
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    # 复制所有必要文件到部署目录
    cp -r "$SCRIPT_DIR"/* /opt/apps/inventory-system/
    
    # 排除不需要的文件
    rm -rf /opt/apps/inventory-system/.git
    rm -rf /opt/apps/inventory-system/node_modules
    rm -rf /opt/apps/inventory-system/.next
    rm -rf /opt/apps/inventory-system/db/custom.db
    
    log_info "项目文件复制完成"
}

# 构建和启动应用
build_and_start() {
    log_info "构建和启动应用..."
    
    # 复制项目文件
    copy_project_files
    
    # 进入应用目录
    cd /opt/apps/inventory-system
    
    # 构建并启动服务
    docker compose up -d --build
    
    log_info "应用启动完成"
}

# 显示部署信息
show_deployment_info() {
    log_info "部署完成！"
    echo ""
    echo "=================================="
    echo "部署信息:"
    echo "=================================="
    echo "域名: https://$DOMAIN"
    echo "应用目录: /opt/apps/inventory-system"
    echo "管理命令:"
    echo "  查看状态: docker compose ps"
    echo "  查看日志: docker compose logs -f"
    echo "  重启服务: docker compose restart"
    echo "  停止服务: docker compose down"
    echo "=================================="
}

# 主函数
main() {
    echo "=================================="
    echo "智慧库存管理系统 - 快速部署脚本"
    echo "=================================="
    echo ""
    
    check_root
    check_system
    update_system
    install_basic_tools
    install_docker
    install_nginx
    setup_firewall
    create_app_directories
    get_env_variables
    create_env_file
    create_dockerfile
    create_docker_compose
    create_nginx_config
    install_ssl_certificate
    build_and_start
    show_deployment_info
    
    log_warn "请重新登录以使Docker用户组更改生效"
    log_warn "然后运行: cd /opt/apps/inventory-system && docker compose logs -f"
}

# 运行主函数
main "$@"