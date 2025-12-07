// 微服务架构设计

// 服务注册中心接口
interface ServiceRegistry {
  registerService(service: ServiceDefinition): Promise<void>;
  unregisterService(serviceId: string): Promise<void>;
  discoverServices(serviceType?: string): Promise<ServiceDefinition[]>;
  getServiceHealth(serviceId: string): Promise<ServiceHealth>;
}

// 服务定义接口
interface ServiceDefinition {
  id: string;
  name: string;
  type: string;
  version: string;
  host: string;
  port: number;
  healthEndpoint: string;
  metadata: Record<string, any>;
  loadBalancer?: LoadBalancerConfig;
}

// 负载均衡配置
interface LoadBalancerConfig {
  strategy: 'round-robin' | 'least-connections' | 'weighted';
  healthCheckInterval: number;
  maxRetries: number;
  timeout: number;
}

// 服务健康状态
interface ServiceHealth {
  serviceId: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  lastCheck: Date;
  responseTime: number;
  errorRate: number;
  uptime: number;
}

// 服务发现和注册中心
class ServiceRegistryCenter implements ServiceRegistry {
  private services = new Map<string, ServiceDefinition>();
  private healthChecks = new Map<string, NodeJS.Timeout>();
  private loadBalancers = new Map<string, LoadBalancer>();

  constructor() {
    this.startHealthChecks();
  }

  // 注册服务
  async registerService(service: ServiceDefinition): Promise<void> {
    try {
      // 验证服务定义
      this.validateServiceDefinition(service);
      
      // 检查服务是否已存在
      if (this.services.has(service.id)) {
        throw new Error(`服务 ${service.id} 已存在`);
      }

      // 注册服务
      this.services.set(service.id, service);
      
      // 创建负载均衡器
      if (service.loadBalancer) {
        this.loadBalancers.set(service.id, new LoadBalancer(service, service.loadBalancer));
      }
      
      // 启动健康检查
      this.startHealthCheck(service);
      
      console.log(`服务 ${service.name} (${service.id}) 注册成功`);
    } catch (error) {
      console.error(`服务注册失败:`, error);
      throw error;
    }
  }

  // 注销服务
  async unregisterService(serviceId: string): Promise<void> {
    try {
      const service = this.services.get(serviceId);
      if (!service) {
        throw new Error(`服务 ${serviceId} 不存在`);
      }

      // 停止健康检查
      this.stopHealthCheck(serviceId);
      
      // 删除负载均衡器
      this.loadBalancers.delete(serviceId);
      
      // 注销服务
      this.services.delete(serviceId);
      
      console.log(`服务 ${service.name} (${serviceId}) 注销成功`);
    } catch (error) {
      console.error(`服务注销失败:`, error);
      throw error;
    }
  }

  // 发现服务
  async discoverServices(serviceType?: string): Promise<ServiceDefinition[]> {
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
      const response = await fetch(`${service.host}:${service.port}${service.healthEndpoint}`, {
        method: 'GET',
        timeout: 5000
      });
      
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

  // 验证服务定义
  private validateServiceDefinition(service: ServiceDefinition): void {
    if (!service.id || !service.name || !service.type || !service.host || !service.port) {
      throw new Error('服务定义缺少必要字段');
    }

    if (service.port < 1 || service.port > 65535) {
      throw new Error('无效的端口号');
    }

    if (!service.healthEndpoint) {
      service.healthEndpoint = '/health';
    }
  }

  // 启动健康检查
  private startHealthCheck(service: ServiceDefinition): void {
    const interval = setInterval(async () => {
      try {
        const health = await this.getServiceHealth(service.id);
        console.log(`健康检查 ${service.name}: ${health.status} (${health.responseTime}ms)`);
      } catch (error) {
        console.error(`健康检查失败 ${service.name}:`, error);
      }
    }, 30000); // 每30秒检查一次

    this.healthChecks.set(service.id, interval);
  }

  // 停止健康检查
  private stopHealthCheck(serviceId: string): void {
    const interval = this.healthChecks.get(serviceId);
    if (interval) {
      clearInterval(interval);
      this.healthChecks.delete(serviceId);
    }
  }

  // 启动所有健康检查
  private startHealthChecks(): void {
    // 应用启动时为所有已注册服务启动健康检查
    for (const service of this.services.values()) {
      this.startHealthCheck(service);
    }
  }
}

// 负载均衡器
class LoadBalancer {
  private service: ServiceDefinition;
  private config: LoadBalancerConfig;
  private currentIndex = 0;
  private connections = new Map<string, number>();

  constructor(service: ServiceDefinition, config: LoadBalancerConfig) {
    this.service = service;
    this.config = config;
  }

  // 选择服务实例
  selectInstance(): string {
    switch (this.config.strategy) {
      case 'round-robin':
        return this.roundRobinSelection();
      
      case 'least-connections':
        return this.leastConnectionsSelection();
      
      case 'weighted':
        return this.weightedSelection();
      
      default:
        return this.roundRobinSelection();
    }
  }

