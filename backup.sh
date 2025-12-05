#!/bin/bash

# 智慧库存管理系统 - 备份脚本

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

# 配置
BACKUP_DIR="/opt/apps/inventory-system/backups"
APP_DIR="/opt/apps/inventory-system"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# 创建备份目录
create_backup_dir() {
    if [[ ! -d "$BACKUP_DIR" ]]; then
        mkdir -p "$BACKUP_DIR"
        log_info "创建备份目录: $BACKUP_DIR"
    fi
}

# 备份数据库
backup_database() {
    log_info "备份数据库..."
    
    if [[ -f "$APP_DIR/db/custom.db" ]]; then
        cp "$APP_DIR/db/custom.db" "$BACKUP_DIR/custom_$TIMESTAMP.db"
        log_info "数据库备份完成: custom_$TIMESTAMP.db"
    else
        log_warn "数据库文件不存在: $APP_DIR/db/custom.db"
    fi
}

# 备份配置文件
backup_config() {
    log_info "备份配置文件..."
    
    # 备份环境变量
    if [[ -f "$APP_DIR/.env.production" ]]; then
        cp "$APP_DIR/.env.production" "$BACKUP_DIR/env_$TIMESTAMP"
        log_info "环境变量备份完成: env_$TIMESTAMP"
    fi
    
    # 备份Nginx配置
    if [[ -d "$APP_DIR/nginx" ]]; then
        tar -czf "$BACKUP_DIR/nginx_$TIMESTAMP.tar.gz" -C "$APP_DIR" nginx/
        log_info "Nginx配置备份完成: nginx_$TIMESTAMP.tar.gz"
    fi
    
    # 备份Docker配置
    if [[ -f "$APP_DIR/docker-compose.yml" ]]; then
        cp "$APP_DIR/docker-compose.yml" "$BACKUP_DIR/docker-compose_$TIMESTAMP.yml"
        log_info "Docker Compose配置备份完成: docker-compose_$TIMESTAMP.yml"
    fi
    
    # 备份生产Docker配置
    if [[ -f "$APP_DIR/production-docker-compose.yml" ]]; then
        cp "$APP_DIR/production-docker-compose.yml" "$BACKUP_DIR/production-docker-compose_$TIMESTAMP.yml"
        log_info "生产Docker Compose配置备份完成: production-docker-compose_$TIMESTAMP.yml"
    fi
}

# 备份应用日志
backup_logs() {
    log_info "备份应用日志..."
    
    if [[ -d "$APP_DIR/logs" ]]; then
        tar -czf "$BACKUP_DIR/logs_$TIMESTAMP.tar.gz" -C "$APP_DIR" logs/
        log_info "应用日志备份完成: logs_$TIMESTAMP.tar.gz"
    fi
    
    # 备份Nginx日志
    if [[ -d "$APP_DIR/logs/nginx" ]]; then
        tar -czf "$BACKUP_DIR/nginx_logs_$TIMESTAMP.tar.gz" -C "$APP_DIR/logs" nginx/
        log_info "Nginx日志备份完成: nginx_logs_$TIMESTAMP.tar.gz"
    fi
}

# 清理旧备份
cleanup_old_backups() {
    log_info "清理 $RETENTION_DAYS 天前的备份..."
    
    find "$BACKUP_DIR" -name "*.db" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "env_*" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "docker-compose_*.yml" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "production-docker-compose_*.yml" -mtime +$RETENTION_DAYS -delete
    
    log_info "旧备份清理完成"
}

# 创建备份信息文件
create_backup_info() {
    log_info "创建备份信息文件..."
    
    cat > "$BACKUP_DIR/backup_info_$TIMESTAMP.txt" <<EOF
备份时间: $(date)
备份类型: 完整备份
备份内容:
- 数据库: custom_$TIMESTAMP.db
- 环境变量: env_$TIMESTAMP
- Nginx配置: nginx_$TIMESTAMP.tar.gz
- Docker配置: docker-compose_$TIMESTAMP.yml
- 生产Docker配置: production-docker-compose_$TIMESTAMP.yml
- 应用日志: logs_$TIMESTAMP.tar.gz
- Nginx日志: nginx_logs_$TIMESTAMP.tar.gz

系统信息:
- 操作系统: $(uname -a)
- Docker版本: $(docker --version)
- Nginx版本: $(nginx -v 2>&1 | head -1)
- 磁盘使用: $(df -h /)
- 内存使用: $(free -h)
EOF

    log_info "备份信息文件创建完成: backup_info_$TIMESTAMP.txt"
}

# 压缩备份
compress_backup() {
    log_info "压缩备份文件..."
    
    # 创建临时目录
    TEMP_DIR=$(mktemp -d)
    
    # 复制所有备份文件到临时目录
    find "$BACKUP_DIR" -name "*_$TIMESTAMP*" -exec cp {} "$TEMP_DIR/" \;
    
    # 创建压缩包
    tar -czf "$BACKUP_DIR/full_backup_$TIMESTAMP.tar.gz" -C "$TEMP_DIR" .
    
    # 清理临时目录
    rm -rf "$TEMP_DIR"
    
    log_info "备份压缩完成: full_backup_$TIMESTAMP.tar.gz"
}

# 显示备份结果
show_backup_result() {
    log_info "备份完成！"
    echo ""
    echo "=================================="
    echo "备份信息:"
    echo "=================================="
    echo "备份目录: $BACKUP_DIR"
    echo "备份时间: $TIMESTAMP"
    echo "备份文件:"
    ls -la "$BACKUP_DIR" | grep "$TIMESTAMP"
    echo ""
    echo "备份大小:"
    du -sh "$BACKUP_DIR/full_backup_$TIMESTAMP.tar.gz"
    echo "=================================="
}

# 主函数
main() {
    echo "=================================="
    echo "智慧库存管理系统 - 备份脚本"
    echo "=================================="
    echo ""
    
    create_backup_dir
    backup_database
    backup_config
    backup_logs
    cleanup_old_backups
    create_backup_info
    compress_backup
    show_backup_result
}

# 运行主函数
main "$@"