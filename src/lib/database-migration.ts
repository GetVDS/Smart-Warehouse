import { db } from './db';
import { logger } from './logger';

// 数据库迁移接口
interface Migration {
  id: string;
  name: string;
  version: string;
  description: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
  appliedAt?: Date;
}

// 数据库迁移管理器
class DatabaseMigrationManager {
  private migrations: Migration[] = [];
  private migrationTable = '_migrations';

  constructor() {
    this.initializeMigrations();
  }

  // 初始化迁移列表
  private initializeMigrations(): void {
    this.migrations = [
      {
        id: '001',
        name: 'initial_schema',
        version: '1.0.0',
        description: '初始数据库架构',
        up: async () => {
          // 初始架构已在Prisma schema中定义
          logger.info('初始数据库架构已应用');
        },
        down: async () => {
          // 清理所有数据（谨慎使用）
          await db.$executeRaw`DELETE FROM OrderItem`;
          await db.$executeRaw`DELETE FROM Order`;
          await db.$executeRaw`DELETE FROM PurchaseRecord`;
          await db.$executeRaw`DELETE FROM Product`;
          await db.$executeRaw`DELETE FROM Customer`;
          await db.$executeRaw`DELETE FROM User`;
          logger.info('数据库架构已回滚到初始状态');
        }
      },
      {
        id: '002',
        name: 'add_indexes',
        version: '1.1.0',
        description: '添加数据库索引以提高查询性能',
        up: async () => {
          try {
            // 添加索引
            await db.$executeRaw`
              CREATE INDEX IF NOT EXISTS idx_customer_phone ON Customer(phone)
            `;
            await db.$executeRaw`
              CREATE INDEX IF NOT EXISTS idx_order_customer_id ON Order(customerId)
            `;
            await db.$executeRaw`
              CREATE INDEX IF NOT EXISTS idx_order_created_at ON Order(createdAt)
            `;
            await db.$executeRaw`
              CREATE INDEX IF NOT EXISTS idx_product_sku ON Product(sku)
            `;
            await db.$executeRaw`
              CREATE INDEX IF NOT EXISTS idx_orderitem_order_id ON OrderItem(orderId)
            `;
            await db.$executeRaw`
              CREATE INDEX IF NOT EXISTS idx_orderitem_product_id ON OrderItem(productId)
            `;
            await db.$executeRaw`
              CREATE INDEX IF NOT EXISTS idx_purchase_customer_id ON PurchaseRecord(customerId)
            `;
            await db.$executeRaw`
              CREATE INDEX IF NOT EXISTS idx_purchase_product_id ON PurchaseRecord(productId)
            `;
            
            logger.info('数据库索引已添加');
          } catch (error) {
            logger.error('添加索引失败:', error instanceof Error ? error.message : String(error));
            throw error;
          }
        },
        down: async () => {
          try {
            // 删除索引
            await db.$executeRaw`DROP INDEX IF EXISTS idx_customer_phone`;
            await db.$executeRaw`DROP INDEX IF EXISTS idx_order_customer_id`;
            await db.$executeRaw`DROP INDEX IF EXISTS idx_order_created_at`;
            await db.$executeRaw`DROP INDEX IF EXISTS idx_product_sku`;
            await db.$executeRaw`DROP INDEX IF EXISTS idx_orderitem_order_id`;
            await db.$executeRaw`DROP INDEX IF EXISTS idx_orderitem_product_id`;
            await db.$executeRaw`DROP INDEX IF EXISTS idx_purchase_customer_id`;
            await db.$executeRaw`DROP INDEX IF EXISTS idx_purchase_product_id`;
            
            logger.info('数据库索引已删除');
          } catch (error) {
            logger.error('删除索引失败:', error instanceof Error ? error.message : String(error));
            throw error;
          }
        }
      },
      {
        id: '003',
        name: 'add_audit_tables',
        version: '1.2.0',
        description: '添加审计表用于数据追踪',
        up: async () => {
          try {
            // 创建审计表
            await db.$executeRaw`
              CREATE TABLE IF NOT EXISTS audit_log (
                id TEXT PRIMARY KEY,
                table_name TEXT NOT NULL,
                record_id TEXT NOT NULL,
                action TEXT NOT NULL,
                old_values TEXT,
                new_values TEXT,
                user_id TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                ip_address TEXT
              )
            `;
            
            await db.$executeRaw`
              CREATE TABLE IF NOT EXISTS performance_metrics (
                id TEXT PRIMARY KEY,
                metric_name TEXT NOT NULL,
                metric_value REAL NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                additional_data TEXT
              )
            `;
            
            logger.info('审计表已创建');
          } catch (error) {
            logger.error('创建审计表失败:', error instanceof Error ? error.message : String(error));
            throw error;
          }
        },
        down: async () => {
          try {
            await db.$executeRaw`DROP TABLE IF EXISTS audit_log`;
            await db.$executeRaw`DROP TABLE IF EXISTS performance_metrics`;
            
            logger.info('审计表已删除');
          } catch (error) {
            logger.error('删除审计表失败:', error instanceof Error ? error.message : String(error));
            throw error;
          }
        }
      }
    ];
  }

