#!/bin/bash

# 智慧库存管理系统 - 数据库初始化脚本
# 版本: 2.0
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

# 加载环境变量
load_environment() {
    log_info "加载环境变量..."
    
    # 尝试加载不同环境变量文件
    if [ -f ".env.production" ]; then
        source .env.production
        log_info "已加载生产环境变量"
    elif [ -f ".env.development" ]; then
        source .env.development
        log_info "已加载开发环境变量"
    elif [ -f ".env" ]; then
        source .env
        log_info "已加载默认环境变量"
    else
        log_warn "未找到环境变量文件，使用默认值"
    fi
    
    # 设置默认值
    export DATABASE_URL="${DATABASE_URL:-file:./data/custom.db}"
    export DB_PATH="${DB_PATH:-./data}"
    export NODE_ENV="${NODE_ENV:-development}"
    export JWT_SECRET="${JWT_SECRET:-default-secret-change-in-production}"
}

# 检查和创建数据库目录
ensure_db_directory() {
    log_info "检查和创建数据库目录..."
    
    local db_path="${DB_PATH:-./data}"
    
    if [ ! -d "$db_path" ]; then
        log_info "创建数据库目录: $db_path"
        mkdir -p "$db_path"
    fi
    
    # 创建备份目录
    local backup_path="${DB_BACKUP_PATH:-$db_path/backups}"
    if [ ! -d "$backup_path" ]; then
        log_info "创建备份目录: $backup_path"
        mkdir -p "$backup_path"
    fi
    
    # 确保目录权限正确
    if [ "$NODE_ENV" = "production" ]; then
        # 在容器中运行时，确保正确的用户权限
        if [ -n "$PUID" ] && [ -n "$PGID" ]; then
            chown -R $PUID:$PGID "$db_path"
            chown -R $PUID:$PGID "$backup_path"
        fi
        chmod 755 "$db_path"
        chmod 755 "$backup_path"
    fi
    
    log_info "数据库目录准备完成"
}

# 检查依赖
check_dependencies() {
    log_info "检查系统依赖..."
    
    # 检查Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装"
        exit 1
    fi
    
    # 检查npm/npx
    if ! command -v npx &> /dev/null; then
        log_error "npx 不可用"
        exit 1
    fi
    
    # 检查Prisma
    if [ ! -d "prisma" ]; then
        log_error "Prisma 目录不存在"
        exit 1
    fi
    
    if [ ! -f "prisma/schema.prisma" ]; then
        log_error "Prisma schema 文件不存在"
        exit 1
    fi
    
    log_info "依赖检查通过"
}

# 验证Prisma配置
validate_prisma_config() {
    log_info "验证Prisma配置..."
    
    # 检查schema文件语法
    if ! npx prisma validate &> /dev/null; then
        log_error "Prisma schema 验证失败"
        exit 1
    fi
    
    log_info "Prisma配置验证通过"
}

# 生成Prisma客户端
generate_prisma_client() {
    log_info "生成Prisma客户端..."
    
    npx prisma generate
    
    if [ $? -eq 0 ]; then
        log_info "Prisma客户端生成成功"
    else
        log_error "Prisma客户端生成失败"
        exit 1
    fi
}

# 检查数据库连接
check_database_connection() {
    log_info "检查数据库连接..."
    
    # 尝试连接数据库
    if npx prisma db pull --force &> /dev/null; then
        log_info "数据库连接正常"
    else
        log_warn "数据库连接失败，可能需要初始化"
    fi
}

# 运行数据库迁移
run_migrations() {
    log_info "运行数据库迁移..."
    
    # 检查是否有待执行的迁移
    local migration_status=$(npx prisma migrate status 2>/dev/null || echo "pending")
    
    if [[ $migration_status == *"pending"* ]] || [[ $migration_status == *"drift"* ]]; then
        log_info "发现待执行的迁移"
        
        if [ "$NODE_ENV" = "production" ]; then
            npx prisma migrate deploy
        else
            npx prisma migrate dev --name init_$(date +%Y%m%d_%H%M%S)
        fi
        
        if [ $? -eq 0 ]; then
            log_info "数据库迁移完成"
        else
            log_error "数据库迁移失败"
            exit 1
        fi
    else
        log_info "数据库已是最新状态"
    fi
}