  // 轮询选择
  private roundRobinSelection(): string {
    const instances = this.getServiceInstances();
    if (instances.length === 0) return this.service.host;
    
    const selected = instances[this.currentIndex % instances.length];
    this.currentIndex++;
    return selected;
  }

  // 最少连接选择
  private leastConnectionsSelection(): string {
    const instances = this.getServiceInstances();
    if (instances.length === 0) return this.service.host;
    
    let selected = instances[0];
    let minConnections = this.connections.get(selected) || 0;
    
    for (const instance of instances) {
      const connections = this.connections.get(instance) || 0;
      if (connections < minConnections) {
        minConnections = connections;
        selected = instance;
      }
    }
    
    return selected;
  }

  // 权重选择
  private weightedSelection(): string {
    const instances = this.getServiceInstances();
    if (instances.length === 0) return this.service.host;
    
    // 简化实现：随机选择（实际应根据权重选择）
    return instances[Math.floor(Math.random() * instances.length)];
  }

  // 获取服务实例列表
  private getServiceInstances(): string[] {
    // 这里应该从服务发现获取实例列表
    // 简化实现，返回主实例
    return [this.service.host];
  }

  // 记录连接
  recordConnection(instance: string): void {
    const current = this.connections.get(instance) || 0;
    this.connections.set(instance, current + 1);
  }

  // 释放连接
  releaseConnection(instance: string): void {
    const current = this.connections.get(instance) || 0;
    this.connections.set(instance, Math.max(0, current - 1));
  }
}

// API网关
class APIGateway {
  private serviceRegistry: ServiceRegistry;
  private routes = new Map<string, RouteConfig>();
  private middleware: Middleware[] = [];

  constructor(serviceRegistry: ServiceRegistry) {
    this.serviceRegistry = serviceRegistry;
  }

  // 添加路由
  addRoute(path: string, config: RouteConfig): void {
    this.routes.set(path, config);
  }

  // 添加中间件
  addMiddleware(middleware: Middleware): void {
    this.middleware.push(middleware);
  }

  // 处理请求
  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // 查找匹配的路由
    const route = this.findRoute(path);
    if (!route) {
      return new Response('Not Found', { status: 404 });
    }

    try {
      // 应用中间件
      let processedRequest = request;
      for (const middleware of this.middleware) {
        processedRequest = await middleware(processedRequest);
      }

      // 路由到后端服务
      if (route.serviceType) {
        const services = await this.serviceRegistry.discoverServices(route.serviceType);
        if (services.length === 0) {
          return new Response('Service Not Available', { status: 503 });
        }

        // 负载均衡选择服务实例
        const selectedService = this.selectService(services);
        
        // 转发请求
        const targetUrl = `${selectedService.host}:${selectedService.port}${route.targetPath || path}`;
        const response = await this.forwardRequest(processedRequest, targetUrl);
        
        return response;
      } else {
        // 直接处理
        return route.handler(processedRequest);
      }
    } catch (error) {
      console.error('请求处理失败:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  // 查找匹配的路由
  private findRoute(path: string): RouteConfig | null {
    for (const [routePath, config] of this.routes.entries()) {
      if (this.pathMatches(routePath, path)) {
        return config;
      }
    }
    return null;
  }

  // 路径匹配
  private pathMatches(routePath: string, requestPath: string): boolean {
    // 简化的路径匹配逻辑
    if (routePath === requestPath) return true;
    
    // 支持参数化路径
    const routeParts = routePath.split('/');
    const requestParts = requestPath.split('/');
    
    if (routeParts.length !== requestParts.length) return false;
    
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) continue; // 参数部分
      if (routeParts[i] !== requestParts[i]) return false;
    }
    
    return true;
  }

  // 选择服务实例
  private selectService(services: ServiceDefinition[]): ServiceDefinition {
    // 简化实现：选择第一个健康的服务
    for (const service of services) {
      const health = await this.serviceRegistry.getServiceHealth(service.id);
      if (health.status === 'healthy') {
        return service;
      }
    }
    
    // 如果没有健康的服务，返回第一个
    return services[0];
  }

  // 转发请求
  private async forwardRequest(request: Request, targetUrl: string): Promise<Response> {
    const url = new URL(targetUrl);
    
    // 构建新的请求
    const newRequest = new Request(url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'follow'
    });

    // 发送请求
    return fetch(newRequest);
  }
}

// 路由配置
interface RouteConfig {
  path: string;
  serviceType?: string;
  targetPath?: string;
  handler?: (request: Request) => Promise<Response>;
  middleware?: Middleware[];
}

// 中间件类型
type Middleware = (request: Request) => Promise<Request>;

