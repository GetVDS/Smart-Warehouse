#!/bin/bash

# 智慧库存管理系统 - 本地502 Bad Gateway诊断工具
# 专注于本地Next.js应用的深度分析

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
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
    echo -e "${PURPLE}=== $1 ===${NC}"
}

log_subsection() {
    echo -e "${CYAN}--- $1 ---${NC}"
}

# 创建报告目录
REPORT_DIR="/tmp/local-502-diagnosis-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$REPORT_DIR"

# 获取域名参数
DOMAIN=${1:-"localhost"}
PORT=${2:-"3001"}
log_info "开始诊断本地应用: http://$DOMAIN:$PORT"
log_info "诊断报告将保存到: $REPORT_DIR"

# 1. 检查本地应用运行状态
check_local_application() {
    log_section "1. 检查本地应用运行状态"
    
    # 检查端口占用
    log_subsection "端口占用检查"
    {
        echo "=== 端口 $PORT 占用情况 ==="
        netstat -tlnp 2>/dev/null | grep ":$PORT " || ss -tlnp 2>/dev/null | grep ":$PORT " || echo "端口 $PORT 未被占用"
        echo ""
        echo "=== 相关进程检查 ==="
        ps aux | grep -E "(node|next|npm)" | grep -v grep || echo "未找到相关进程"
    } > "$REPORT_DIR/port-status.txt"
    cat "$REPORT_DIR/port-status.txt"
    
    # 检查应用响应
    log_subsection "应用响应测试"
    {
        echo "=== 应用健康检查 ==="
        curl -f -w "响应时间: %{time_total}s, HTTP状态: %{http_code}\n" \
            http://$DOMAIN:$PORT/api/health 2>/dev/null || echo "应用健康检查失败"
        echo ""
        echo "=== 应用首页检查 ==="
        curl -f -w "响应时间: %{time_total}s, HTTP状态: %{http_code}\n" \
            http://$DOMAIN:$PORT/ 2>/dev/null || echo "应用首页检查失败"
    } > "$REPORT_DIR/app-response.txt"
    cat "$REPORT_DIR/app-response.txt"
}

