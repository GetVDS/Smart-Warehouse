#!/bin/bash

# 智慧库存系统 - 502错误综合修复脚本
# 深度排查并解决Nginx与Next.js应用间的通信问题

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

# 检查系统状态
check_system_status() {
    log_info "检查系统状态..."
    
    # 检查Docker状态
    if ! systemctl is-active --quiet docker; then
        log_error "Docker服务未运行"
        sudo systemctl start docker
        sleep 5
    fi
    
    # 检查Docker Compose版本
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose未正确安装"
        exit 1
    fi
    
    log_info "✅ 系统状态检查完成"
}

# 分析当前502错误
analyze_502_errors() {
    log_info "分析当前502错误..."
    
    # 检查Nginx错误日志
    log_info "检查Nginx错误日志..."
    if [ -f "/var/log/nginx/error.log" ]; then
        recent_errors=$(tail -50 /var/log/nginx/error.log | grep -i "502\|upstream\|connection\|timeout" || true)
        if [ -n "$recent_errors" ]; then
            log_warn "发现最近的502相关错误:"
            echo "$recent_errors"
        else
            log_info "未发现最近的502错误"
        fi
    fi
    
    # 检查Docker容器状态
    log_info "检查Docker容器状态..."
    docker compose ps
    
    # 检查容器资源使用情况
    log_info "检查容器资源使用情况..."
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" || true
}

# 修复Nginx配置中的关键问题
fix_nginx_config() {
    log_info "修复Nginx配置中的关键问题..."
    
    # 创建优化的Nginx配置
    cat > nginx-optimized.conf <<'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log notice;
pid /var/run/nginx.pid;

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

    # 基本设置
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 20M;
    client_body_timeout 60s;
    client_header_timeout 60s;

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

    # 上游服务器配置 - 增强版
    upstream app {
        server app:3000 max_fails=3 fail_timeout=30s;
        keepalive 32;
        keepalive_requests 100;
        keepalive_timeout 60s;
    }

    # HTTP重定向到HTTPS
    server {
        listen 80;
        server_name _;
        return 301 https://$host$request_uri;
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

        # 安全头 - 包含CSP
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' ws: wss:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; manifest-src 'self'; worker-src 'self' blob:; child-src 'self' blob:;" always;

        # API路由 - 优化版
        location /api/ {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            
            # 超时设置
            proxy_connect_timeout 30s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
            
            # 缓冲设置
            proxy_buffering on;
            proxy_buffer_size 4k;
            proxy_buffers 8 4k;
            proxy_busy_buffers_size 8k;
            
            # CORS头
            add_header 'Access-Control-Allow-Origin' 'https://$host' always;
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

        # 所有其他请求转发到Next.js应用 - 优化版
        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            
            # 超时设置
            proxy_connect_timeout 30s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
            
            # 缓冲设置
            proxy_buffering on;
            proxy_buffer_size 4k;
            proxy_buffers 8 4k;
            proxy_busy_buffers_size 8k;
            
            # CORS头
            add_header 'Access-Control-Allow-Origin' 'https://$host' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization' always;
            add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;
        }

        # 健康检查 - 优化版
        location /health {
            proxy_pass http://app/api/health;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # 超时设置
            proxy_connect_timeout 10s;
            proxy_send_timeout 10s;
            proxy_read_timeout 10s;
        }
    }
}
EOF

    log_info "✅ 优化的Nginx配置已创建"
}

# 修复Docker Compose配置
fix_docker_compose() {
    log_info "修复Docker Compose配置..."
    
    cat > docker-compose-optimized.yml <<'EOF'
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
      - NEXT_PUBLIC_API_URL=https://${DOMAIN}
      - LOG_LEVEL=error
      - ENABLE_SECURITY_LOGGING=true
      - ENABLE_QUERY_MONITORING=true
      - SLOW_QUERY_THRESHOLD=1000
      - ENABLE_CONNECTION_POOL=true
      - MAX_CONNECTIONS=10
      # 新增性能优化环境变量
      - NODE_OPTIONS=--max-old-space-size=2048
      - NEXT_TELEMETRY_DISABLED=1
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
    # 资源限制
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
        reservations:
          memory: 512M
          cpus: '0.25'

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx-optimized.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/letsencrypt:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - ./logs/nginx:/var/log/nginx
    depends_on:
      app:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - app-network
    # 资源限制
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.25'
        reservations:
          memory: 256M
          cpus: '0.1'

networks:
  app-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
EOF

    log_info "✅ 优化的Docker Compose配置已创建"
}

