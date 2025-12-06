import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createSecureResponse } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 检查数据库连接
    let dbStatus = 'unhealthy';
    let dbResponseTime = 0;
    
    try {
      const dbStartTime = Date.now();
      await db.$queryRaw`SELECT 1`;
      dbResponseTime = Date.now() - dbStartTime;
      dbStatus = 'healthy';
    } catch (error) {
      console.error('Database health check failed:', error);
    }
    
    // 检查内存使用情况
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal;
    const usedMemory = memUsage.heapUsed;
    const memoryUsagePercent = Math.round((usedMemory / totalMemory) * 100);
    
    // 检查系统正常运行时间
    const uptime = process.uptime();
    const uptimeHours = Math.floor(uptime / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);
    
    // 检查环境变量
    const envChecks = {
      database: !!process.env.DATABASE_URL,
      jwtSecret: !!process.env.JWT_SECRET,
      nodeEnv: process.env.NODE_ENV || 'development'
    };
    
    // 总体健康状态 - 调整内存阈值为95%以避免误报
    const isHealthy = dbStatus === 'healthy' && memoryUsagePercent < 95;
    
    const healthData = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: `${uptimeHours}h ${uptimeMinutes}m`,
      responseTime: Date.now() - startTime,
      
      // 数据库状态
      database: {
        status: dbStatus,
        responseTime: `${dbResponseTime}ms`
      },
      
      // 内存使用情况
      memory: {
        used: `${Math.round(usedMemory / 1024 / 1024)}MB`,
        total: `${Math.round(totalMemory / 1024 / 1024)}MB`,
        usagePercent: `${memoryUsagePercent}%`
      },
      
      // 环境检查
      environment: envChecks,
      
      // 系统信息
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        arch: process.arch
      }
    };
    
    // 设置适当的HTTP状态码
    const statusCode = isHealthy ? 200 : 503;
    
    // 添加健康检查相关的头部
    const response = createSecureResponse(healthData, statusCode);
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('X-Health-Check', 'true');
    
    return response;
    
  } catch (error) {
    console.error('Health check error:', error);
    
    const errorData = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: process.env.NODE_ENV === 'development' 
        ? (error as Error).message 
        : 'Internal server error',
      responseTime: Date.now() - startTime
    };
    
    return createSecureResponse(errorData, 503);
  }
}

// 支持HEAD请求用于简单的健康检查
export async function HEAD(request: NextRequest) {
  try {
    // 简单的数据库连接检查
    await db.$queryRaw`SELECT 1`;
    
    const response = new NextResponse(null, { status: 200 });
    response.headers.set('X-Health-Check', 'true');
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    return response;
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}