# 2. 分析API端点连通性
analyze_api_endpoints() {
    log_section "2. 分析API端点连通性"
    
    # 测试关键API端点
    log_subsection "关键API端点测试"
    {
        echo "=== 登录API测试 ==="
        curl -f -w "响应时间: %{time_total}s, HTTP状态: %{http_code}\n" -X POST \
            -H "Content-Type: application/json" \
            -d '{"username":"admin","password":"admin123"}' \
            http://$DOMAIN:$PORT/api/auth/login 2>/dev/null || echo "登录API测试失败"
        echo ""
        echo "=== 产品API测试 ==="
        curl -f -w "响应时间: %{time_total}s, HTTP状态: %{http_code}\n" \
            http://$DOMAIN:$PORT/api/products 2>/dev/null || echo "产品API测试失败"
        echo ""
        echo "=== 客户API测试 ==="
        curl -f -w "响应时间: %{time_total}s, HTTP状态: %{http_code}\n" \
            http://$DOMAIN:$PORT/api/customers 2>/dev/null || echo "客户API测试失败"
        echo ""
        echo "=== 订单API测试 ==="
        curl -f -w "响应时间: %{time_total}s, HTTP状态: %{http_code}\n" \
            http://$DOMAIN:$PORT/api/orders 2>/dev/null || echo "订单API测试失败"
    } > "$REPORT_DIR/api-endpoints.txt"
    cat "$REPORT_DIR/api-endpoints.txt"
    
    # 详细错误分析
    log_subsection "API错误详细分析"
    {
        echo "=== API错误详情 ==="
        for endpoint in "/api/auth/login" "/api/products" "/api/customers" "/api/orders"; do
            echo "测试端点: $endpoint"
            response=$(curl -s -w "%{http_code}" -o /tmp/api_response.json \
                http://$DOMAIN:$PORT$endpoint 2>/dev/null || echo "000")
            echo "HTTP状态码: $response"
            if [ -f /tmp/api_response.json ]; then
                echo "响应内容:"
                cat /tmp/api_response.json
            fi
            echo "---"
        done
    } > "$REPORT_DIR/api-error-analysis.txt"
    cat "$REPORT_DIR/api-error-analysis.txt"
}

# 3. 检查数据库连接和状态
check_database_status() {
    log_section "3. 检查数据库连接和状态"
    
    # 检查数据库文件
    log_subsection "数据库文件检查"
    {
        echo "=== 数据库文件状态 ==="
        if [ -f "db/custom.db" ]; then
            ls -lh db/custom.db
            echo "数据库文件存在且可访问"
        else
            echo "数据库文件不存在"
        fi
        echo ""
        echo "=== Prisma配置检查 ==="
        if [ -f "prisma/schema.prisma" ]; then
            echo "Prisma schema文件存在"
            grep -E "provider|url" prisma/schema.prisma || echo "未找到数据库配置"
        else
            echo "Prisma schema文件不存在"
        fi
    } > "$REPORT_DIR/database-status.txt"
    cat "$REPORT_DIR/database-status.txt"
    
    # 测试数据库连接
    log_subsection "数据库连接测试"
    {
        echo "=== 数据库连接测试 ==="
        if command -v npx >/dev/null 2>&1; then
            npx prisma db pull --force 2>&1 || echo "数据库连接失败"
        else
            echo "npx命令不可用，无法测试数据库连接"
        fi
    } > "$REPORT_DIR/database-connection.txt"
    cat "$REPORT_DIR/database-connection.txt"
}

# 4. 分析应用程序日志和错误
analyze_application_logs() {
    log_section "4. 分析应用程序日志和错误"
    
    # 检查日志文件
    log_subsection "应用日志分析"
    {
        echo "=== 开发服务器日志检查 ==="
        if [ -f "dev.log" ]; then
            echo "=== 最近的错误日志 ==="
            tail -50 dev.log | grep -i error || echo "未发现错误日志"
            echo ""
            echo "=== 最近的警告日志 ==="
            tail -50 dev.log | grep -i warn || echo "未发现警告日志"
            echo ""
            echo "=== 最近的启动日志 ==="
            tail -50 dev.log | grep -i "starting\|started\|ready\|listening" || echo "未发现启动相关日志"
        else
            echo "未找到开发服务器日志文件"
        fi
    } > "$REPORT_DIR/app-logs.txt"
    cat "$REPORT_DIR/app-logs.txt"
}

# 5. 检查静态资源加载
check_static_resources() {
    log_section "5. 检查静态资源加载"
    
    # 测试静态资源
    log_subsection "静态资源测试"
    {
        echo "=== 静态资源加载测试 ==="
        echo "测试 favicon.ico:"
        curl -I http://$DOMAIN:$PORT/favicon.ico 2>/dev/null || echo "favicon.ico 加载失败"
        echo ""
        echo "测试 Next.js 静态资源:"
        curl -I http://$DOMAIN:$PORT/_next/static/css/app.css 2>/dev/null || echo "Next.js CSS 加载失败"
        echo ""
        echo "测试图标资源:"
        curl -I http://$DOMAIN:$PORT/icon.png 2>/dev/null || echo "icon.png 加载失败"
    } > "$REPORT_DIR/static-resources.txt"
    cat "$REPORT_DIR/static-resources.txt"
}

# 6. 网络和系统资源分析
analyze_system_resources() {
    log_section "6. 网络和系统资源分析"
    
    # 系统资源检查
    log_subsection "系统资源检查"
    {
        echo "=== CPU使用率 ==="
        top -bn1 | grep "Cpu(s)" | awk '{print "CPU使用率: " $2}' 2>/dev/null || echo "无法获取CPU信息"
        echo ""
        echo "=== 内存使用情况 ==="
        free -h 2>/dev/null || echo "无法获取内存信息"
        echo ""
        echo "=== 磁盘使用情况 ==="
        df -h . 2>/dev/null || echo "无法获取磁盘信息"
        echo ""
        echo "=== 系统负载 ==="
        uptime 2>/dev/null || echo "无法获取系统负载"
    } > "$REPORT_DIR/system-resources.txt"
    cat "$REPORT_DIR/system-resources.txt"
    
    # 网络连通性检查
    log_subsection "网络连通性检查"
    {
        echo "=== 本地回环测试 ==="
        ping -c 3 127.0.0.1 2>/dev/null || echo "本地回环测试失败"
        echo ""
        echo "=== DNS解析测试 ==="
        nslookup $DOMAIN 2>/dev/null || echo "DNS解析失败"
    } > "$REPORT_DIR/network-connectivity.txt"
    cat "$REPORT_DIR/network-connectivity.txt"
}

# 7. 检查配置文件和环境变量
check_configuration() {
    log_section "7. 检查配置文件和环境变量"
    
    # 检查关键配置文件
    log_subsection "配置文件检查"
    {
        echo "=== Next.js配置检查 ==="
        if [ -f "next.config.js" ]; then
            echo "next.config.js 存在"
            grep -E "port|env|standalone" next.config.js || echo "未找到关键配置"
        else
            echo "next.config.js 不存在"
        fi
        echo ""
        echo "=== package.json检查 ==="
        if [ -f "package.json" ]; then
            echo "package.json 存在"
            grep -E "scripts|dependencies" package.json | head -10
        else
            echo "package.json 不存在"
        fi
        echo ""
        echo "=== 环境变量检查 ==="
        if [ -f ".env" ]; then
            echo ".env 文件存在"
            grep -E "DATABASE_URL|NODE_ENV|PORT" .env || echo "未找到关键环境变量"
        else
            echo ".env 文件不存在"
        fi
    } > "$REPORT_DIR/configuration.txt"
    cat "$REPORT_DIR/configuration.txt"
}

# 8. 生成综合性技术分析报告
generate_comprehensive_report() {
    log_section "8. 生成综合性技术分析报告"
    
    # 错误定位和影响范围评估
    log_subsection "错误定位和影响范围评估"
    {
        echo "=== 本地502 Bad Gateway错误分析报告 ==="
        echo "生成时间: $(date)"
        echo "目标地址: http://$DOMAIN:$PORT"
        echo ""
        
        # 分析可能的错误原因
        echo "=== 可能的错误原因分析 ==="
        
        # 检查应用是否运行
        if netstat -tln 2>/dev/null | grep -q ":$PORT " || ss -tln 2>/dev/null | grep -q ":$PORT "; then
            echo "✅ 应用正在端口 $PORT 上运行"
        else
            echo "❌ 应用未在端口 $PORT 上运行 - 可能是502错误的主要原因"
        fi
        
        # 检查应用响应
        if curl -f http://$DOMAIN:$PORT/api/health >/dev/null 2>&1; then
            echo "✅ 应用健康检查正常"
        else
            echo "❌ 应用健康检查失败 - 可能导致502错误"
        fi
        
        # 检查数据库文件
        if [ -f "db/custom.db" ]; then
            echo "✅ 数据库文件存在"
        else
            echo "❌ 数据库文件不存在 - 可能导致应用错误"
        fi
        
        # 检查关键配置文件
        if [ -f "next.config.js" ] && [ -f "package.json" ]; then
            echo "✅ 关键配置文件存在"
        else
            echo "❌ 关键配置文件缺失 - 可能导致应用启动失败"
        fi
        
    } > "$REPORT_DIR/error-analysis.txt"
    
    # 优先级排序和修复建议
    log_subsection "优先级排序和修复建议"
    {
        echo ""
        echo "=== 修复优先级排序 ==="
        echo ""
        echo "🔴 高优先级 (立即修复):"
        echo "1. 检查应用是否正确启动"
        echo "2. 验证端口占用情况"
        echo "3. 检查数据库连接"
        echo ""
        echo "🟡 中优先级 (尽快修复):"
        echo "1. 检查API端点响应"
        echo "2. 验证静态资源加载"
        echo "3. 检查环境变量配置"
        echo ""
        echo "🟢 低优先级 (后续优化):"
        echo "1. 优化系统资源使用"
        echo "2. 改进日志记录"
        echo "3. 增强错误处理"
        echo ""
        
        echo "=== 具体修复步骤 ==="
        echo ""
        echo "1. 立即修复步骤:"
        echo "   npm run dev"
        echo "   检查控制台输出"
        echo "   netstat -tln | grep :$PORT"
        echo ""
        echo "2. 数据库问题排查:"
        echo "   npx prisma generate"
        echo "   npx prisma db push"
        echo "   npx prisma db seed"
        echo ""
        echo "3. 配置问题排查:"
        echo "   cat .env"
        echo "   cat next.config.js"
        echo "   npm run build"
        
    } >> "$REPORT_DIR/error-analysis.txt"
    
    cat "$REPORT_DIR/error-analysis.txt"
}

# 9. 生成诊断摘要
generate_summary() {
    log_section "9. 诊断摘要"
    
    {
        echo "=== 本地502 Bad Gateway 诊断摘要 ==="
        echo "诊断时间: $(date)"
        echo "目标地址: http://$DOMAIN:$PORT"
        echo "报告目录: $REPORT_DIR"
        echo ""
        echo "=== 关键发现 ==="
        echo "1. 应用状态: $(netstat -tln 2>/dev/null | grep -q ":$PORT " && echo "运行中" || echo "未运行")"
        echo "2. 健康检查: $(curl -f http://$DOMAIN:$PORT/api/health >/dev/null 2>&1 && echo "正常" || echo "异常")"
        echo "3. 数据库文件: $([ -f "db/custom.db" ] && echo "存在" || echo "不存在")"
        echo "4. 配置文件: $([ -f "next.config.js" ] && [ -f "package.json" ] && echo "完整" || echo "缺失")"
        echo ""
        echo "=== 建议的下一步操作 ==="
        echo "1. 查看详细报告: ls -la $REPORT_DIR/"
        echo "2. 查看错误分析: cat $REPORT_DIR/error-analysis.txt"
        echo "3. 查看应用日志: tail -f dev.log"
        echo "4. 重启应用: npm run dev"
        echo "5. 检查端口: netstat -tln | grep :$PORT"
    } > "$REPORT_DIR/diagnosis-summary.txt"
    
    cat "$REPORT_DIR/diagnosis-summary.txt"
    
    log_info "诊断完成！详细报告已保存到: $REPORT_DIR"
    log_info "查看摘要: cat $REPORT_DIR/diagnosis-summary.txt"
    log_info "查看错误分析: cat $REPORT_DIR/error-analysis.txt"
}

# 主函数
main() {
    echo "=================================="
    echo "智慧库存系统 - 本地502 Bad Gateway 诊断工具"
    echo "=================================="
    echo ""
    
    # 检查是否在正确的目录
    if [ ! -f "package.json" ]; then
        log_error "未找到package.json文件，请在项目根目录运行此脚本"
        exit 1
    fi
    
    # 执行所有诊断步骤
    check_local_application
    analyze_api_endpoints
    check_database_status
    analyze_application_logs
    check_static_resources
    analyze_system_resources
    check_configuration
    generate_comprehensive_report
    generate_summary
    
    log_info "本地诊断完成！"
}

# 运行主函数
main "$@"