# 初始化管理员用户
init_admin_user() {
    log_info "初始化管理员用户..."
    
    # 检查管理员用户是否存在
    local admin_check=$(node -e "
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        
        async function checkAdmin() {
            try {
                const admin = await prisma.user.findUnique({
                    where: { phone: '79122706664' }
                });
                console.log(admin ? 'exists' : 'not_exists');
                await prisma.\$disconnect();
            } catch (error) {
                console.log('error');
                await prisma.\$disconnect();
            }
        }
        
        checkAdmin();
    " 2>/dev/null)
    
    if [ "$admin_check" = "not_exists" ]; then
        log_info "创建管理员用户..."
        
        # 使用bcryptjs创建密码哈希
        local admin_creation=$(node -e "
            const bcrypt = require('bcryptjs');
            const { PrismaClient } = require('@prisma/client');
            const prisma = new PrismaClient();
            
            async function createAdmin() {
                try {
                    const hashedPassword = await bcrypt.hash('PRAISEJEANS.888', 10);
                    
                    await prisma.user.create({
                        data: {
                            id: 'admin-user-001',
                            phone: '79122706664',
                            password: hashedPassword,
                            name: 'PRAISEJEANS管理员',
                            updatedAt: new Date()
                        }
                    });
                    
                    console.log('success');
                    await prisma.\$disconnect();
                } catch (error) {
                    console.log('error:', error.message);
                    await prisma.\$disconnect();
                }
            }
            
            createAdmin();
        " 2>/dev/null)
        
        if [ "$admin_creation" = "success" ]; then
            log_info "管理员用户创建成功"
        else
            log_error "管理员用户创建失败"
            exit 1
        fi
    elif [ "$admin_check" = "exists" ]; then
        log_info "管理员用户已存在"
    else
        log_error "检查管理员用户时出错"
        exit 1
    fi
}

# 验证数据库完整性
verify_database_integrity() {
    log_info "验证数据库完整性..."
    
    # 检查必要表是否存在
    local tables_check=$(node -e "
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        
        async function checkTables() {
            try {
                const requiredTables = ['User', 'Customer', 'Product', 'Order'];
                const results = [];
                
                for (const table of requiredTables) {
                    try {
                        await prisma.\$queryRaw\`SELECT COUNT(*) FROM \${prisma._runtimeTableName(table)}\`;
                        results.push(table);
                    } catch (error) {
                        // 表不存在
                    }
                }
                
                console.log(results.join(','));
                await prisma.\$disconnect();
            } catch (error) {
                console.log('error:', error.message);
                await prisma.\$disconnect();
            }
        }
        
        checkTables();
    " 2>/dev/null)
    
    if [ "$tables_check" = "error" ]; then
        log_error "数据库完整性检查失败"
        exit 1
    fi
    
    local required_tables="User,Customer,Product,Order"
    if [[ "$required_tables" == *"$tables_check"* ]]; then
        log_info "数据库完整性检查通过"
    else
        log_warn "部分表可能缺失，但继续初始化"
    fi
}

# 创建数据库备份
create_initial_backup() {
    log_info "创建初始备份..."
    
    local backup_path="${DB_BACKUP_PATH:-$DB_PATH/backups}"
    local backup_file="$backup_path/initial_backup_$(date +%Y%m%d_%H%M%S).db"
    
    if [ -f "${DB_PATH}/custom.db" ]; then
        cp "${DB_PATH}/custom.db" "$backup_file"
        log_info "初始备份已创建: $backup_file"
    else
        log_warn "数据库文件不存在，跳过备份"
    fi
}

# 显示初始化结果
show_init_result() {
    log_info "数据库初始化完成！"
    echo ""
    echo "=================================="
    echo "初始化结果:"
    echo "=================================="
    echo "数据库路径: ${DATABASE_URL}"
    echo "环境: ${NODE_ENV}"
    echo "管理员账号: 79122706664"
    echo "管理员密码: PRAISEJEANS.888"
    echo ""
    echo "下一步操作:"
    echo "1. 启动应用: npm start"
    echo "2. 访问应用: http://localhost:3000"
    echo "3. 登录管理后台"
    echo "=================================="
}

# 主函数
main() {
    echo "=================================="
    echo "智慧库存系统 - 数据库初始化脚本 v2.0"
    echo "=================================="
    echo ""
    
    # 检查参数
    local init_mode=${1:-full}
    
    case $init_mode in
        "full")
            load_environment
            ensure_db_directory
            check_dependencies
            validate_prisma_config
            generate_prisma_client
            run_migrations
            init_admin_user
            verify_database_integrity
            create_initial_backup
            show_init_result
            ;;
        "migrate")
            load_environment
            ensure_db_directory
            check_dependencies
            validate_prisma_config
            generate_prisma_client
            run_migrations
            ;;
        "admin")
            load_environment
            ensure_db_directory
            check_dependencies
            init_admin_user
            ;;
        "verify")
            load_environment
            check_database_connection
            verify_database_integrity
            ;;
        "help"|"-h"|"--help")
            echo "用法: $0 [模式]"
            echo ""
            echo "模式:"
            echo "  full    - 完整初始化 (默认)"
            echo "  migrate - 仅运行迁移"
            echo "  admin   - 仅初始化管理员用户"
            echo "  verify  - 仅验证数据库状态"
            echo "  help    - 显示此帮助信息"
            ;;
        *)
            log_error "未知模式: $init_mode"
            echo "使用 '$0 help' 查看可用选项"
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"