# 创建健康检查增强脚本
create_health_check_script() {
    log_info "创建健康检查增强脚本..."
    
    cat > enhanced-health-check.sh <<'EOF'
#!/bin/bash

# 增强的健康检查脚本

DOMAIN=${1:-localhost}
MAX_RETRIES=5
RETRY_INTERVAL=10

check_service_health() {
    local service_name=$1
    local url=$2
    local retries=0
    
    echo "检查 $service_name 健康状态..."
    
    while [ $retries -lt $MAX_RETRIES ]; do
        if curl -f -s --max-time 10 "$url" > /dev/null; then
            echo "✅ $service_name 健康检查通过"
            return 0
        else
            retries=$((retries + 1))
            echo "❌ $service_name 健康检查失败，重试 $retries/$MAX_RETRIES..."
            sleep $RETRY_INTERVAL
        fi
    done
    
    echo "❌ $service_name 健康检查最终失败"
    return 1
}

# 检查应用直接健康状态
check_service_health "应用直接访问" "http://localhost:3000/api/health"

# 检查Nginx代理健康状态
check_service_health "Nginx代理" "http://localhost/api/health"

# 检查HTTPS健康状态
if [ "$DOMAIN" != "localhost" ]; then
    check_service_health "HTTPS访问" "https://$DOMAIN/api/health"
fi

# 检查容器状态
echo "检查容器状态..."
docker compose ps

# 检查网络连接
echo "检查网络连接..."
docker network ls
docker network inspect $(docker compose ps -q | head -1 | xargs docker inspect | jq -r '.[0].NetworkSettings.Networks | keys[]' | head -1) || true

# 检查资源使用
echo "检查资源使用..."
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" || true
EOF

    chmod +x enhanced-health-check.sh
    log_info "✅ 增强的健康检查脚本已创建"
}

# 创建自动恢复脚本
create_auto_recovery_script() {
    log_info "创建自动恢复脚本..."
    
    cat > auto-recovery.sh <<'EOF'
#!/bin/bash

# 自动恢复脚本

log_info() {
    echo -e "\033[0;32m[INFO]\033[0m $1"
}

log_error() {
    echo -e "\033[0;31m[ERROR]\033[0m $1"
}

# 检查服务状态
check_service_status() {
    local service_name=$1
    local url=$2
    
    if ! curl -f -s --max-time 10 "$url" > /dev/null; then
        log_error "$service_name 服务异常，开始恢复..."
        return 1
    fi
    return 0
}

# 恢复应用容器
recover_app() {
    log_info "恢复应用容器..."
    
    # 重启应用容器
    docker compose restart app
    
    # 等待容器启动
    sleep 30
    
    # 检查健康状态
    if check_service_status "应用" "http://localhost:3000/api/health"; then
        log_info "✅ 应用容器恢复成功"
        return 0
    else
        log_error "应用容器恢复失败，尝试重建..."
        docker compose up -d --force-recreate app
        sleep 30
    fi
}

# 恢复Nginx容器
recover_nginx() {
    log_info "恢复Nginx容器..."
    
    # 检查Nginx配置
    if ! docker compose exec nginx nginx -t; then
        log_error "Nginx配置错误，重新加载配置..."
        docker compose exec nginx nginx -s reload
    fi
    
    # 重启Nginx容器
    docker compose restart nginx
    
    # 等待容器启动
    sleep 15
    
    # 检查健康状态
    if check_service_status "Nginx" "http://localhost/api/health"; then
        log_info "✅ Nginx容器恢复成功"
        return 0
    else
        log_error "Nginx容器恢复失败，尝试重建..."
        docker compose up -d --force-recreate nginx
        sleep 15
    fi
}

# 主恢复逻辑
main() {
    log_info "开始自动恢复检查..."
    
    local app_failed=false
    local nginx_failed=false
    
    # 检查应用状态
    if ! check_service_status "应用" "http://localhost:3000/api/health"; then
        app_failed=true
    fi
    
    # 检查Nginx状态
    if ! check_service_status "Nginx" "http://localhost/api/health"; then
        nginx_failed=true
    fi
    
    # 执行恢复
    if [ "$app_failed" = true ]; then
        recover_app
    fi
    
    if [ "$nginx_failed" = true ]; then
        recover_nginx
    fi
    
    # 最终验证
    if check_service_status "系统" "http://localhost/api/health"; then
        log_info "✅ 系统恢复成功"
    else
        log_error "❌ 系统恢复失败，需要人工干预"
        exit 1
    fi
}

main "$@"
EOF

    chmod +x auto-recovery.sh
    log_info "✅ 自动恢复脚本已创建"
}

