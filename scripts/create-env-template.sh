#!/bin/bash

# 智慧库存系统 - 环境变量模板生成脚本
# 用于创建 .env.template 文件

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否已存在模板文件
check_existing_template() {
    if [[ -f ".env.template" ]]; then
        log_warning ".env.template 文件已存在"
        read -p "是否要覆盖现有文件? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "操作已取消"
            exit 0
        fi
    fi
}

# 生成环境变量模板
create_template() {
    log_info "正在创建环境变量模板文件..."
    
    cat > .env.template << 'EOF'
# 智慧库存系统 - 环境变量配置模板
# 复制此文件为 .env.production 并修改相应配置

# 应用基础配置
NODE_ENV=production
PORT=3000
APP_NAME=智慧库存管理系统
APP_VERSION=1.0.0

# 数据库配置
DATABASE_URL="file:/app/data/custom.db"
DATABASE_PATH=/app/data/custom.db

# JWT认证配置
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# 管理员账号配置
ADMIN_PHONE=79122706664
ADMIN_PASSWORD=PRAISEJEANS.888

# API配置
API_BASE_URL=http://localhost:3000
API_TIMEOUT=30000

# CORS配置
CORS_ORIGIN=http://localhost:3000
CORS_CREDENTIALS=true

# 日志配置
LOG_LEVEL=info
LOG_FILE=/app/logs/app.log

# 监控配置
MONITORING_ENABLED=true
METRICS_PORT=9090
HEALTH_CHECK_INTERVAL=30000

# 缓存配置
CACHE_TTL=3600
CACHE_MAX_SIZE=1000

# 文件上传配置
UPLOAD_MAX_SIZE=10485760
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/gif,application/pdf

# 邮件配置（可选）
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=your-smtp-password
SMTP_FROM="智慧库存系统 <noreply@example.com>"

# Redis配置（可选，用于缓存和会话）
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# 安全配置
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# 备份配置
BACKUP_ENABLED=true
BACKUP_INTERVAL=86400000
BACKUP_RETENTION_DAYS=30
BACKUP_PATH=/app/backups

# Docker配置
DOCKER_REGISTRY=your-registry.com
DOCKER_IMAGE_TAG=latest

# 外部服务配置
EXTERNAL_API_TIMEOUT=10000
EXTERNAL_API_RETRIES=3

# 开发/调试配置
DEBUG_MODE=false
VERBOSE_LOGGING=false
ENABLE_PROFILER=false

# 性能配置
MAX_CONCURRENT_REQUESTS=1000
REQUEST_TIMEOUT=30000
KEEP_ALIVE_TIMEOUT=65000

# 安全头配置
HELMET_ENABLED=true
CSP_ENABLED=true
HSTS_ENABLED=true

# 数据库连接池配置
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT=30000
DB_POOL_CONNECTION_TIMEOUT=60000

# 会话配置
SESSION_SECRET=your-session-secret-change-this
SESSION_MAX_AGE=86400000

# 国际化配置
DEFAULT_LANGUAGE=zh-CN
SUPPORTED_LANGUAGES=zh-CN,en-US

# 功能开关
ENABLE_REGISTRATION=false
ENABLE_PASSWORD_RESET=true
ENABLE_EMAIL_VERIFICATION=false
ENABLE_TWO_FACTOR_AUTH=false

# 第三方集成（可选）
WECHAT_APP_ID=
WECHAT_APP_SECRET=
ALIPAY_APP_ID=
ALIPAY_PRIVATE_KEY=

# 监控和告警
SENTRY_DSN=
SLACK_WEBHOOK_URL=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# 自定义配置
CUSTOM_LOGO_URL=/logo.png
CUSTOM_FAVICON_URL=/favicon.ico
COMPANY_NAME=智慧库存管理系统
SUPPORT_EMAIL=support@example.com
SUPPORT_PHONE=400-123-4567
EOF

    log_success "环境变量模板文件创建成功"
}

# 设置文件权限
set_permissions() {
    log_info "设置文件权限..."
    chmod 644 .env.template
    log_success "文件权限设置完成"
}

# 验证文件
verify_template() {
    log_info "验证模板文件..."
    
    if [[ ! -f ".env.template" ]]; then
        log_error "模板文件创建失败"
        exit 1
    fi
    
    local file_size=$(stat -f%z .env.template 2>/dev/null || stat -c%s .env.template 2>/dev/null)
    if [[ $file_size -lt 1000 ]]; then
        log_error "模板文件大小异常，可能创建不完整"
        exit 1
    fi
    
    log_success "模板文件验证通过"
}

# 显示使用说明
show_usage() {
    cat << EOF

${BLUE}环境变量模板文件已创建完成！${NC}

${YELLOW}下一步操作：${NC}
1. 复制模板文件为生产环境配置：
   cp .env.template .env.production

2. 编辑生产环境配置：
   nano .env.production

3. 至少需要修改以下关键配置：
   - JWT_SECRET: 设置为安全的随机字符串（至少32字符）
   - ADMIN_PHONE: 管理员手机号
   - ADMIN_PASSWORD: 管理员密码
   - DATABASE_URL: 确认数据库路径正确

4. 生成安全的JWT密钥：
   openssl rand -base64 32

${GREEN}配置完成后，即可开始部署系统！${NC}

EOF
}

# 主函数
main() {
    echo "========================================"
    echo "  智慧库存系统 - 环境变量模板生成器"
    echo "========================================"
    echo
    
    check_existing_template
    create_template
    set_permissions
    verify_template
    show_usage
    
    log_success "环境变量模板生成完成！"
}

# 执行主函数
main "$@"