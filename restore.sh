#!/bin/bash

# 智慧库存管理系统 - 恢复脚本

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

# 检查参数
check_params() {
    if [[ $# -eq 0 ]]; then
        log_error "请指定备份时间戳"
        echo "用法: $0 <TIMESTAMP>"
        echo "例如: $0 20231204_143022"
        echo ""
        echo "可用备份:"
        ls -la "$BACKUP_DIR" | grep "full_backup" | awk '{print $9}' | sed 's/full_backup_//' | sed 's/.tar.gz//'
        exit 1
    fi
    
    TIMESTAMP=$1
    BACKUP_FILE="$BACKUP_DIR/full_backup_$TIMESTAMP.tar.gz"
    
    if [[ ! -f "$BACKUP_FILE" ]]; then
        log_error "备份文件不存在: $BACKUP_FILE"
        exit 1
    fi
}

# 停止当前服务
stop_services() {
    log_info "停止当前服务..."
    
    cd "$APP_DIR"
    
    if [[ -f "docker-compose.yml" ]]; then
        docker compose down
        log_info "服务已停止"
    elif [[ -f "production-docker-compose.yml" ]]; then
        docker compose -f production-docker-compose.yml down
        log_info "服务已停止"
    else
        log_warn "Docker Compose文件不存在，跳过停止服务"
    fi
}

# 创建临时目录
create_temp_dir() {
    TEMP_DIR=$(mktemp -d)
    log_info "创建临时目录: $TEMP_DIR"
    
    # 解压备份文件
    tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"
    log_info "备份文件解压完成"
}

# 备份当前数据（安全起见）
backup_current_data() {
    log_info "备份当前数据..."
    
    CURRENT_BACKUP_DIR="$BACKUP_DIR/current_backup_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$CURRENT_BACKUP_DIR"
    
    # 备份数据库
    if [[ -f "$APP_DIR/db/custom.db" ]]; then
        cp "$APP_DIR/db/custom.db" "$CURRENT_BACKUP_DIR/"
        log_info "当前数据库已备份"
    fi
    
    # 备份配置文件
    if [[ -f "$APP_DIR/.env.production" ]]; then
        cp "$APP_DIR/.env.production" "$CURRENT_BACKUP_DIR/"
    fi
    
    log_info "当前数据备份完成"
}

# 恢复数据库
restore_database() {
    log_info "恢复数据库..."
    
    if [[ -f "$TEMP_DIR/custom_$TIMESTAMP.db" ]]; then
        cp "$TEMP_DIR/custom_$TIMESTAMP.db" "$APP_DIR/db/"
        chmod 644 "$APP_DIR/db/custom.db"
        log_info "数据库恢复完成"
    else
        log_warn "数据库备份文件不存在"
    fi
}

# 恢复配置文件
restore_config() {
    log_info "恢复配置文件..."
    
    # 恢复环境变量
    if [[ -f "$TEMP_DIR/env_$TIMESTAMP" ]]; then
        cp "$TEMP_DIR/env_$TIMESTAMP" "$APP_DIR/.env.production"
        log_info "环境变量恢复完成"
    fi
    
    # 恢复Nginx配置
    if [[ -f "$TEMP_DIR/nginx_$TIMESTAMP.tar.gz" ]]; then
        tar -xzf "$TEMP_DIR/nginx_$TIMESTAMP.tar.gz" -C "$APP_DIR/"
        log_info "Nginx配置恢复完成"
    fi
    
    # 恢复Docker配置
    if [[ -f "$TEMP_DIR/docker-compose_$TIMESTAMP.yml" ]]; then
        cp "$TEMP_DIR/docker-compose_$TIMESTAMP.yml" "$APP_DIR/docker-compose.yml"
        log_info "Docker配置恢复完成"
    fi
    
    # 恢复生产Docker配置
    if [[ -f "$TEMP_DIR/production-docker-compose_$TIMESTAMP.yml" ]]; then
        cp "$TEMP_DIR/production-docker-compose_$TIMESTAMP.yml" "$APP_DIR/production-docker-compose.yml"
        log_info "生产Docker配置恢复完成"
    fi
}

# 恢复日志（可选）
restore_logs() {
    read -p "是否恢复日志文件？(y/N): " restore_logs
    
    if [[ $restore_logs =~ ^[Yy]$ ]]; then
        log_info "恢复日志文件..."
        
        # 恢复应用日志
        if [[ -f "$TEMP_DIR/logs_$TIMESTAMP.tar.gz" ]]; then
            tar -xzf "$TEMP_DIR/logs_$TIMESTAMP.tar.gz" -C "$APP_DIR/"
            log_info "应用日志恢复完成"
        fi
        
        # 恢复Nginx日志
        if [[ -f "$TEMP_DIR/nginx_logs_$TIMESTAMP.tar.gz" ]]; then
            mkdir -p "$APP_DIR/logs/nginx"
            tar -xzf "$TEMP_DIR/nginx_logs_$TIMESTAMP.tar.gz" -C "$APP_DIR/logs/"
            log_info "Nginx日志恢复完成"
        fi
    fi
}

# 设置权限
set_permissions() {
    log_info "设置文件权限..."
    
    # 设置应用目录权限
    chown -R $USER:$USER "$APP_DIR"
    chmod -R 755 "$APP_DIR"
    chmod 600 "$APP_DIR/.env.production" 2>/dev/null || true
    
    # 设置数据库权限
    if [[ -f "$APP_DIR/db/custom.db" ]]; then
        chmod 644 "$APP_DIR/db/custom.db"
    fi
    
    log_info "文件权限设置完成"
}

# 启动服务
start_services() {
    log_info "启动服务..."
    
    cd "$APP_DIR"
    
    if [[ -f "docker-compose.yml" ]]; then
        docker compose up -d
        
        # 等待服务启动
        log_info "等待服务启动..."
        sleep 10
        
        # 检查服务状态
        if docker compose ps | grep -q "Up"; then
            log_info "服务启动成功"
        else
            log_error "服务启动失败"
            docker compose logs
            exit 1
        fi
    elif [[ -f "production-docker-compose.yml" ]]; then
        docker compose -f production-docker-compose.yml up -d
        
        # 等待服务启动
        log_info "等待服务启动..."
        sleep 10
        
        # 检查服务状态
        if docker compose -f production-docker-compose.yml ps | grep -q "Up"; then
            log_info "服务启动成功"
        else
            log_error "服务启动失败"
            docker compose -f production-docker-compose.yml logs
            exit 1
        fi
    else
        log_warn "Docker Compose文件不存在，无法启动服务"
    fi
}

# 验证恢复
verify_restore() {
    log_info "验证恢复结果..."
    
    # 检查数据库
    if [[ -f "$APP_DIR/db/custom.db" ]]; then
        log_info "数据库文件存在"
        ls -la "$APP_DIR/db/custom.db"
    else
        log_warn "数据库文件不存在"
    fi
    
    # 检查配置文件
    if [[ -f "$APP_DIR/.env.production" ]]; then
        log_info "环境变量文件存在"
    else
        log_warn "环境变量文件不存在"
    fi
    
    # 检查服务状态
    cd "$APP_DIR"
    if [[ -f "docker-compose.yml" ]]; then
        if docker compose ps | grep -q "Up"; then
            log_info "服务运行正常"
        else
            log_warn "服务状态异常"
        fi
    elif [[ -f "production-docker-compose.yml" ]]; then
        if docker compose -f production-docker-compose.yml ps | grep -q "Up"; then
            log_info "服务运行正常"
        else
            log_warn "服务状态异常"
        fi
    else
        log_warn "无法检查服务状态，Docker Compose文件不存在"
    fi
}

# 清理临时文件
cleanup_temp() {
    log_info "清理临时文件..."
    rm -rf "$TEMP_DIR"
    log_info "临时文件清理完成"
}

# 显示恢复结果
show_restore_result() {
    log_info "恢复完成！"
    echo ""
    echo "=================================="
    echo "恢复信息:"
    echo "=================================="
    echo "恢复时间: $(date)"
    echo "恢复备份: $TIMESTAMP"
    echo "应用目录: $APP_DIR"
    echo ""
    echo "服务状态:"
    cd "$APP_DIR"
    if [[ -f "docker-compose.yml" ]]; then
        docker compose ps
        echo ""
        echo "管理命令:"
        echo "  查看日志: docker compose logs -f"
        echo "  重启服务: docker compose restart"
        echo "  停止服务: docker compose down"
    elif [[ -f "production-docker-compose.yml" ]]; then
        docker compose -f production-docker-compose.yml ps
        echo ""
        echo "管理命令:"
        echo "  查看日志: docker compose -f production-docker-compose.yml logs -f"
        echo "  重启服务: docker compose -f production-docker-compose.yml restart"
        echo "  停止服务: docker compose -f production-docker-compose.yml down"
    else
        echo "无法显示服务状态，Docker Compose文件不存在"
    fi
    echo "=================================="
}

# 主函数
main() {
    echo "=================================="
    echo "智慧库存管理系统 - 恢复脚本"
    echo "=================================="
    echo ""
    
    check_params "$@"
    stop_services
    create_temp_dir
    backup_current_data
    restore_database
    restore_config
    restore_logs
    set_permissions
    start_services
    verify_restore
    cleanup_temp
    show_restore_result
}

# 运行主函数
main "$@"