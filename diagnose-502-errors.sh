#!/bin/bash

# 智慧库存管理系统 - 502 Bad Gateway 深度诊断工具
# 全面分析系统架构问题，定位错误根本原因

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
REPORT_DIR="/tmp/502-diagnosis-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$REPORT_DIR"

# 获取域名参数
DOMAIN=${1:-"localhost"}
log_info "开始诊断域名: $DOMAIN 的502 Bad Gateway错误"
log_info "诊断报告将保存到: $REPORT_DIR"

# 1. Docker容器运行状态和网络配置分析
analyze_docker_containers() {
    log_section "1. Docker容器运行状态和网络配置分析"
    
    # 容器状态概览
    log_subsection "容器状态概览"
    docker compose ps > "$REPORT_DIR/docker-containers-status.txt"
    cat "$REPORT_DIR/docker-containers-status.txt"
    
    # 容器详细信息
    log_subsection "容器详细信息"
    {
        echo "=== 容器详细信息 ==="
        docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}\t{{.Networks}}"
        echo ""
        echo "=== 容器资源使用情况 ==="
        docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
    } > "$REPORT_DIR/docker-containers-detailed.txt"
    cat "$REPORT_DIR/docker-containers-detailed.txt"
    
    # 网络配置分析
    log_subsection "Docker网络配置分析"
    {
        echo "=== Docker网络列表 ==="
        docker network ls
        echo ""
        echo "=== 应用网络详细信息 ==="
        docker network inspect inventory-system_app-network 2>/dev/null || echo "应用网络不存在"
        echo ""
        echo "=== 容器网络连接 ==="
        for container in $(docker compose ps -q); do
            container_name=$(docker inspect --format='{{.Name}}' $container | sed 's/\///')
            echo "容器: $container_name"
            docker inspect --format='{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' $container
            echo ""
        done
    } > "$REPORT_DIR/docker-network-analysis.txt"
    cat "$REPORT_DIR/docker-network-analysis.txt"
    
    # 容器健康检查
    log_subsection "容器健康检查状态"
    {
        echo "=== 健康检查状态 ==="
        docker compose ps --format "table {{.Name}}\t{{.Status}}"
        echo ""
        echo "=== 应用容器健康检查日志 ==="
        docker compose logs app | grep -i health | tail -10
    } > "$REPORT_DIR/docker-health-check.txt"
    cat "$REPORT_DIR/docker-health-check.txt"
}

# 2. Nginx反向代理配置和路由规则检查
analyze_nginx_config() {
    log_section "2. Nginx反向代理配置和路由规则检查"
    
    # Nginx配置验证
    log_subsection "Nginx配置验证"
    {
        echo "=== Nginx配置测试 ==="
        docker compose exec nginx nginx -t 2>&1 || echo "Nginx配置测试失败"
        echo ""
        echo "=== Nginx主配置 ==="
        docker compose exec nginx cat /etc/nginx/nginx.conf 2>/dev/null || echo "无法读取主配置"
    } > "$REPORT_DIR/nginx-config-validation.txt"
    cat "$REPORT_DIR/nginx-config-validation.txt"
    
    # Upstream配置检查
    log_subsection "Upstream配置检查"
    {
        echo "=== Upstream服务器状态 ==="
        docker compose exec nginx nginx -T 2>/dev/null | grep -A 10 "upstream app" || echo "无法获取upstream配置"
        echo ""
        echo "=== 应用容器连通性测试 ==="
        docker compose exec nginx wget -qO- --timeout=5 http://app:3000/api/health || echo "无法连接到应用容器"
    } > "$REPORT_DIR/nginx-upstream-check.txt"
    cat "$REPORT_DIR/nginx-upstream-check.txt"
    
    # Nginx错误日志分析
    log_subsection "Nginx错误日志分析"
    {
        echo "=== 最近的Nginx错误日志 ==="
        docker compose logs nginx 2>&1 | grep -i error | tail -20
        echo ""
        echo "=== 502错误统计 ==="
        docker compose logs nginx 2>&1 | grep -i "502" | wc -l
        echo ""
        echo "=== 最近的502错误详情 ==="
        docker compose logs nginx 2>&1 | grep -i "502" | tail -10
    } > "$REPORT_DIR/nginx-error-analysis.txt"
    cat "$REPORT_DIR/nginx-error-analysis.txt"
    
    # Nginx访问日志分析
    log_subsection "Nginx访问日志分析"
    {
        echo "=== 最近的HTTP错误响应统计 ==="
        docker compose logs nginx 2>&1 | grep -E "HTTP/[0-9\.]+ [45][0-9]{2}" | tail -20
        echo ""
        echo "=== 响应时间分析 ==="
        docker compose logs nginx 2>&1 | tail -50
    } > "$REPORT_DIR/nginx-access-analysis.txt"
    cat "$REPORT_DIR/nginx-access-analysis.txt"
}

