#!/bin/bash

# 智慧库存管理系统 - 优化部署脚本
# 版本: 3.0
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

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

# 全局变量
BACKUP_DIR=""
ROLLBACK_AVAILABLE=false
DEPLOYMENT_START_TIME=$(date +%s)

# 错误处理和回滚机制
cleanup_on_error() {
    local exit_code=$?
    log_error "部署失败，退出码: $exit_code"
    
    if [ $exit_code -ne 0 ]; then
        log_error "开始回滚流程..."
        rollback_deployment
    fi
    
    exit $exit_code
}

# 设置错误陷阱
trap 'cleanup_on_error' ERR
trap 'cleanup_on_error' INT

# 部署前检查
pre_deploy_checks() {
    log_info "执行部署前检查..."
    
    # 检查环境变量文件
    if [ ! -f ".env.production" ]; then
        log_error ".env.production 文件不存在"
        log_info "请复制 .env.template 到 .env.production 并配置相应参数"
        exit 1
    fi
    
    # 加载环境变量
    source .env.production
    
    # 验证必要的环境变量
    local required_vars=("JWT_SECRET" "NEXTAUTH_URL" "NEXTAUTH_SECRET")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "环境变量 $var 未设置"
            exit 1
        fi
    done
    
    # 检查Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装"
        exit 1
    fi
    
    # 检查Docker Compose
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose 未安装"
        exit 1
    fi
    
    # 验证配置文件
    if ! docker compose -f docker-compose.unified.yml config &> /dev/null; then
        log_error "docker-compose.unified.yml 配置错误"
        exit 1
    fi
    
    # 检查端口可用性
    # 检查端口可用性 - 使用多种方法
    local port_in_use=false
    if command -v netstat &> /dev/null && netstat -tuln | grep -q ":3000 "; then
        port_in_use=true
    elif command -v ss &> /dev/null && ss -tuln | grep -q ":3000 "; then
        port_in_use=true
    elif command -v lsof &> /dev/null && lsof -i :3000 &> /dev/null; then
        port_in_use=true
    fi
    
    if [ "$port_in_use" = true ]; then
        log_warn "端口3000已被占用，将尝试停止现有服务"
        docker compose -f docker-compose.unified.yml down || true
        sleep 5
    fi
    
    log_info "部署前检查通过"
}

# 备份当前版本
backup_current_version() {
    log_info "备份当前版本..."
    
    BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # 备份数据库
    if [ -f "data/custom.db" ]; then
        cp "data/custom.db" "$BACKUP_DIR/"
        log_info "数据库已备份到: $BACKUP_DIR/custom.db"
    fi
    
    # 备份配置文件
    cp .env.production "$BACKUP_DIR/"
    cp docker-compose.unified.yml "$BACKUP_DIR/"
    
    # 备份日志
    if [ -d "logs" ]; then
        cp -r logs "$BACKUP_DIR/"
    fi
    
    # 备份当前运行的容器配置
    if docker compose ps &> /dev/null; then
        docker compose config > "$BACKUP_DIR/current-compose.yml"
    fi
    
    ROLLBACK_AVAILABLE=true
    log_info "备份完成: $BACKUP_DIR"
}

# 回滚部署
rollback_deployment() {
    if [ "$ROLLBACK_AVAILABLE" = false ]; then
        log_error "没有可用的备份进行回滚"
        exit 1
    fi
    
    log_info "开始回滚到备份版本: $BACKUP_DIR"
    
    # 停止当前服务
    docker compose -f docker-compose.unified.yml down || true
    
    # 恢复配置文件
    cp "$BACKUP_DIR/.env.production" ./
    cp "$BACKUP_DIR/docker-compose.unified.yml" ./docker-compose.unified.yml
    
    # 恢复数据库
    if [ -f "$BACKUP_DIR/custom.db" ]; then
        mkdir -p data
        cp "$BACKUP_DIR/custom.db" data/
    fi
    
    # 启动服务
    docker compose -f docker-compose.unified.yml up -d
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 30
    
    # 验证回滚
    if verify_deployment; then
        log_info "回滚成功完成"
    else
        log_error "回滚后服务验证失败"
        exit 1
    fi
}

# 构建和部署
build_and_deploy() {
    log_info "构建和部署应用..."
    
    # 停止现有服务
    log_info "停止现有服务..."
    docker compose -f docker-compose.unified.yml down || true
    
    # 清理旧的镜像和容器
    log_info "清理旧的资源..."
    docker system prune -f || true
    
    # 构建新镜像
    log_info "构建Docker镜像..."
    docker compose -f docker-compose.unified.yml build --no-cache --parallel
    
    # 启动服务
    log_info "启动服务..."
    docker compose -f docker-compose.unified.yml up -d
    
    log_info "应用部署完成"
}