// 服务拆分策略
class ServiceDecomposer {
  // 分析单体应用
  static analyzeMonolith(): ServiceDecompositionPlan {
    return {
      services: [
        {
          name: 'user-service',
          responsibilities: ['用户管理', '认证', '授权'],
          database: 'users_db',
          apis: ['/api/users/*', '/api/auth/*']
        },
        {
          name: 'product-service',
          responsibilities: ['产品管理', '库存管理'],
          database: 'products_db',
          apis: ['/api/products/*', '/api/inventory/*']
        },
        {
          name: 'order-service',
          responsibilities: ['订单管理', '订单处理'],
          database: 'orders_db',
          apis: ['/api/orders/*']
        },
        {
          name: 'customer-service',
          responsibilities: ['客户管理', '客户关系管理'],
          database: 'customers_db',
          apis: ['/api/customers/*']
        },
        {
          name: 'notification-service',
          responsibilities: ['通知发送', '消息队列'],
          database: 'notifications_db',
          apis: ['/api/notifications/*']
        }
      ],
      sharedResources: [
        {
          name: 'cache-service',
          type: 'redis',
          purpose: '分布式缓存'
        },
        {
          name: 'message-queue',
          type: 'rabbitmq',
          purpose: '异步消息处理'
        },
        {
          name: 'file-storage',
          type: 's3',
          purpose: '文件存储服务'
        }
      ],
      migrationSteps: [
        '1. 数据库拆分和迁移',
        '2. 服务接口定义',
        '3. 服务实现',
        '4. API网关配置',
        '5. 监控和日志系统',
        '6. 渐进式迁移'
      ]
    };
  }

  // 生成服务代码模板
  static generateServiceTemplate(service: ServiceDefinition): string {
    return `
// ${service.name} - 微服务实现
import express from 'express';
import { logger } from './utils/logger';

const app = express();
const PORT = process.env.PORT || ${service.port};

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: '${service.name}',
    version: '${service.version}'
  });
});

// 业务逻辑端点
// TODO: 实现具体的业务逻辑

// 启动服务
app.listen(PORT, () => {
  logger.info('${service.name} 启动在端口 ${PORT}');
});

// 注册到服务注册中心
if (process.env.NODE_ENV === 'production') {
  registerService({
    id: '${service.id}',
    name: '${service.name}',
    type: '${service.type}',
    version: '${service.version}',
    host: process.env.HOST || 'localhost',
    port: PORT,
    healthEndpoint: '/health'
  });
}
    `;
  }
}

// 服务拆分计划
interface ServiceDecompositionPlan {
  services: Array<{
    name: string;
    responsibilities: string[];
    database: string;
    apis: string[];
  }>;
  sharedResources: Array<{
    name: string;
    type: string;
    purpose: string;
  }>;
  migrationSteps: string[];
}

// 数据一致性管理
class DataConsistencyManager {
  // 分布式事务
  async executeDistributedTransaction(
    operations: Array<{
      service: string;
      operation: string;
      data: any;
    }>
  ): Promise<void> {
    const transactionId = this.generateTransactionId();
    
    try {
      // 两阶段提交协议
      await this.preparePhase(operations, transactionId);
      await this.commitPhase(transactionId);
      
      console.log(`分布式事务 ${transactionId} 提交成功`);
    } catch (error) {
      // 回滚阶段
      await this.rollbackPhase(operations, transactionId);
      console.error(`分布式事务 ${transactionId} 回滚:`, error);
      throw error;
    }
  }

  // 准备阶段
  private async preparePhase(
    operations: any[],
    transactionId: string
  ): Promise<void> {
    for (const op of operations) {
      const service = await this.getServiceClient(op.service);
      await service.prepare(op.operation, op.data, transactionId);
    }
  }

  // 提交阶段
  private async commitPhase(transactionId: string): Promise<void> {
    // 通知所有参与服务提交
    const commitPromises = this.getParticipatingServices(transactionId).map(service =>
      service.commit(transactionId)
    );
    
    await Promise.all(commitPromises);
  }

  // 回滚阶段
  private async rollbackPhase(
    operations: any[],
    transactionId: string
  ): Promise<void> {
    for (const op of operations) {
      try {
        const service = await this.getServiceClient(op.service);
        await service.rollback(op.operation, op.data, transactionId);
      } catch (error) {
        console.error(`回滚操作失败:`, error);
      }
    }
  }

  // 生成事务ID
  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // 获取服务客户端
  private async getServiceClient(serviceName: string): Promise<any> {
    // 这里应该实现服务客户端的获取逻辑
    // 简化实现
    return null;
  }

  // 获取参与服务
  private getParticipatingServices(transactionId: string): any[] {
    // 从事务上下文获取参与的服务列表
    // 简化实现
    return [];
  }
}

// 导出主要组件
export {
  ServiceRegistryCenter,
  APIGateway,
  ServiceDecomposer,
  DataConsistencyManager,
  LoadBalancer
};

export type {
  ServiceDefinition,
  ServiceHealth,
  LoadBalancerConfig,
  RouteConfig,
  ServiceDecompositionPlan
};