# 3. 关键API端点连通性和响应性能测试
test_api_connectivity() {
    log_section "3. 关键API端点连通性和响应性能测试"
    
    # 直接应用容器测试
    log_subsection "应用容器直接API测试"
    {
        echo "=== 应用容器健康检查 ==="
        timeout 10 docker compose exec app curl -f -w "响应时间: %{time_total}s, HTTP状态: %{http_code}\n" http://localhost:3000/api/health || echo "应用容器健康检查失败"
        echo ""
        echo "=== 应用容器登录API测试 ==="
        timeout 10 docker compose exec app curl -f -w "响应时间: %{time_total}s, HTTP状态: %{http_code}\n" -X POST \
            -H "Content-Type: application/json" \
            -d '{"username":"admin","password":"admin123"}' \
            http://localhost:3000/api/auth/login || echo "应用容器登录API测试失败"
        echo ""
        echo "=== 应用容器产品API测试 ==="
        timeout 10 docker compose exec app curl -f -w "响应时间: %{time_total}s, HTTP状态: %{http_code}\n" http://localhost:3000/api/products || echo "应用容器产品API测试失败"
    } > "$REPORT_DIR/api-direct-test.txt"
    cat "$REPORT_DIR/api-direct-test.txt"
    
    # Nginx代理API测试
    log_subsection "Nginx代理API测试"
    {
        echo "=== Nginx代理健康检查 ==="
        timeout 10 curl -f -w "响应时间: %{time_total}s, HTTP状态: %{http_code}\n" http://localhost/api/health || echo "Nginx代理健康检查失败"
        echo ""
        echo "=== Nginx代理登录API测试 ==="
        timeout 10 curl -f -w "响应时间: %{time_total}s, HTTP状态: %{http_code}\n" -X POST \
            -H "Content-Type: application/json" \
            -d '{"username":"admin","password":"admin123"}' \
            http://localhost/api/auth/login || echo "Nginx代理登录API测试失败"
        echo ""
        echo "=== Nginx代理产品API测试 ==="
        timeout 10 curl -f -w "响应时间: %{time_total}s, HTTP状态: %{http_code}\n" http://localhost/api/products || echo "Nginx代理产品API测试失败"
    } > "$REPORT_DIR/api-nginx-test.txt"
    cat "$REPORT_DIR/api-nginx-test.txt"
    
    # 外部域名API测试
    log_subsection "外部域名API测试"
    {
        echo "=== 外部域名健康检查 ==="
        timeout 10 curl -f -w "响应时间: %{time_total}s, HTTP状态: %{http_code}\n" https://$DOMAIN/api/health || echo "外部域名健康检查失败"
        echo ""
        echo "=== 外部域名登录API测试 ==="
        timeout 10 curl -f -w "响应时间: %{time_total}s, HTTP状态: %{http_code}\n" -X POST \
            -H "Content-Type: application/json" \
            -d '{"username":"admin","password":"admin123"}' \
            https://$DOMAIN/api/auth/login || echo "外部域名登录API测试失败"
    } > "$REPORT_DIR/api-external-test.txt"
    cat "$REPORT_DIR/api-external-test.txt"
}

