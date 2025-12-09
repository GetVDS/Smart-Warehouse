// 微服务架构设计 - 简化版本

// 服务定义接口
export interface ServiceDefinition {
  id: string;
  name: string;
  type: string;
  version: string;
  host: string;
  port: number;
  healthEndpoint: string;
  metadata?: Record<string, any>;
}

// 服务健康状态
export interface ServiceHealth {
  serviceId: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  lastCheck: Date;
  responseTime: number;
  errorRate: number;
  uptime: number;
}

// 服务注册中心
export class ServiceRegistry {
  private services = new Map<string, ServiceDefinition>();

  // 注册服务
  registerService(service: ServiceDefinition): void {
    this.services.set(service.id, service);
    console.log(`服务 ${service.name} (${service.id}) 注册成功`);
  }

  // 注销服务
  unregisterService(serviceId: string): void {
    const service = this.services.get(serviceId);
    if (service) {
      this.services.delete(serviceId);
      console.log(`服务 ${service.name} (${serviceId}) 注销成功`);
    }
  }

  // 发现服务
  discoverServices(serviceType?: string): ServiceDefinition[] {
    const services = Array.from(this.services.values());
    
    if (serviceType) {
      return services.filter(s => s.type === serviceType);
    }
    
    return services;
  }

  // 获取服务健康状态
  async getServiceHealth(serviceId: string): Promise<ServiceHealth> {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`服务 ${serviceId} 不存在`);
    }

    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${service.host}:${service.port}${service.healthEndpoint}`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        return {
          serviceId,
          status: 'healthy',
          lastCheck: new Date(),
          responseTime,
          errorRate: 0,
          uptime: 100
        };
      } else {
        return {
          serviceId,
          status: 'unhealthy',
          lastCheck: new Date(),
          responseTime,
          errorRate: 100,
          uptime: 0
        };
      }
    } catch (error) {
      return {
        serviceId,
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        errorRate: 100,
        uptime: 0
      };
    }
  }
}

// 导出类型（已在接口定义时导出，无需重复导出）