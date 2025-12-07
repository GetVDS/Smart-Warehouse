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
    log_info "使用项目根目录的Dockerfile..."
    
    # 如果项目根目录没有Dockerfile，则创建一个
    if [ ! -f /opt/apps/inventory-system/Dockerfile ]; then
        log_info "创建默认Dockerfile..."
        sudo cat > /opt/apps/inventory-system/Dockerfile <<'EOF'
# 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app

# 先复制package文件以利用Docker缓存
COPY package*.json ./
COPY .npmrc ./

# 安装依赖
RUN npm ci --legacy-peer-deps && npm cache clean --force

# 复制所有源代码和配置文件
COPY . .

# 生成Prisma客户端
RUN npx prisma generate

# 构建应用
RUN npm run build

# 生产阶段
FROM node:18-alpine AS runner

WORKDIR /app

# 创建非root用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制构建产物和必要的文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# 创建数据库目录和日志目录
RUN mkdir -p db logs && chown -R nextjs:nodejs db logs

# 设置用户
USER nextjs

# 暴露端口
EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"
ENV NODE_ENV "production"

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# 启动应用
CMD ["node", "server.js"]
EOF
    fi
    
    log_info "Dockerfile准备完成"
}

# 创建Docker Compose配置
create_docker_compose() {
    log_info "创建Docker Compose配置..."
    
    sudo cat > /opt/apps/inventory-system/docker-compose.yml <<EOF
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
      - JWT_SECRET=${JWT_SECRET}
      - NEXTAUTH_URL=https://${DOMAIN}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - FORCE_HTTPS=true
      - SECURE_COOKIES=true
      - ALLOWED_ORIGINS=https://${DOMAIN}
      - LOG_LEVEL=error
      - ENABLE_SECURITY_LOGGING=true
      - ENABLE_QUERY_MONITORING=true
      - SLOW_QUERY_THRESHOLD=1000
      - ENABLE_CONNECTION_POOL=true
      - MAX_CONNECTIONS=10
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
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/letsencrypt:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
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
    log_info "创建优化的nginx配置..."
    
    # 创建nginx目录
    sudo mkdir -p /opt/apps/inventory-system/nginx
    
    # 创建优化的nginx配置，解决502 Bad Gateway问题
    sudo cat > /opt/apps/inventory-system/nginx/nginx.conf <<EOF
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log notice;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # 日志格式
    log_format main '\$remote_addr - \$remote_user [\$time_local] "\$request" '
                    '\$status \$body_bytes_sent "\$http_referer" '
                    '"\$http_user_agent" "\$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    # 基本设置
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 20M;

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

    # 上游服务器配置
    upstream app {
        server app:3000;
        # 添加健康检查和连接保持
        keepalive 32;
    }

    # HTTP重定向到HTTPS
    server {
        listen 80;
        server_name _;
        return 301 https://\$host\$request_uri;
    }

    # HTTPS主服务器配置
    server {
        listen 443 ssl http2;
        server_name $DOMAIN;

        # SSL证书配置 (Let's Encrypt)
        ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
        
        # SSL安全配置
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # 安全头
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # API路由 - 添加CORS支持
        location /api/ {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_cache_bypass \$http_upgrade;
            proxy_read_timeout 86400;
            
            # CORS头
            add_header 'Access-Control-Allow-Origin' 'https://\$host' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization' always;
            add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;
        }

        # Next.js静态资源
        location /_next/static/ {
            proxy_pass http://app;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # 静态文件缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            proxy_pass http://app;
        }

        # 所有其他请求转发到Next.js应用
        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_cache_bypass \$http_upgrade;
            proxy_read_timeout 86400;
            
            # CORS头
            add_header 'Access-Control-Allow-Origin' 'https://\$host' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization' always;
            add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;
        }

        # 健康检查
        location /health {
            proxy_pass http://app/api/health;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
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
    
    # 停止nginx以释放80端口
    sudo systemctl stop nginx 2>/dev/null || true
    
    # 获取SSL证书
    sudo certbot certonly --standalone -d $DOMAIN -d www.$DOMAIN --email $EMAIL --agree-tos --no-eff-email --non-interactive
    
    # 创建证书目录链接
    sudo mkdir -p /opt/apps/inventory-system/nginx/ssl
    sudo ln -sf /etc/letsencrypt/live/$DOMAIN /opt/apps/inventory-system/nginx/ssl/live
    sudo ln -sf /etc/letsencrypt/archive/$DOMAIN /opt/apps/inventory-system/nginx/ssl/archive
    
    # 设置自动续期
    (crontab -l 2>/dev/null; echo "0 2 * * * /usr/bin/certbot renew --quiet --deploy-hook 'docker compose -f /opt/apps/inventory-system/docker-compose.yml restart nginx'") | crontab -
    
    log_info "SSL证书安装完成"
}

# 复制项目文件
copy_project_files() {
    log_info "复制项目文件..."
    
    # 获取当前脚本所在目录
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    # 确保构建目录存在
    sudo mkdir -p /opt/apps/inventory-system
    
    # 复制所有必需的文件和目录 - 确保完整性
    log_info "复制源代码和配置文件..."
    
    # 复制核心目录
    sudo cp -r "$SCRIPT_DIR/src" /opt/apps/inventory-system/
    sudo cp -r "$SCRIPT_DIR/prisma" /opt/apps/inventory-system/
    sudo cp -r "$SCRIPT_DIR/public" /opt/apps/inventory-system/
    sudo cp -r "$SCRIPT_DIR/lib" /opt/apps/inventory-system/src/ 2>/dev/null || true
    sudo cp -r "$SCRIPT_DIR/types" /opt/apps/inventory-system/src/ 2>/dev/null || true
    sudo cp -r "$SCRIPT_DIR/hooks" /opt/apps/inventory-system/src/ 2>/dev/null || true
    sudo cp -r "$SCRIPT_DIR/components" /opt/apps/inventory-system/src/ 2>/dev/null || true
    
    # 复制配置文件 - 确保所有必需文件都被复制
    sudo cp "$SCRIPT_DIR/package.json" /opt/apps/inventory-system/
    sudo cp "$SCRIPT_DIR/package-lock.json" /opt/apps/inventory-system/
    sudo cp "$SCRIPT_DIR/tsconfig.json" /opt/apps/inventory-system/
    sudo cp "$SCRIPT_DIR/next.config.js" /opt/apps/inventory-system/
    sudo cp "$SCRIPT_DIR/tailwind.config.ts" /opt/apps/inventory-system/
    sudo cp "$SCRIPT_DIR/postcss.config.mjs" /opt/apps/inventory-system/
    sudo cp "$SCRIPT_DIR/.dockerignore" /opt/apps/inventory-system/
    sudo cp "$SCRIPT_DIR/components.json" /opt/apps/inventory-system/
    sudo cp "$SCRIPT_DIR/eslint.config.mjs" /opt/apps/inventory-system/
    sudo cp "$SCRIPT_DIR/.npmrc" /opt/apps/inventory-system/
    sudo cp "$SCRIPT_DIR/.env" /opt/apps/inventory-system/ 2>/dev/null || true
    
    # 复制初始化脚本
    log_info "复制初始化脚本..."
    sudo cp "$SCRIPT_DIR/init-admin.js" /opt/apps/inventory-system/
    sudo cp "$SCRIPT_DIR/init-test-data.js" /opt/apps/inventory-system/ 2>/dev/null || true
    sudo cp "$SCRIPT_DIR/create-simple-test-data.js" /opt/apps/inventory-system/ 2>/dev/null || true
    
    # 复制Prisma修复脚本
    if [ -f "$SCRIPT_DIR/fix-prisma-baseline.sh" ]; then
        sudo cp "$SCRIPT_DIR/fix-prisma-baseline.sh" /opt/apps/inventory-system/
        sudo chmod +x /opt/apps/inventory-system/fix-prisma-baseline.sh
        log_info "✅ Prisma基线化修复脚本已复制"
    else
        log_warn "⚠️ 未找到fix-prisma-baseline.sh脚本"
    fi
    
    # 复制Docker相关文件
    if [ -f "$SCRIPT_DIR/Dockerfile" ]; then
        sudo cp "$SCRIPT_DIR/Dockerfile" /opt/apps/inventory-system/
    fi
    if [ -f "$SCRIPT_DIR/docker-compose.yml" ]; then
        sudo cp "$SCRIPT_DIR/docker-compose.yml" /opt/apps/inventory-system/
    fi
    if [ -f "$SCRIPT_DIR/docker-compose.prod.yml" ]; then
        sudo cp "$SCRIPT_DIR/docker-compose.prod.yml" /opt/apps/inventory-system/
    fi
    if [ -f "$SCRIPT_DIR/Caddyfile" ]; then
        sudo cp "$SCRIPT_DIR/Caddyfile" /opt/apps/inventory-system/
    fi
    
    # 排除不需要的文件
    log_info "清理不需要的文件..."
    sudo rm -rf /opt/apps/inventory-system/.git
    sudo rm -rf /opt/apps/inventory-system/node_modules
    sudo rm -rf /opt/apps/inventory-system/.next
    sudo rm -rf /opt/apps/inventory-system/db/custom.db
    sudo rm -rf /opt/apps/inventory-system/logs
    
    # 设置正确的文件权限
    sudo chown -R $USER:$USER /opt/apps/inventory-system
    
    log_info "项目文件复制完成"
}

# 构建和启动应用
build_and_start() {
    log_info "构建和启动应用..."
    
    # 复制项目文件
    copy_project_files
    
    # 进入应用目录
    cd /opt/apps/inventory-system
    
    # 先只启动应用容器（不启动nginx）
    log_info "启动应用容器..."
    docker compose up -d --build app
    
    # 等待应用容器启动
    log_info "等待应用容器启动..."
    sleep 30
    
    # 初始化数据库
    log_info "初始化数据库..."
    
    # 数据库初始化失败重试机制
    retry_count=0
    max_retries=3
    
    while [ $retry_count -lt $max_retries ]; do
        # 检查是否需要基线化数据库
        if [ -n "$(ls -A prisma/migrations)" ]; then
            log_info "检测到现有迁移，使用Prisma修复脚本..."
            
            # 尝试使用修复脚本
            if docker compose exec app ./fix-prisma-baseline.sh auto; then
                log_info "✅ Prisma数据库修复成功"
            else
                log_warn "修复脚本失败，尝试手动基线化..."
                
                # 手动基线化
                if ! docker compose exec app npx prisma migrate baseline 2>/dev/null; then
                    log_warn "基线化失败，重置数据库..."
                    docker compose exec app rm -f /app/db/custom.db 2>/dev/null || true
                    docker compose exec app npx prisma db push --force-reset
                fi
            fi
        else
            log_info "应用数据库迁移..."
            docker compose exec app npx prisma migrate deploy
        fi
        
        # 验证数据库初始化
        if docker compose exec app npx prisma db pull --force > /dev/null 2>&1; then
            log_info "✅ 数据库初始化成功"
            break
        else
            retry_count=$((retry_count + 1))
            if [ $retry_count -lt $max_retries ]; then
                log_warn "数据库初始化失败，重试 $retry_count/$max_retries..."
                sleep 5
                # 重启应用容器
                docker compose restart app
                sleep 10
            else
                log_error "数据库初始化失败，已达到最大重试次数"
                exit 1
            fi
        fi
    done
    
    # 确保数据初始化
    if [ -f "init-test-data.js" ]; then
        log_info "确保测试数据已初始化..."
        docker compose exec app node init-test-data.js || log_warn "测试数据初始化失败，但继续部署"
    fi

    # 初始化管理员用户
    log_info "初始化管理员用户..."
    docker compose exec app node init-admin.js || log_error "管理员用户初始化失败"
    
    # 验证数据库连接和基本功能
    log_info "验证数据库连接和基本功能..."
    if docker compose exec app npx prisma db pull --force > /dev/null 2>&1; then
        log_info "✅ 数据库连接验证成功"
    else
        log_error "❌ 数据库连接验证失败"
        log_info "尝试重新生成Prisma客户端..."
        docker compose exec app npx prisma generate
        docker compose exec app npx prisma db pull --force || log_warn "数据库连接仍有问题，但继续部署"
    fi
    
    # 安装SSL证书（如果还没有安装）
    if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
        log_info "安装SSL证书..."
        install_ssl_certificate
    fi
    
    # 启动nginx容器
    log_info "启动nginx容器..."
    docker compose up -d nginx
    
    log_info "应用启动完成"
    
    # 部署后自检验证
    post_deployment_check
}

# 部署后自检验证
post_deployment_check() {
    log_info "开始部署后自检验证..."
    
    # 等待服务完全启动
    log_info "等待服务完全启动..."
    sleep 30
    
    # 检查容器状态
    log_info "检查容器状态..."
    docker compose ps
    
    # 检查应用健康状态
    log_info "检查应用健康状态..."
    if curl -f -s http://localhost:3000/api/health > /dev/null; then
        log_info "✅ 应用健康检查通过"
    else
        log_error "❌ 应用健康检查失败"
        log_info "获取详细错误信息..."
        curl -v http://localhost:3000/api/health || true
    fi
    
    # 检查Nginx反向代理状态
    log_info "检查Nginx反向代理状态..."
    if curl -f -s http://localhost/api/health > /dev/null; then
        log_info "✅ Nginx反向代理正常"
    else
        log_error "❌ Nginx反向代理失败"
        log_info "获取详细错误信息..."
        curl -v http://localhost/api/health || true
        
        # 检查Nginx配置
        log_info "检查Nginx配置..."
        docker compose exec nginx nginx -t || true
        
        # 检查Nginx日志
        log_info "查看Nginx错误日志..."
        docker compose logs nginx || true
    fi
    
    # 检查API端点连通性
    log_info "检查关键API端点..."
    
    # 检查登录API
    log_info "检查登录API (/api/auth/login)..."
    login_response=$(curl -s -w "%{http_code}" -o /tmp/login_response.json -X POST http://localhost/api/auth/login \
        -H "Content-Type: application/json" \
        -d '{"username":"admin","password":"admin123"}' || echo "000")
    
    if [[ "$login_response" == "200" ]]; then
        log_info "✅ 登录API正常"
    else
        log_error "❌ 登录API失败 (HTTP $login_response)"
        if [ -f /tmp/login_response.json ]; then
            log_info "登录API响应内容:"
            cat /tmp/login_response.json
        fi
    fi
    
    # 检查产品API
    log_info "检查产品API (/api/products)..."
    products_response=$(curl -s -w "%{http_code}" -o /tmp/products_response.json http://localhost/api/products || echo "000")
    
    if [[ "$products_response" == "200" ]]; then
        log_info "✅ 产品API正常"
    else
        log_error "❌ 产品API失败 (HTTP $products_response)"
        if [ -f /tmp/products_response.json ]; then
            log_info "产品API响应内容:"
            cat /tmp/products_response.json
        fi
    fi
    
    # 检查应用容器日志中的错误
    log_info "检查应用容器日志中的错误..."
    error_count=$(docker compose logs app 2>&1 | grep -i error | wc -l)
    if [ "$error_count" -gt 0 ]; then
        log_warn "发现 $error_count 个错误日志条目"
        docker compose logs app | tail -20
    else
        log_info "✅ 应用日志中未发现错误"
    fi
    
    # 检查数据库连接
    log_info "检查数据库连接..."
    if docker compose exec app npx prisma db pull --force > /dev/null 2>&1; then
        log_info "✅ 数据库连接正常"
    else
        log_error "❌ 数据库连接失败"
        docker compose exec app npx prisma db pull --force || true
    fi
    
    # 生成自检报告
    log_info "生成自检报告..."
    cat > /opt/apps/inventory-system/deployment-check-report.txt <<EOF
智慧库存系统部署自检报告
生成时间: $(date)
域名: https://$DOMAIN

=== 容器状态 ===
$(docker compose ps)

=== 健康检查 ===
应用健康状态: $(curl -s -w "%{http_code}" -o /dev/null http://localhost:3000/api/health)
Nginx代理状态: $(curl -s -w "%{http_code}" -o /dev/null http://localhost/api/health)

=== API端点测试 ===
登录API: $login_response
产品API: $products_response

=== 错误统计 ===
应用日志错误数: $error_count

=== 建议的后续步骤 ===
1. 访问 https://$DOMAIN 确认前端正常加载
2. 使用 admin/admin123 登录系统
3. 检查所有功能模块是否正常工作
4. 监控系统性能和日志

EOF
    
    log_info "自检报告已保存到: /opt/apps/inventory-system/deployment-check-report.txt"
    log_info "部署后自检验证完成"
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
    build_and_start
    show_deployment_info
    
    log_warn "请重新登录以使Docker用户组更改生效"
    log_warn "然后运行: cd /opt/apps/inventory-system && docker compose logs -f"
}

# 运行主函数
main "$@"