# 4. 应用程序错误日志和异常堆栈分析
analyze_application_logs() {
    log_section "4. 应用程序错误日志和异常堆栈分析"
    
    # 应用错误日志分析
    log_subsection "应用错误日志分析"
    {
        echo "=== 最近的错误日志 ==="
        docker compose logs app 2>&1 | grep -i error | tail -20
        echo ""
        echo "=== 最近的警告日志 ==="
        docker compose logs app 2>&1 | grep -i warn | tail -20
        echo ""
        echo "=== 异常堆栈跟踪 ==="
        docker compose logs app 2>&1 | grep -A 5 -B 5 -i "exception\|error\|stack trace" | tail -30
    } > "$REPORT_DIR/app-error-logs.txt"
    cat "$REPORT_DIR/app-error-logs.txt"
    
    # 应用启动日志分析
    log_subsection "应用启动日志分析"
    {
        echo "=== 应用启动过程 ==="
        docker compose logs app 2>&1 | grep -i "starting\|started\|ready\|listening" | tail -10
        echo ""
        echo "=== 应用端口绑定信息 ==="
        docker compose logs app 2>&1 | grep -i "port\|bind\|listen" | tail -10
    } > "$REPORT_DIR/app-startup-logs.txt"
    cat "$REPORT_DIR/app-startup-logs.txt"
    
    # 内存和性能相关日志
    log_subsection "内存和性能相关日志"
    {
        echo "=== 内存使用相关日志 ==="
        docker compose logs app 2>&1 | grep -i "memory\|heap\|gc" | tail -10
        echo ""
        echo "=== 数据库连接相关日志 ==="
        docker compose logs app 2>&1 | grep -i "database\|connection\|prisma" | tail -10
    } > "$REPORT_DIR/app-performance-logs.txt"
    cat "$REPORT_DIR/app-performance-logs.txt"
}

# 5. 数据库连接池状态和查询性能检查
analyze_database_performance() {
    log_section "5. 数据库连接池状态和查询性能检查"
    
    # 数据库连接测试
    log_subsection "数据库连接测试"
    {
        echo "=== 数据库连接测试 ==="
        docker compose exec app npx prisma db pull --force 2>&1 || echo "数据库连接失败"
        echo ""
        echo "=== 数据库迁移状态 ==="
        docker compose exec app npx prisma migrate status 2>&1 || echo "无法获取迁移状态"
    } > "$REPORT_DIR/database-connection-test.txt"
    cat "$REPORT_DIR/database-connection-test.txt"
    
    # 数据库性能分析
    log_subsection "数据库性能分析"
    {
        echo "=== 数据库文件大小 ==="
        docker compose exec app ls -lh db/custom.db 2>/dev/null || echo "无法获取数据库文件信息"
        echo ""
        echo "=== 数据库查询性能测试 ==="
        docker compose exec app timeout 10 npx prisma db seed 2>&1 || echo "数据库性能测试超时"
    } > "$REPORT_DIR/database-performance.txt"
    cat "$REPORT_DIR/database-performance.txt"
}

# 6. 静态资源加载机制和CDN配置验证
analyze_static_resources() {
    log_section "6. 静态资源加载机制和CDN配置验证"
    
    # 静态资源测试
    log_subsection "静态资源加载测试"
    {
        echo "=== 静态资源直接访问测试 ==="
        timeout 10 curl -I http://localhost:3000/_next/static/css/app.css 2>/dev/null || echo "静态资源直接访问失败"
        echo ""
        echo "=== 静态资源代理访问测试 ==="
        timeout 10 curl -I http://localhost/_next/static/css/app.css 2>/dev/null || echo "静态资源代理访问失败"
        echo ""
        echo "=== 静态资源外部访问测试 ==="
        timeout 10 curl -I https://$DOMAIN/_next/static/css/app.css 2>/dev/null || echo "静态资源外部访问失败"
    } > "$REPORT_DIR/static-resources-test.txt"
    cat "$REPORT_DIR/static-resources-test.txt"
}

