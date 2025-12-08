#!/bin/bash

# 智慧库存管理系统 - 回滚脚本
# 版本: 1.0
# 更新日期: 2025-12-08

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

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# 显示帮助信息
show_help() {
    echo "用法: $0 <备份目录>"
    echo ""
    echo "参数:"
    echo "  备份目录    要回滚到的备份目录路径"
    echo ""
    echo "示例:"
    echo "  $0 backups/20251208_143022"
    echo ""
    echo "可用备份:"
    list_backups
}

# 列出可用备份
list_backups() {
    if [ -d "backups" ]; then
        ls -la backups/ | grep "^d" | awk '{print $9}' | grep -E "^[0-9]{8}_[0-9]{6}$" | sort -r
    else
        echo "没有找到备份目录"
    fi
}

# 验证备份目录
validate_backup() {
    local backup_dir=$1
    
    if [ -z "$backup_dir" ]; then
        log_error "请提供备份目录"
        show_help
        exit 1
    fi
    
    if [ ! -d "$backup_dir" ]; then
        log_error "备份目录不存在: $backup_dir"
        exit 1
    fi
    
    # 检查必要文件
    local required_files=(".env.production" "docker-compose.unified.yml")
    for file in "${required_files[@]}"; do
        if [ ! -f "$backup_dir/$file" ]; then
            log_error "备份目录缺少必要文件: $file"
            exit 1
        fi
    done
    
    log_info "备份目录验证通过: $backup_dir"
}

# 停止当前服务
stop_current_services() {
    log_info "停止当前服务..."
    
    if docker compose -f docker-compose.unified.yml ps &> /dev/null; then
        docker compose -f docker-compose.unified.yml down
        log_info "当前服务已停止"
    else
        log_info "没有运行中的服务"
    fi
}

# 备份当前状态（以防回滚失败）
backup_current_state() {
    log_info "备份当前状态..."
    
    local temp_backup="backups/temp-rollback-$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$temp_backup"
    
    # 备份当前配置
    if [ -f ".env.production" ]; then
        cp .env.production "$temp_backup/"
    fi
    
    if [ -f "docker-compose.unified.yml" ]; then
        cp docker-compose.unified.yml "$temp_backup/"
    fi
    
    # 备份数据库
    if [ -f "data/custom.db" ]; then
        mkdir -p "$temp_backup/data"
        cp data/custom.db "$temp_backup/data/"
    fi
    
    log_info "当前状态已备份到: $temp_backup"
}

# 恢复配置文件
restore_config() {
    local backup_dir=$1
    
    log_info "恢复配置文件..."
    
    # 恢复环境变量
    cp "$backup_dir/.env.production" ./
    
    # 恢复Docker Compose配置
    cp "$backup_dir/docker-compose.unified.yml" ./docker-compose.unified.yml
    
    log_info "配置文件恢复完成"
}

# 恢复数据库
restore_database() {
    local backup_dir=$1
    
    if [ -f "$backup_dir/custom.db" ]; then
        log_info "恢复数据库..."
        
        # 创建数据目录
        mkdir -p data
        
        # 备份当前数据库
        if [ -f "data/custom.db" ]; then
            mv data/custom.db "data/custom.db.backup.$(date +%Y%m%d_%H%M%S)"
        fi
        
        # 恢复数据库
        cp "$backup_dir/custom.db" data/
        
        log_info "数据库恢复完成"
    else
        log_warn "备份目录中没有数据库文件，跳过数据库恢复"
    fi
}

# 启动服务
start_services() {
    log_info "启动服务..."
    
    # 启动服务
    docker compose -f docker-compose.unified.yml up -d
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 30
    
    log_info "服务启动完成"
}

# 验证回滚
verify_rollback() {
    log_info "验证回滚结果..."
    
    # 检查服务状态
    local max_attempts=12
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker compose -f docker-compose.unified.yml ps | grep -q "Up"; then
            log_info "服务状态检查通过"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            log_error "服务未正常启动"
            return 1
        fi
        
        log_info "等待服务启动... (尝试 $attempt/$max_attempts)"
        sleep 10
        ((attempt++))
    done
    
    # 健康检查
    local health_max_attempts=10
    local health_attempt=1
    
    while [ $health_attempt -le $health_max_attempts ]; do
        if curl -f http://localhost:3000/api/health &>/dev/null; then
            log_info "健康检查通过"
            break
        fi
        
        if [ $health_attempt -eq $health_max_attempts ]; then
            log_error "健康检查失败"
            return 1
        fi
        
        log_info "等待健康检查... (尝试 $health_attempt/$health_max_attempts)"
        sleep 10
        ((health_attempt++))
    done
    
    log_info "回滚验证通过"
    return 0
}

# 生成回滚报告
generate_rollback_report() {
    local backup_dir=$1
    local report_file="backups/rollback-report-$(date +%Y%m%d_%H%M%S).txt"
    
    cat > "$report_file" <<EOF
智慧库存管理系统 - 回滚报告
=====================================
回滚时间: $(date)
源备份目录: $backup_dir
回滚状态: 成功

系统信息:
- 操作系统: $(uname -a)
- Docker版本: $(docker --version)
- Docker Compose版本: $(docker compose version)

服务状态:
$(docker compose -f docker-compose.unified.yml ps)

访问信息:
- 应用地址: http://localhost:3000
- 健康检查: http://localhost:3000/api/health
- 管理员账号: 79122706664

管理命令:
- 查看日志: docker compose -f docker-compose.unified.yml logs -f
- 停止服务: docker compose -f docker-compose.unified.yml down
- 重启服务: docker compose -f docker-compose.unified.yml restart
EOF

    log_info "回滚报告已生成: $report_file"
}

# 显示回滚信息
show_rollback_info() {
    local backup_dir=$1
    
    log_info "回滚完成！"
    echo ""
    echo "=================================="
    echo "回滚信息:"
    echo "=================================="
    echo "源备份目录: $backup_dir"
    echo "应用地址: http://localhost:3000"
    echo "健康检查: http://localhost:3000/api/health"
    echo ""
    echo "管理员账号:"
    echo "手机号: 79122706664"
    echo "密码: PRAISEJEANS.888"
    echo ""
    echo "管理命令:"
    echo "查看日志: docker compose -f docker-compose.unified.yml logs -f"
    echo "停止服务: docker compose -f docker-compose.unified.yml down"
    echo "重启服务: docker compose -f docker-compose.unified.yml restart"
    echo "=================================="
}

# 主函数
main() {
    echo "=================================="
    echo "智慧库存系统 - 回滚脚本 v1.0"
    echo "=================================="
    echo ""
    
    # 检查参数
    local backup_dir=$1
    
    if [ -z "$backup_dir" ]; then
        log_error "请提供备份目录"
        show_help
        exit 1
    fi
    
    if [ "$backup_dir" = "help" ] || [ "$backup_dir" = "-h" ] || [ "$backup_dir" = "--help" ]; then
        show_help
        exit 0
    fi
    
    # 执行回滚流程
    validate_backup "$backup_dir"
    backup_current_state
    stop_current_services
    restore_config "$backup_dir"
    restore_database "$backup_dir"
    start_services
    
    # 验证回滚
    if verify_rollback; then
        generate_rollback_report "$backup_dir"
        show_rollback_info "$backup_dir"
    else
        log_error "回滚验证失败，请检查日志"
        exit 1
    fi
}

# 执行主函数
main "$@"