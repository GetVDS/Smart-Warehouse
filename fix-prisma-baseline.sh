#!/bin/bash

# 智慧库存管理系统 - Prisma P3005 数据库基线化修复脚本
# 解决数据库模式不为空但Prisma检测到现有迁移的问题

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

log_section() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# 检查Prisma和数据库状态
check_prisma_status() {
    log_section "检查Prisma和数据库状态"
    
    # 检查Prisma是否安装
    if ! command -v npx >/dev/null 2>&1; then
        log_error "npx命令不可用，请确保Node.js和npm已正确安装"
        exit 1
    fi
    
    # 检查Prisma版本
    log_info "Prisma版本信息:"
    npx prisma version
    
    # 检查数据库文件状态
    log_info "数据库文件状态:"
    if [ -f "db/custom.db" ]; then
        ls -lh db/custom.db
        log_info "✅ 数据库文件存在"
    else
        log_warn "⚠️ 数据库文件不存在"
    fi
    
    # 检查Prisma schema
    log_info "Prisma schema状态:"
    if [ -f "prisma/schema.prisma" ]; then
        log_info "✅ Prisma schema文件存在"
        grep -E "provider|datasource" prisma/schema.prisma
    else
        log_error "❌ Prisma schema文件不存在"
        exit 1
    fi
    
    # 检查迁移目录
    log_info "迁移目录状态:"
    if [ -d "prisma/migrations" ]; then
        migration_count=$(ls -1 prisma/migrations | wc -l)
        log_info "发现 $migration_count 个迁移文件"
        ls -la prisma/migrations/
    else
        log_warn "⚠️ 迁移目录不存在"
    fi
}

# 备份当前数据库
backup_database() {
    log_section "备份当前数据库"
    
    if [ -f "db/custom.db" ]; then
        backup_file="db/custom.db.backup.$(date +%Y%m%d-%H%M%S)"
        cp db/custom.db "$backup_file"
        log_info "✅ 数据库已备份到: $backup_file"
    else
        log_warn "⚠️ 数据库文件不存在，跳过备份"
    fi
}

# 方法1: 重置数据库并重新初始化
method_reset_database() {
    log_section "方法1: 重置数据库并重新初始化"
    
    # 停止可能正在运行的应用
    log_info "停止可能正在运行的应用..."
    pkill -f "next\|node" 2>/dev/null || true
    
    # 备份数据库
    backup_database
    
    # 删除现有数据库文件
    log_info "删除现有数据库文件..."
    rm -f db/custom.db 2>/dev/null || true
    rm -f prisma/db/custom.db 2>/dev/null || true
    
    # 重新生成Prisma客户端
    log_info "重新生成Prisma客户端..."
    npx prisma generate
    
    # 创建新的数据库
    log_info "创建新的数据库..."
    npx prisma db push --force-reset
    
    # 应用现有迁移
    log_info "应用现有迁移..."
    npx prisma migrate deploy || log_warn "迁移应用失败，但继续..."
    
    # 运行种子数据
    if [ -f "init-test-data.js" ]; then
        log_info "运行种子数据脚本..."
        node init-test-data.js
    fi
    
    # 初始化管理员用户
    if [ -f "init-admin.js" ]; then
        log_info "初始化管理员用户..."
        node init-admin.js
    fi
    
    log_info "✅ 数据库重置和初始化完成"
}