# 7. 网络链路连通性和延迟分析
analyze_network_connectivity() {
    log_section "7. 网络链路连通性和延迟分析"
    
    # 网络连通性测试
    log_subsection "网络连通性测试"
    {
        echo "=== 容器间网络连通性 ==="
        docker compose exec nginx ping -c 3 app 2>/dev/null || echo "容器间网络连通性失败"
        echo ""
        echo "=== DNS解析测试 ==="
        docker compose exec nginx nslookup app 2>/dev/null || echo "DNS解析失败"
        echo ""
        echo "=== 端口连通性测试 ==="
        docker compose exec nginx nc -zv app 3000 2>/dev/null || echo "端口连通性失败"
    } > "$REPORT_DIR/network-connectivity.txt"
    cat "$REPORT_DIR/network-connectivity.txt"
    
    # 延迟分析
    log_subsection "网络延迟分析"
    {
        echo "=== 容器间延迟测试 ==="
        docker compose exec nginx ping -c 10 app | tail -1 2>/dev/null || echo "延迟测试失败"
    } > "$REPORT_DIR/network-latency.txt"
    cat "$REPORT_DIR/network-latency.txt"
}

# 8. 服务器资源使用情况和性能瓶颈监控
analyze_server_resources() {
    log_section "8. 服务器资源使用情况和性能瓶颈监控"
    
    # 系统资源概览
    log_subsection "系统资源概览"
    {
        echo "=== CPU使用率 ==="
        top -bn1 | grep "Cpu(s)" | awk '{print "CPU使用率: " $2}'
        echo ""
        echo "=== 内存使用情况 ==="
        free -h
        echo ""
        echo "=== 磁盘使用情况 ==="
        df -h
        echo ""
        echo "=== 系统负载 ==="
        uptime
    } > "$REPORT_DIR/system-resources.txt"
    cat "$REPORT_DIR/system-resources.txt"
    
    # Docker资源使用
    log_subsection "Docker容器资源使用"
    {
        echo "=== 容器资源使用详情 ==="
        docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}"
    } > "$REPORT_DIR/docker-resources.txt"
    cat "$REPORT_DIR/docker-resources.txt"
}

# 9. 生成综合性技术分析报告
generate_comprehensive_report() {
    log_section "9. 生成综合性技术分析报告"
    
    # 错误定位和影响范围评估
    log_subsection "错误定位和影响范围评估"
    {
        echo "=== 502 Bad Gateway错误分析报告 ==="
        echo "生成时间: $(date)"
        echo "诊断域名: $DOMAIN"
        echo ""
        
        # 分析502错误的可能原因
        echo "=== 可能的错误原因分析 ==="
        
        # 检查应用容器状态
        if docker compose ps app | grep -q "Up"; then
            echo "✅ 应用容器运行正常"
        else
            echo "❌ 应用容器未正常运行 - 可能是502错误的主要原因"
        fi
        
        # 检查Nginx配置
        if docker compose exec nginx nginx -t >/dev/null 2>&1; then
            echo "✅ Nginx配置语法正确"
        else
            echo "❌ Nginx配置错误 - 可能导致502错误"
        fi
        
        # 检查网络连通性
        if docker compose exec nginx nc -zv app 3000 >/dev/null 2>&1; then
            echo "✅ 容器间网络连通正常"
        else
            echo "❌ 容器间网络连通性问题 - 可能导致502错误"
        fi
        
        # 检查应用健康状态
        if docker compose exec app curl -f http://localhost:3000/api/health >/dev/null 2>&1; then
            echo "✅ 应用健康检查正常"
        else
            echo "❌ 应用健康检查失败 - 可能导致502错误"
        fi
        
    } > "$REPORT_DIR/error-analysis.txt"
    
    # 优先级排序和修复建议
    log_subsection "优先级排序和修复建议"
    {
        echo ""
        echo "=== 修复优先级排序 ==="
        echo ""
        echo "🔴 高优先级 (立即修复):"
        echo "1. 应用容器状态检查和重启"
        echo "2. 网络连通性问题排查"
        echo "3. 应用健康检查失败处理"
        echo ""
        echo "🟡 中优先级 (尽快修复):"
        echo "1. Nginx配置优化"
        echo "2. 数据库连接池调优"
        echo "3. 静态资源加载优化"
        echo ""
        echo "🟢 低优先级 (后续优化):"
        echo "1. 性能监控和日志分析"
        echo "2. 资源使用优化"
        echo "3. 安全配置加固"
        echo ""
        
        echo "=== 具体修复步骤 ==="
        echo ""
        echo "1. 立即修复步骤:"
        echo "   docker compose restart app nginx"
        echo "   docker compose logs -f app nginx"
        echo ""
        echo "2. 网络问题排查:"
        echo "   docker network ls"
        echo "   docker network inspect inventory-system_app-network"
        echo ""
        echo "3. 应用问题排查:"
        echo "   docker compose exec app curl -v http://localhost:3000/api/health"
        echo "   docker compose exec app node init-admin.js"
        echo ""
        echo "4. 配置问题排查:"
        echo "   docker compose exec nginx nginx -t"
        echo "   docker compose exec nginx nginx -s reload"
        
    } >> "$REPORT_DIR/error-analysis.txt"
    
    cat "$REPORT_DIR/error-analysis.txt"
}