# 创建监控脚本
create_monitoring_script() {
    log_info "创建监控脚本..."
    
    cat > continuous-monitor.sh <<'EOF'
#!/bin/bash

# 持续监控脚本

LOG_FILE="/var/log/inventory-monitor.log"
DOMAIN=${1:-localhost}
CHECK_INTERVAL=60
MAX_FAILURES=3
FAILURE_COUNT=0

# 创建日志目录
mkdir -p $(dirname $LOG_FILE)

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

check_service() {
    local service_name=$1
    local url=$2
    
    if curl -f -s --max-time 10 "$url" > /dev/null; then
        log_message "✅ $service_name 服务正常"
        FAILURE_COUNT=0
        return 0
    else
        log_message "❌ $service_name 服务异常"
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
        return 1
    fi
}

# 主监控循环
main() {
    log_message "开始持续监控..."
    
    while true; do
        # 检查应用服务
        if ! check_service "应用" "http://localhost:3000/api/health"; then
            if [ $FAILURE_COUNT -ge $MAX_FAILURES ]; then
                log_message "🚨 服务连续失败 $MAX_FAILURES 次，触发自动恢复..."
                ./auto-recovery.sh
                FAILURE_COUNT=0
            fi
        fi
        
        # 检查Nginx代理
        check_service "Nginx代理" "http://localhost/api/health"
        
        # 检查系统资源
        MEMORY_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
        if [ $MEMORY_USAGE -gt 90 ]; then
            log_message "⚠️ 内存使用率过高: ${MEMORY_USAGE}%"
        fi
        
        # 检查磁盘空间
        DISK_USAGE=$(df / | awk 'NR==2{print $5}' | sed 's/%//')
        if [ $DISK_USAGE -gt 85 ]; then
            log_message "⚠️ 磁盘使用率过高: ${DISK_USAGE}%"
        fi
        
        sleep $CHECK_INTERVAL
    done
}

main "$@"
EOF

    chmod +x continuous-monitor.sh
    log_info "✅ 持续监控脚本已创建"
}

# 应用修复
apply_fixes() {
    log_info "应用修复..."
    
    # 备份当前配置
    log_info "备份当前配置..."
    [ -f "docker-compose.yml" ] && cp docker-compose.yml docker-compose.yml.backup
    [ -f "nginx.conf" ] && cp nginx.conf nginx.conf.backup
    
    # 应用新配置
    log_info "应用优化的配置..."
    cp docker-compose-optimized.yml docker-compose.yml
    cp nginx-optimized.conf nginx.conf
    
    # 重新启动服务
    log_info "重新启动服务..."
    docker compose down
    sleep 10
    docker compose up -d --build
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 60
    
    # 运行健康检查
    log_info "运行健康检查..."
    ./enhanced-health-check.sh "$DOMAIN"
}

# 主函数
main() {
    echo "=================================="
    echo "智慧库存系统 - 502错误综合修复"
    echo "=================================="
    echo ""
    
    check_system_status
    analyze_502_errors
    fix_nginx_config
    fix_docker_compose
    create_health_check_script
    create_auto_recovery_script
    create_monitoring_script
    apply_fixes
    
    echo ""
    echo "=================================="
    echo "修复完成！"
    echo "=================================="
    echo "创建的文件:"
    echo "  - nginx-optimized.conf (优化的Nginx配置)"
    echo "  - docker-compose-optimized.yml (优化的Docker Compose配置)"
    echo "  - enhanced-health-check.sh (增强的健康检查)"
    echo "  - auto-recovery.sh (自动恢复脚本)"
    echo "  - continuous-monitor.sh (持续监控脚本)"
    echo ""
    echo "使用方法:"
    echo "  手动健康检查: ./enhanced-health-check.sh"
    echo "  自动恢复: ./auto-recovery.sh"
    echo "  持续监控: ./continuous-monitor.sh"
    echo "=================================="
}

# 运行主函数
main "$@"
EOF

chmod +x comprehensive-502-fix.sh
log_info "✅ 502错误综合修复脚本已创建"