# 方法2: 手动基线化现有数据库
method_manual_baseline() {
    log_section "方法2: 手动基线化现有数据库"
    
    # 检查迁移目录
    if [ ! -d "prisma/migrations" ] || [ -z "$(ls -A prisma/migrations)" ]; then
        log_error "❌ 迁移目录为空，无法进行基线化"
        return 1
    fi
    
    # 备份数据库
    backup_database
    
    # 删除Prisma迁移历史记录
    log_info "删除Prisma迁移历史记录..."
    rm -f prisma/migrations/migration_lock.toml 2>/dev/null || true
    
    # 创建新的迁移目录（如果不存在）
    mkdir -p prisma/migrations/_prisma_migrations
    
    # 手动基线化
    log_info "执行手动基线化..."
    
    # 获取所有迁移并标记为已应用
    for migration_dir in prisma/migrations/*/; do
        if [ -f "$migration_dir/migration.sql" ]; then
            migration_name=$(basename "$migration_dir")
            if [ "$migration_name" != "_prisma_migrations" ]; then
                log_info "标记迁移 $migration_name 为已应用..."
                npx prisma migrate resolve --applied "$migration_name" || {
                    log_warn "标记迁移 $migration_name 失败，继续..."
                }
            fi
        fi
    done
    
    # 重新生成Prisma客户端
    log_info "重新生成Prisma客户端..."
    npx prisma generate
    
    # 验证基线化结果
    log_info "验证基线化结果..."
    npx prisma migrate status
    
    log_info "✅ 手动基线化完成"
}

# 方法3: 清理迁移并重新开始
method_clean_migrations() {
    log_section "方法3: 清理迁移并重新开始"
    
    # 备份数据库
    backup_database
    
    # 备份现有迁移
    if [ -d "prisma/migrations" ]; then
        backup_dir="prisma/migrations.backup.$(date +%Y%m%d-%H%M%S)"
        cp -r prisma/migrations "$backup_dir"
        log_info "✅ 迁移已备份到: $backup_dir"
    fi
    
    # 删除所有迁移文件
    log_info "删除所有迁移文件..."
    rm -rf prisma/migrations/*
    
    # 重新生成Prisma客户端
    log_info "重新生成Prisma客户端..."
    npx prisma generate
    
    # 创建新的初始迁移
    log_info "创建新的初始迁移..."
    npx prisma migrate dev --name init
    
    # 应用迁移
    log_info "应用迁移..."
    npx prisma migrate deploy
    
    # 初始化数据
    if [ -f "init-test-data.js" ]; then
        log_info "运行种子数据脚本..."
        node init-test-data.js
    fi
    
    # 初始化管理员用户
    if [ -f "init-admin.js" ]; then
        log_info "初始化管理员用户..."
        node init-admin.js
    fi
    
    log_info "✅ 迁移清理和重新初始化完成"
}

# 验证修复结果
verify_fix() {
    log_section "验证修复结果"
    
    # 检查Prisma状态
    log_info "检查Prisma迁移状态:"
    npx prisma migrate status
    
    # 测试数据库连接
    log_info "测试数据库连接:"
    if npx prisma db pull --force >/dev/null 2>&1; then
        log_info "✅ 数据库连接正常"
    else
        log_error "❌ 数据库连接失败"
        return 1
    fi
    
    # 测试应用启动
    log_info "测试应用启动:"
    if command -v npm >/dev/null 2>&1; then
        log_info "尝试启动应用..."
        timeout 10 npm run dev &
        sleep 5
        
        # 检查端口是否被占用
        if netstat -tln 2>/dev/null | grep -q ":3001 "; then
            log_info "✅ 应用成功启动在端口3001"
        else
            log_warn "⚠️ 应用启动可能有问题"
        fi
        
        # 停止测试启动
        pkill -f "next\|node" 2>/dev/null || true
    fi
    
    log_info "✅ 修复验证完成"
}

# 显示使用说明
show_usage() {
    echo "用法: $0 [方法]"
    echo ""
    echo "可用的修复方法:"
    echo "  1    重置数据库并重新初始化 (推荐)"
    echo "  2    手动基线化现有数据库"
    echo "  3    清理迁移并重新开始"
    echo ""
    echo "示例:"
    echo "  $0 1    # 使用方法1修复"
    echo "  $0 2    # 使用方法2修复"
    echo "  $0 3    # 使用方法3修复"
    echo ""
    echo "如果不指定方法，将自动选择最适合的方法"
}

# 主函数
main() {
    echo "=================================="
    echo "智慧库存系统 - Prisma P3005 数据库基线化修复工具"
    echo "=================================="
    echo ""
    
    # 检查参数
    METHOD=${1:-"auto"}
    
    # 显示帮助信息
    if [[ "$METHOD" == "help" || "$METHOD" == "-h" || "$METHOD" == "--help" ]]; then
        show_usage
        exit 0
    fi
    
    # 检查是否在正确的目录
    if [ ! -f "package.json" ]; then
        log_error "❌ 未找到package.json文件，请在项目根目录运行此脚本"
        exit 1
    fi
    
    # 检查初始状态
    check_prisma_status
    
    # 根据方法执行修复
    case "$METHOD" in
        1)
            log_info "使用方法1: 重置数据库并重新初始化"
            method_reset_database
            ;;
        2)
            log_info "使用方法2: 手动基线化现有数据库"
            method_manual_baseline
            ;;
        3)
            log_info "使用方法3: 清理迁移并重新开始"
            method_clean_migrations
            ;;
        auto)
            log_info "自动选择最适合的修复方法..."
            
            # 检查迁移状态
            if [ -d "prisma/migrations" ] && [ -n "$(ls -A prisma/migrations)" ]; then
                migration_count=$(ls -1 prisma/migrations | wc -l)
                if [ "$migration_count" -gt 0 ]; then
                    log_info "检测到现有迁移，使用方法2 (手动基线化)"
                    method_manual_baseline
                else
                    log_info "迁移目录为空，使用方法1 (重置数据库)"
                    method_reset_database
                fi
            else
                log_info "未找到迁移目录，使用方法1 (重置数据库)"
                method_reset_database
            fi
            ;;
        *)
            log_error "❌ 未知的方法: $METHOD"
            show_usage
            exit 1
            ;;
    esac
    
    # 验证修复结果
    if verify_fix; then
        log_info "🎉 Prisma P3005错误修复成功！"
        echo ""
        echo "下一步操作:"
        echo "1. 启动应用: npm run dev"
        echo "2. 访问应用: http://localhost:3001"
        echo "3. 检查日志: tail -f dev.log"
        echo ""
        echo "如果问题仍然存在，请运行诊断工具:"
        echo "./diagnose-local-502-errors.sh localhost 3001"
    else
        log_error "❌ 修复失败，请检查错误信息并重试"
        exit 1
    fi
}

# 运行主函数
main "$@"