# 10. 生成诊断摘要
generate_summary() {
    log_section "10. 诊断摘要"
    
    {
        echo "=== 502 Bad Gateway 诊断摘要 ==="
        echo "诊断时间: $(date)"
        echo "目标域名: $DOMAIN"
        echo "报告目录: $REPORT_DIR"
        echo ""
        echo "=== 关键发现 ==="
        echo "1. 容器状态: $(docker compose ps | grep -c "Up" || echo "0") 个容器运行中"
        echo "2. 网络连通性: $(docker compose exec nginx nc -zv app 3000 >/dev/null 2>&1 && echo "正常" || echo "异常")"
        echo "3. 应用健康: $(docker compose exec app curl -f http://localhost:3000/api/health >/dev/null 2>&1 && echo "正常" || echo "异常")"
        echo "4. Nginx配置: $(docker compose exec nginx nginx -t >/dev/null 2>&1 && echo "正常" || echo "异常")"
        echo ""
        echo "=== 建议的下一步操作 ==="
        echo "1. 查看详细报告: ls -la $REPORT_DIR/"
        echo "2. 查看错误分析: cat $REPORT_DIR/error-analysis.txt"
        echo "3. 查看应用日志: docker compose logs -f app"
        echo "4. 查看Nginx日志: docker compose logs -f nginx"
        echo "5. 重启服务: docker compose restart"
    } > "$REPORT_DIR/diagnosis-summary.txt"
    
    cat "$REPORT_DIR/diagnosis-summary.txt"
    
    log_info "诊断完成！详细报告已保存到: $REPORT_DIR"
    log_info "查看摘要: cat $REPORT_DIR/diagnosis-summary.txt"
    log_info "查看错误分析: cat $REPORT_DIR/error-analysis.txt"
}

# 主函数
main() {
    echo "=================================="
    echo "智慧库存系统 - 502 Bad Gateway 深度诊断工具"
    echo "=================================="
    echo ""
    
    # 检查Docker Compose是否可用
    if ! docker compose version >/dev/null 2>&1; then
        log_error "Docker Compose未安装或不可用"
        exit 1
    fi
    
    # 检查是否在正确的目录
    if [ ! -f "docker-compose.yml" ]; then
        log_error "未找到docker-compose.yml文件，请在项目根目录运行此脚本"
        exit 1
    fi
    
    # 执行所有诊断步骤
    analyze_docker_containers
    analyze_nginx_config
    test_api_connectivity
    analyze_application_logs
    analyze_database_performance
    analyze_static_resources
    analyze_network_connectivity
    analyze_server_resources
    generate_comprehensive_report
    generate_summary
    
    log_info "深度诊断完成！"
}

# 运行主函数
main "$@"