# 部署后验证
verify_deployment() {
    log_info "执行部署后验证..."
    
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
    log_info "执行健康检查..."
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
    
    # 检查日志是否有错误
    local error_count=$(docker compose -f docker-compose.unified.yml logs app 2>&1 | grep -i error | wc -l)
    if [ $error_count -gt 0 ]; then
        log_warn "发现 $error_count 个错误日志，请检查"
        docker compose -f docker-compose.unified.yml logs app --tail=20
    fi
    
    log_info "部署后验证通过"
    return 0
}

# 性能测试
performance_test() {
    log_info "执行基础性能测试..."
    
    # 测试响应时间
    local response_time=$(curl -o /dev/null -s -w '%{time_total}' http://localhost:3000/api/health)
    log_info "API响应时间: ${response_time}s"
    
    if command -v bc &> /dev/null && (( $(echo "$response_time > 2.0" | bc -l) )); then
        log_warn "响应时间较慢，建议优化"
    fi
    
    # 测试内存使用
    local memory_usage=$(docker stats --no-stream --format "{{.MemUsage}}" inventory-system_app-1)
    log_info "内存使用: $memory_usage"
    
    log_info "性能测试完成"
}

# 生成部署报告
generate_deployment_report() {
    local deployment_end_time=$(date +%s)
    local deployment_duration=$((deployment_end_time - DEPLOYMENT_START_TIME))
    local duration_minutes=$((deployment_duration / 60))
    local duration_seconds=$((deployment_duration % 60))
    
    local report_file="backups/deployment-report-$(date +%Y%m%d_%H%M%S).txt"
    
    cat > "$report_file" <<EOF
智慧库存管理系统 - 部署报告
=====================================
部署时间: $(date)
部署持续时间: ${duration_minutes}分${duration_seconds}秒
备份目录: $BACKUP_DIR
部署状态: 成功

系统信息:
- 操作系统: $(uname -a)
- Docker版本: $(docker --version)
- Docker Compose版本: $(docker compose version)

服务状态:
$(docker compose -f docker-compose.unified.yml ps)

性能指标:
- API响应时间: $(curl -o /dev/null -s -w '%{time_total}' http://localhost:3000/api/health)s
- 内存使用: $(docker stats --no-stream --format "{{.MemUsage}}" inventory-system_app-1)

访问信息:
- 应用地址: http://localhost:3000
- 健康检查: http://localhost:3000/api/health
- 管理员账号: 79122706664

管理命令:
- 查看日志: docker compose -f docker-compose.unified.yml logs -f
- 停止服务: docker compose -f docker-compose.unified.yml down
- 重启服务: docker compose -f docker-compose.unified.yml restart
EOF

    log_info "部署报告已生成: $report_file"
}

# 显示部署信息
show_deployment_info() {
    log_info "部署完成！"
    echo ""
    echo "=================================="
    echo "部署信息:"
    echo "=================================="
    echo "应用地址: http://localhost:3000"
    echo "健康检查: http://localhost:3000/api/health"
    echo "备份目录: $BACKUP_DIR"
    echo ""
    echo "管理员账号:"
    echo "手机号: 79122706664"
    echo "密码: PRAISEJEANS.888"
    echo ""
    echo "管理命令:"
    echo "查看日志: docker compose -f docker-compose.unified.yml logs -f"
    echo "停止服务: docker compose -f docker-compose.unified.yml down"
    echo "重启服务: docker compose -f docker-compose.unified.yml restart"
    echo "回滚部署: ./scripts/rollback.sh $BACKUP_DIR"
    echo "=================================="
}

# 主函数
main() {
    echo "=================================="
    echo "智慧库存系统 - 优化部署脚本 v3.0"
    echo "=================================="
    echo ""
    
    # 检查参数
    local deploy_mode=${1:-full}
    
    case $deploy_mode in
        "full")
            pre_deploy_checks
            backup_current_version
            build_and_deploy
            verify_deployment
            performance_test
            generate_deployment_report
            show_deployment_info
            ;;
        "verify")
            verify_deployment
            ;;
        "backup")
            backup_current_version
            ;;
        "help"|"-h"|"--help")
            echo "用法: $0 [模式]"
            echo ""
            echo "模式:"
            echo "  full    - 完整部署 (默认)"
            echo "  verify  - 仅验证部署"
            echo "  backup  - 仅备份当前版本"
            echo "  help    - 显示此帮助信息"
            ;;
        *)
            log_error "未知模式: $deploy_mode"
            echo "使用 '$0 help' 查看可用选项"
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"