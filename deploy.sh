#!/bin/bash

# 智慧库存系统部署脚本
# 版本: 2.0
# 更新日期: 2025-12-07

set -e

echo "🚀 开始部署智慧库存系统..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查必要的环境
check_environment() {
    echo -e "${BLUE}📋 检查部署环境...${NC}"
    
    # 检查Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js 未安装，请先安装 Node.js 18+${NC}"
        exit 1
    fi
    
    # 检查npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm 未安装${NC}"
        exit 1
    fi
    
    # 检查Docker (可选)
    if command -v docker &> /dev/null; then
        echo -e "${GREEN}✅ Docker 已安装${NC}"
        DOCKER_AVAILABLE=true
    else
        echo -e "${YELLOW}⚠️  Docker 未安装，将使用本地部署模式${NC}"
        DOCKER_AVAILABLE=false
    fi
    
    echo -e "${GREEN}✅ 环境检查完成${NC}"
}

# 安装依赖
install_dependencies() {
    echo -e "${BLUE}📦 安装项目依赖...${NC}"
    
    # 清理可能存在的node_modules和package-lock.json
    if [ -d "node_modules" ]; then
        echo -e "${YELLOW}🧹 清理现有依赖...${NC}"
        rm -rf node_modules
    fi
    
    # 安装依赖
    npm install
    
    echo -e "${GREEN}✅ 依赖安装完成${NC}"
}

# 数据库设置
setup_database() {
    echo -e "${BLUE}🗄️  设置数据库...${NC}"
    
    # 检查Prisma是否安装
    if ! command -v npx &> /dev/null; then
        echo -e "${RED}❌ npx 未安装${NC}"
        exit 1
    fi
    
    # 生成Prisma客户端
    npx prisma generate
    
    # 运行数据库迁移
    npx prisma migrate deploy
    
    # 初始化管理员用户
    node init-admin.js
    
    echo -e "${GREEN}✅ 数据库设置完成${NC}"
}

# 构建项目
build_project() {
    echo -e "${BLUE}🔨 构建项目...${NC}"
    
    # 运行类型检查
    npm run type-check 2>/dev/null || echo -e "${YELLOW}⚠️  类型检查跳过${NC}"
    
    # 构建生产版本
    npm run build
    
    echo -e "${GREEN}✅ 项目构建完成${NC}"
}

# 本地部署
deploy_local() {
    echo -e "${BLUE}🏠 本地部署...${NC}"
    
    # 设置环境变量
    export NODE_ENV=production
    export PORT=3000
    export JWT_SECRET="$(openssl rand -base64 32)"
    
    # 启动应用
    echo -e "${GREEN}🚀 启动应用在 http://localhost:3000${NC}"
    npm start
}

# Docker部署
deploy_docker() {
    echo -e "${BLUE}🐳 Docker部署...${NC}"
    
    # 检查docker-compose
    if [ -f "docker-compose.yml" ]; then
        echo -e "${GREEN}✅ 找到 docker-compose.yml${NC}"
        
        # 停止现有容器
        docker-compose down 2>/dev/null || true
        
        # 构建并启动
        docker-compose up --build -d
        
        echo -e "${GREEN}✅ Docker部署完成${NC}"
        echo -e "${GREEN}🚀 应用运行在 http://localhost:3000${NC}"
    else
        echo -e "${RED}❌ 未找到 docker-compose.yml${NC}"
        exit 1
    fi
}

# 健康检查
health_check() {
    echo -e "${BLUE}🏥 执行健康检查...${NC}"
    
    # 等待应用启动
    sleep 10
    
    # 检查本地端口
    if command -v curl &> /dev/null; then
        if curl -f http://localhost:3000/api/health &>/dev/null; then
            echo -e "${GREEN}✅ 应用健康检查通过${NC}"
        else
            echo -e "${RED}❌ 应用健康检查失败${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠️  curl 未安装，跳过健康检查${NC}"
    fi
}

# 显示部署信息
show_deployment_info() {
    echo -e "${GREEN}"
    echo "🎉 部署完成！"
    echo ""
    echo "📋 部署信息:"
    echo "   - 应用地址: http://localhost:3000"
    echo "   - 管理员账号: 79122706664"
    echo "   - 管理员密码: PRAISEJEANS.888"
    echo ""
    echo "🔧 管理命令:"
    echo "   - 查看日志: docker-compose logs -f"
    echo "   - 停止服务: docker-compose down"
    echo "   - 重启服务: docker-compose restart"
    echo ""
    echo "📚 更多信息请查看:"
    echo "   - DEPLOYMENT_GUIDE.md"
    echo "   - SECURITY_FIXES_REPORT.md"
    echo "   - PERFORMANCE_OPTIMIZATION_REPORT.md"
    echo -e "${NC}"
}

# 主函数
main() {
    echo -e "${BLUE}"
    echo "=================================================="
    echo "    智慧库存系统自动部署脚本 v2.0"
    echo "=================================================="
    echo -e "${NC}"
    
    # 检查参数
    DEPLOYMENT_TYPE=${1:-local}
    
    case $DEPLOYMENT_TYPE in
        "local")
            check_environment
            install_dependencies
            setup_database
            build_project
            deploy_local
            health_check
            show_deployment_info
            ;;
        "docker")
            check_environment
            if [ "$DOCKER_AVAILABLE" = false ]; then
                echo -e "${RED}❌ Docker 不可用，无法进行Docker部署${NC}"
                exit 1
            fi
            setup_database
            deploy_docker
            health_check
            show_deployment_info
            ;;
        "help"|"-h"|"--help")
            echo "用法: $0 [部署类型]"
            echo ""
            echo "部署类型:"
            echo "  local   - 本地部署 (默认)"
            echo "  docker  - Docker部署"
            echo "  help    - 显示此帮助信息"
            ;;
        *)
            echo -e "${RED}❌ 未知的部署类型: $DEPLOYMENT_TYPE${NC}"
            echo "使用 '$0 help' 查看可用选项"
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"