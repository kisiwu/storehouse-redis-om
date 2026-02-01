## Health check

```ts
import { HealthCheckResult } from '@storehouse/core/lib/manager';

export class RedisOMManager implements IManager {
  // ... existing code ...

  isConnected(): boolean {
    return this.#connection.isOpen;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    const timestamp = start;

    if (!this.#connection.isOpen) {
      return {
        healthy: false,
        message: 'Redis connection is not open',
        details: {
          name: this.name,
          isOpen: this.#connection.isOpen,
          isReady: this.#connection.isReady
        },
        timestamp
      };
    }

    try {
      // Ping Redis to check connection
      const pingResult = await this.#connection.ping();
      
      const latency = Date.now() - start;
      
      return {
        healthy: true,
        message: 'Redis connection is healthy',
        details: {
          name: this.name,
          isOpen: this.#connection.isOpen,
          isReady: this.#connection.isReady,
          pingResponse: pingResult,
          models: Array.from(this.#repositories.keys()),
          latency: `${latency}ms`
        },
        latency,
        timestamp
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Redis health check failed: ${error instanceof Error ? error.message : String(error)}`,
        details: {
          name: this.name,
          isOpen: this.#connection.isOpen,
          isReady: this.#connection.isReady,
          error: error instanceof Error ? error.stack : String(error)
        },
        latency: Date.now() - start,
        timestamp
      };
    }
  }
}
```

## Import Custom Error Classes

```ts
import { 
  IManager, 
  ManagerArg,
  HealthCheckResult 
} from '@storehouse/core/lib/manager';
import { Registry } from '@storehouse/core/lib/registry';
import { 
  ModelNotFoundError,
  ManagerNotFoundError,
  InvalidManagerConfigError
} from '@storehouse/core/lib/errors';
import { Schema, Repository, RedisConnection } from 'redis-om';
import Logger from '@novice1/logger';
import { RedisClientOptions, createClient } from 'redis';

export function getModel(
  registry: Registry, 
  managerName: string, 
  modelName?: string
): Repository {
  const model = registry.getModel<Repository | undefined>(managerName, modelName);
  if (!model) {
    throw new ModelNotFoundError(
      modelName || managerName,
      modelName ? managerName : undefined
    );
  }
  return model;
}

export function getManager<M extends RedisOMManager = RedisOMManager>(
  registry: Registry, 
  managerName?: string
): M {
  const manager = registry.getManager<M>(managerName);
  if (!manager) {
    throw new ManagerNotFoundError(managerName || registry.defaultManager);
  }
  if (!(manager instanceof RedisOMManager)) {
    throw new InvalidManagerConfigError(
      `Manager "${managerName || registry.defaultManager}" is not instance of RedisOMManager`
    );
  }
  return manager;
}

export function getConnection(registry: Registry, managerName?: string): RedisConnection {
  const conn = registry.getConnection<RedisConnection>(managerName);
  if (!conn) {
    throw new ManagerNotFoundError(managerName || registry.defaultManager);
  }
  return conn;
}
```