  // 创建迁移记录表
  private async createMigrationTable(): Promise<void> {
    try {
      await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS ${this.migrationTable} (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          version TEXT NOT NULL,
          description TEXT,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;
    } catch (error) {
      logger.error('创建迁移表失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // 获取已应用的迁移
  private async getAppliedMigrations(): Promise<Migration[]> {
    try {
      const result = await db.$queryRawUnsafe(`
        SELECT id, name, version, description, applied_at 
        FROM ${this.migrationTable} 
        ORDER BY applied_at ASC
      `) as any[];
      
      return result.map(row => ({
        id: row.id,
        name: row.name,
        version: row.version,
        description: row.description,
        up: async () => {}, // 占位符
        down: async () => {}, // 占位符
        appliedAt: new Date(row.applied_at)
      }));
    } catch (error) {
      // 如果表不存在，返回空数组
      return [];
    }
  }

  // 记录迁移应用
  private async recordMigration(migration: Migration): Promise<void> {
    try {
      await db.$executeRawUnsafe(`
        INSERT INTO ${this.migrationTable} (id, name, version, description) 
        VALUES (?, ?, ?, ?)
      `, [migration.id, migration.name, migration.version, migration.description]);
      
      logger.info(`迁移 ${migration.name} 已记录`);
    } catch (error) {
      logger.error('记录迁移失败:', error);
      throw error;
    }
  }

  // 执行单个迁移
  private async applyMigration(migration: Migration): Promise<void> {
    logger.info(`应用迁移: ${migration.name} (${migration.version})`);
    
    const startTime = Date.now();
    
    try {
      await migration.up();
      await this.recordMigration(migration);
      
      const duration = Date.now() - startTime;
      logger.info(`迁移 ${migration.name} 应用成功，耗时: ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`迁移 ${migration.name} 应用失败，耗时: ${duration}ms`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // 回滚单个迁移
  private async rollbackMigration(migration: Migration): Promise<void> {
    logger.info(`回滚迁移: ${migration.name} (${migration.version})`);
    
    const startTime = Date.now();
    
    try {
      await migration.down();
      
      // 从迁移记录中删除
      await db.$executeRawUnsafe(`
        DELETE FROM ${this.migrationTable} WHERE id = ?
      `, [migration.id]);
      
      const duration = Date.now() - startTime;
      logger.info(`迁移 ${migration.name} 回滚成功，耗时: ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`迁移 ${migration.name} 回滚失败，耗时: ${duration}ms`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // 运行迁移
  async migrate(targetVersion?: string): Promise<void> {
    logger.info('开始数据库迁移');
    
    try {
      // 创建迁移记录表
      await this.createMigrationTable();
      
      // 获取已应用的迁移
      const appliedMigrations = await this.getAppliedMigrations();
      const appliedIds = new Set(appliedMigrations.map(m => m.id));
      
      // 找出需要应用的迁移
      const pendingMigrations = this.migrations.filter(m => !appliedIds.has(m.id));
      
      if (targetVersion) {
        // 如果指定了目标版本，只应用到该版本的迁移
        const targetIndex = this.migrations.findIndex(m => m.version === targetVersion);
        if (targetIndex === -1) {
          throw new Error(`目标版本 ${targetVersion} 不存在`);
        }
        
        const targetMigrations = this.migrations.slice(0, targetIndex + 1);
        const filteredPending = targetMigrations.filter(m => !appliedIds.has(m.id));
        
        for (const migration of filteredPending) {
          await this.applyMigration(migration);
        }
      } else {
        // 应用所有待处理的迁移
        for (const migration of pendingMigrations) {
          await this.applyMigration(migration);
        }
      }
      
      logger.info('数据库迁移完成');
    } catch (error) {
      logger.error('数据库迁移失败:', error);
      throw error;
    }
  }

  // 回滚迁移
  async rollback(targetVersion?: string): Promise<void> {
    logger.info('开始数据库回滚');
    
    try {
      // 获取已应用的迁移
      const appliedMigrations = await this.getAppliedMigrations();
      
      if (appliedMigrations.length === 0) {
        logger.warn('没有已应用的迁移可以回滚');
        return;
      }
      
      let migrationsToRollback: Migration[];
      
      if (targetVersion) {
        // 回滚到指定版本
        const targetIndex = this.migrations.findIndex(m => m.version === targetVersion);
        if (targetIndex === -1) {
          throw new Error(`目标版本 ${targetVersion} 不存在`);
        }
        
        migrationsToRollback = appliedMigrations.filter(m => {
          const migrationIndex = this.migrations.findIndex(mig => mig.id === m.id);
          return migrationIndex > targetIndex;
        });
      } else {
        // 回滚最后一个迁移
        migrationsToRollback = appliedMigrations.length > 0 ? [appliedMigrations[appliedMigrations.length - 1]!] : [];
      }
      
      // 按应用时间倒序回滚
      const sortedMigrations = migrationsToRollback.sort((a, b) => 
        (b.appliedAt?.getTime() || 0) - (a.appliedAt?.getTime() || 0)
      );
      
      for (const migration of sortedMigrations) {
        await this.rollbackMigration(migration);
      }
      
      logger.info('数据库回滚完成');
    } catch (error) {
      logger.error('数据库回滚失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // 获取迁移状态
  async getMigrationStatus(): Promise<{
    currentVersion: string;
    appliedMigrations: Migration[];
    pendingMigrations: Migration[];
  }> {
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedIds = new Set(appliedMigrations.map(m => m.id));
    const pendingMigrations = this.migrations.filter(m => !appliedIds.has(m.id));
    
    const currentVersion = appliedMigrations.length > 0
      ? (appliedMigrations[appliedMigrations.length - 1]?.version || '0.0.0')
      : '0.0.0';
    
    return {
      currentVersion,
      appliedMigrations,
      pendingMigrations
    };
  }
}

// 数据库备份和恢复
export class DatabaseBackupManager {
  private backupPath: string;

  constructor(backupPath: string = './backups') {
    this.backupPath = backupPath;
  }

  // 创建数据库备份
  async createBackup(description?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}${description ? '_' + description : ''}.db`;
    const fullPath = `${this.backupPath}/${filename}`;
    
    try {
      // 确保备份目录存在
      const fs = require('fs').promises;
      await fs.mkdir(this.backupPath, { recursive: true });
      
      // 复制数据库文件
      const currentDbPath = process.env.DATABASE_URL?.replace('file:', '');
      if (currentDbPath) {
        await fs.copyFile(currentDbPath, fullPath);
        
        logger.info(`数据库备份已创建: ${fullPath}`);
        return fullPath;
      } else {
        throw new Error('无法确定数据库文件路径');
      }
    } catch (error) {
      logger.error('创建数据库备份失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // 恢复数据库备份
  async restoreBackup(backupFile: string): Promise<void> {
    try {
      const fs = require('fs').promises;
      
      // 验证备份文件存在
      await fs.access(backupFile);
      
      // 恢复数据库文件
      const currentDbPath = process.env.DATABASE_URL?.replace('file:', '');
      if (currentDbPath) {
        // 创建当前数据库的备份
        await this.createBackup('before_restore');
        
        // 恢复备份
        await fs.copyFile(backupFile, currentDbPath);
        
        logger.info(`数据库已从备份恢复: ${backupFile}`);
      } else {
        throw new Error('无法确定数据库文件路径');
      }
    } catch (error) {
      logger.error('恢复数据库备份失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // 列出可用备份
  async listBackups(): Promise<Array<{
    filename: string;
    path: string;
    size: number;
    createdAt: Date;
  }>> {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      const files = await fs.readdir(this.backupPath);
      const backups = [];
      
      for (const file of files) {
        if (file.startsWith('backup_') && file.endsWith('.db')) {
          const fullPath = path.join(this.backupPath, file);
          const stats = await fs.stat(fullPath);
          
          // 从文件名提取时间戳
          const timestampMatch = file.match(/backup_(.+?)(?:_.*)?\.db/);
          if (timestampMatch) {
            const timestamp = timestampMatch[1].replace(/-/g, ':');
            backups.push({
              filename: file,
              path: fullPath,
              size: stats.size,
              createdAt: new Date(timestamp)
            });
          }
        }
      }
      
      return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      logger.error('列出备份失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

// 导出实例
export const migrationManager = new DatabaseMigrationManager();
export const backupManager = new DatabaseBackupManager();

// 便捷函数
export async function runMigrations(targetVersion?: string): Promise<void> {
  return migrationManager.migrate(targetVersion);
}

export async function rollbackDatabase(targetVersion?: string): Promise<void> {
  return migrationManager.rollback(targetVersion);
}

export async function getDatabaseStatus(): Promise<any> {
  return migrationManager.getMigrationStatus();
}

export async function createDatabaseBackup(description?: string): Promise<string> {
  return backupManager.createBackup(description);
}

export async function restoreDatabaseBackup(backupFile: string): Promise<void> {
  return backupManager.restoreBackup(backupFile);
}