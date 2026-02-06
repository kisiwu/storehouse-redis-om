import Logger from '@novice1/logger';
import {
  HealthCheckResult,
  IManager,
  ManagerArg,
  Registry,
  ModelNotFoundError,
  ManagerNotFoundError,
  InvalidManagerConfigError,
} from '@storehouse/core';
import { randomBytes } from 'node:crypto';
import {
  RedisClientOptions,
  RedisClientType,
  RedisDefaultModules,
  RedisFunctions,
  RedisModules,
  RedisScripts,
  RespVersions,
  TypeMapping,
  createClient,
} from 'redis';
import { Schema, Repository, RedisConnection, Entity } from 'redis-om';

const Log = Logger.debugger('@storehouse/redis-om:manager');

/**
 * Configuration argument for creating a RedisOMManager instance.
 *
 * @template M - Redis modules type, defaults to RedisDefaultModules
 * @template F - Redis functions type, defaults to RedisFunctions
 * @template S - Redis scripts type, defaults to RedisScripts
 * @template RESP - Redis RESP protocol version, defaults to 2
 * @template TYPE_MAPPING - Redis type mapping, defaults to TypeMapping
 *
 * @extends ManagerArg
 *
 * @example
 * ```typescript
 * const managerArg: RedisOMManagerArg = {
 *   name: 'my-redis-manager',
 *   config: {
 *     models: [userSchema, productSchema],
 *     options: {
 *       url: 'redis://localhost:6379'
 *     }
 *   }
 * };
 * ```
 */
export interface RedisOMManagerArg<
  M extends RedisModules = RedisDefaultModules,
  F extends RedisFunctions = RedisFunctions,
  S extends RedisScripts = RedisScripts,
  RESP extends RespVersions = 2,
  TYPE_MAPPING extends TypeMapping = TypeMapping,
> extends ManagerArg {
  /**
   * Optional configuration for the Redis manager.
   */
  config?: {
    /**
     * Array of Redis-OM schemas to register with the manager.
     * Each schema defines the structure of entities stored in Redis.
     */
    models?: Schema[];
    /**
     * Redis client connection options.
     * See redis client documentation for available options.
     */
    options?: RedisClientOptions<M, F, S, RESP, TYPE_MAPPING>;
  };
}

/**
 * Retrieves a Redis-OM Repository (model) from the registry.
 *
 * This function has two overload signatures:
 * 1. When called with 2 arguments, retrieves the model using the second argument as the model name from the default manager
 * 2. When called with 3 arguments, retrieves the model from a specific manager
 *
 * @template T - The entity type that defines the structure of data stored in the repository. Defaults to `Record<string, any>`
 *
 * @param registry - The Storehouse registry containing registered managers and models
 * @param modelName - When used with 2 arguments, this is the name of the model to retrieve
 * @returns The requested Redis-OM Repository
 *
 * @throws {ModelNotFoundError} If the model is not found in the registry
 *
 * @example
 * ```typescript
 * // Get model from default manager with typed entity
 * interface User {
 *   name: string;
 *   email: string;
 *   age: number;
 * }
 *
 * const userRepository = getModel<User>(registry, 'User');
 * const users = await userRepository.search().return.all();
 * // users will be typed as Array<User & Entity>
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getModel<T extends Record<string, any> = Record<string, any>>(
  registry: Registry,
  modelName: string
): Repository<T & Entity>;

/**
 * Retrieves a Redis-OM Repository (model) from a specific manager in the registry.
 *
 * @template T - The entity type that defines the structure of data stored in the repository. Defaults to `Record<string, any>`
 *
 * @param registry - The Storehouse registry containing registered managers and models
 * @param managerName - The name of the manager containing the model
 * @param modelName - The name of the specific model to retrieve
 * @returns The requested Redis-OM Repository typed with the entity structure
 *
 * @throws {ModelNotFoundError} If the model is not found in the registry
 *
 * @example
 * ```typescript
 * // Get model from specific manager with typed entity
 * interface Product {
 *   title: string;
 *   price: number;
 *   inStock: boolean;
 * }
 *
 * const productRepository = getModel<Product>(registry, 'redis-manager', 'Product');
 * const products = await productRepository.search().return.all();
 * // products will be typed as Array<Product & Entity>
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getModel<T extends Record<string, any> = Record<string, any>>(
  registry: Registry,
  managerName: string,
  modelName: string
): Repository<T & Entity>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getModel<T extends Record<string, any> = Record<string, any>>(
  registry: Registry,
  managerName: string,
  modelName?: string
): Repository<T & Entity> {
  const model = registry.getModel<Repository<T & Entity> | undefined>(managerName, modelName);
  if (!model) {
    throw new ModelNotFoundError(modelName || managerName, modelName ? managerName : undefined);
  }
  return model;
}

/**
 * Retrieves a RedisOMManager instance from the registry.
 *
 * @template M - The specific RedisOMManager type to return, defaults to RedisOMManager
 *
 * @param registry - The Storehouse registry containing registered managers
 * @param managerName - Optional name of the manager to retrieve. If omitted, retrieves the default manager
 *
 * @returns The requested RedisOMManager instance
 *
 * @throws {ManagerNotFoundError} If the manager is not found in the registry
 * @throws {InvalidManagerConfigError} If the manager exists but is not an instance of RedisOMManager
 *
 * @example
 * ```typescript
 * const redisManager = getManager(registry, 'redis-manager');
 * await redisManager.connect();
 * ```
 */
export function getManager<M extends RedisOMManager = RedisOMManager>(registry: Registry, managerName?: string): M {
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

/**
 * Retrieves the underlying Redis client connection from a manager in the registry.
 *
 * @template M - Redis modules type, defaults to RedisDefaultModules
 * @template F - Redis functions type, defaults to RedisFunctions
 * @template S - Redis scripts type, defaults to RedisScripts
 * @template RESP - Redis RESP protocol version, defaults to 2
 * @template TYPE_MAPPING - Redis type mapping, defaults to TypeMapping
 *
 * @param registry - The Storehouse registry containing registered managers
 * @param managerName - Optional name of the manager. If omitted, uses the default manager
 *
 * @returns The Redis client instance
 *
 * @throws {ManagerNotFoundError} If the manager is not found in the registry
 *
 * @example
 * ```typescript
 * const redisClient = getConnection(registry, 'redis-manager');
 * await redisClient.set('key', 'value');
 * const value = await redisClient.get('key');
 * ```
 */
export function getConnection<
  M extends RedisModules = RedisDefaultModules,
  F extends RedisFunctions = RedisFunctions,
  S extends RedisScripts = RedisScripts,
  RESP extends RespVersions = 2,
  TYPE_MAPPING extends TypeMapping = TypeMapping,
>(registry: Registry, managerName?: string): RedisClientType<M, F, S, RESP, TYPE_MAPPING> {
  const conn = registry.getConnection<RedisClientType<M, F, S, RESP, TYPE_MAPPING>>(managerName);
  if (!conn) {
    throw new ManagerNotFoundError(managerName || registry.defaultManager);
  }
  return conn;
}

/**
 * Extended health check result specific to Redis-OM managers.
 * Includes Redis connection status, ping response, and registered models.
 *
 * @extends HealthCheckResult
 */
export interface RedisOMHealthCheckResult extends HealthCheckResult {
  /**
   * Detailed information about the Redis connection health.
   */
  details: {
    /** The name of the manager */
    name: string;
    /** Whether the Redis connection is currently open */
    isOpen: boolean;
    /** Whether the Redis connection is ready to accept commands */
    isReady: boolean;
    /** The response from the Redis PING command */
    pingResponse?: string | Buffer<ArrayBufferLike>;
    /** List of registered model (schema) names */
    models?: string[];
    /** Time taken to perform the health check in milliseconds */
    latency?: string;
    /** Error message if the health check failed */
    error?: string;
    /** Additional custom properties */
    [key: string]: unknown;
  };
}

/**
 * Manager class for Redis-OM (Object Mapping) integration with Storehouse.
 * Provides connection management, model registration, and health checking for Redis databases.
 *
 * This manager wraps the Redis client and Redis-OM repositories, offering a unified interface
 * for working with Redis as a document store using the Redis-OM library.
 *
 * @template M - Redis modules type, defaults to RedisDefaultModules
 * @template F - Redis functions type, defaults to RedisFunctions
 * @template S - Redis scripts type, defaults to RedisScripts
 * @template RESP - Redis RESP protocol version, defaults to 2
 * @template TYPE_MAPPING - Redis type mapping, defaults to TypeMapping
 *
 * @implements {IManager}
 *
 * @example
 * ```typescript
 * const manager = new RedisOMManager({
 *   name: 'redis-main',
 *   config: {
 *     models: [userSchema, productSchema],
 *     options: {
 *       url: 'redis://localhost:6379',
 *       database: 0
 *     }
 *   }
 * });
 *
 * await manager.connect();
 * await manager.createIndexes();
 *
 * const userRepo = manager.getModel('User');
 * const users = await userRepo.search().return.all();
 * ```
 */
export class RedisOMManager<
  M extends RedisModules = RedisDefaultModules,
  F extends RedisFunctions = RedisFunctions,
  S extends RedisScripts = RedisScripts,
  RESP extends RespVersions = 2,
  TYPE_MAPPING extends TypeMapping = TypeMapping,
> implements IManager {
  /**
   * Identifier for the manager type.
   * @readonly
   */
  static readonly type = '@storehouse/redis-om';

  #connection: RedisClientType<M, F, S, RESP, TYPE_MAPPING>;
  #repositories: Map<string, Repository>;

  /**
   * The name of this manager instance.
   * @protected
   */
  protected name: string;

  /**
   * Creates a new RedisOMManager instance.
   *
   * @param settings - Configuration settings for the manager
   *
   * @remarks
   * The connection is created but not opened. You must call `connect()` to establish the connection.
   * Connection events (error, connect, ready, end, reconnecting) are automatically registered and logged.
   */
  constructor(settings: RedisOMManagerArg<M, F, S, RESP, TYPE_MAPPING>) {
    this.name = settings.name || `RedisOM ${Date.now()}_${randomBytes(3).toString('hex')}`;
    this.#connection = createClient(settings?.config?.options);
    this.#repositories = new Map();

    settings.config?.models?.forEach((schema) => {
      this.addModel(schema);
    });

    this.#registerConnectionEvents();

    Log.info(`[${this.name}] RedisConnection created. Must call "RedisConnection.connect()".`);
  }

  /**
   * Registers event listeners for Redis connection lifecycle events.
   * Logs connection state changes for debugging and monitoring.
   *
   * @private
   */
  #registerConnectionEvents() {
    this.#connection
      .on('error', (err) => {
        Log.error(`[${this.name}] Redis Client Error`, err);
      })
      .on('connect', () => {
        Log.info(`[${this.name}] connecting ...`, this.name);
      })
      .on('ready', () => {
        Log.info(`[${this.name}] connected!`, this.name);
      })
      .on('end', () => {
        Log.warn(`[${this.name}] disconnected!`, this.name);
      })
      .on('reconnecting', () => {
        Log.info(`[${this.name}] reconnecting ...`, this.name);
      });
  }

  /**
   * Adds a Redis-OM schema as a model to this manager.
   * Creates a Repository instance for the schema and stores it internally.
   *
   * @param m - The Redis-OM schema to add
   * @returns The added schema
   *
   * @protected
   */
  protected addModel(m: Schema) {
    this.#repositories.set(m.schemaName, new Repository(m, this.#connection as unknown as RedisConnection));
    Log.debug(`[${this.name}] added model '${m.schemaName}'`);
    return m;
  }

  /**
   * Gets the underlying Redis client connection.
   *
   * @returns The Redis client instance
   *
   * @example
   * ```typescript
   * const client = manager.getConnection();
   * await client.set('mykey', 'myvalue');
   * ```
   */
  getConnection(): RedisClientType<M, F, S, RESP, TYPE_MAPPING> {
    return this.#connection;
  }

  /**
   * Establishes the connection to Redis.
   *
   * @returns A promise that resolves to this manager instance for method chaining
   *
   * @throws {Error} If the connection cannot be established
   *
   * @example
   * ```typescript
   * await manager.connect();
   * ```
   */
  async connect(): Promise<this> {
    await this.getConnection().connect();
    return this;
  }

  /**
   * Closes the Redis connection gracefully using the QUIT command.
   *
   * @returns A promise that resolves to the Redis server's response to the QUIT command
   *
   * @example
   * ```typescript
   * await manager.close();
   * ```
   */
  async close(): Promise<string> {
    return await this.#connection.quit();
  }

  /**
   * Alias for `close()`. Closes the Redis connection gracefully.
   *
   * @returns A promise that resolves to the Redis server's response to the QUIT command
   *
   * @example
   * ```typescript
   * await manager.closeConnection();
   * ```
   */
  async closeConnection(): Promise<string> {
    return await this.close();
  }

  /**
   * Retrieves a registered Redis-OM Repository by its schema name.
   *
   * @template T - The entity type that defines the structure of data stored in the repository. Defaults to `Record<string, any>`
   *
   * @param name - The schema name of the model to retrieve
   * @returns The Repository instance typed with the entity structure, or undefined if not found
   *
   * @example
   * ```typescript
   * // Without type parameter
   * const userRepo = manager.getModel('User');
   * if (userRepo) {
   *   const users = await userRepo.search().return.all();
   * }
   *
   * // With typed entity
   * interface User {
   *   name: string;
   *   email: string;
   *   age: number;
   * }
   *
   * const userRepo = manager.getModel<User>('User');
   * if (userRepo) {
   *   const users = await userRepo.search().return.all();
   *   // users will be typed as Array<User & Entity>
   * }
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getModel<T extends Record<string, any> = Record<string, any>>(name: string): Repository<T & Entity> | undefined {
    return this.#repositories.get(name) as Repository<T & Entity> | undefined;
  }

  /**
   * Creates indexes in Redis for use by the Repository#search method.
   * Does not create a new index for an index that hasn't changed.
   * Requires that RediSearch and RedisJSON are installed on your instance of Redis.
   *
   * @returns A promise that resolves when all indexes are created
   *
   * @throws {Error} If RediSearch or RedisJSON modules are not available
   *
   * @example
   * ```typescript
   * await manager.createIndexes();
   * ```
   */
  async createIndexes(): Promise<void> {
    for (const [_, repository] of this.#repositories.entries()) {
      await repository.createIndex();
    }
  }

  /**
   * Removes existing indexes from Redis.
   * Use this method if you want to swap out your indexes because your Entities have changed.
   * Requires that RediSearch and RedisJSON are installed on your instance of Redis.
   *
   * @returns A promise that resolves when all indexes are dropped
   *
   * @throws {Error} If RediSearch or RedisJSON modules are not available
   *
   * @example
   * ```typescript
   * await manager.dropIndexes();
   * await manager.createIndexes(); // Recreate with new schema
   * ```
   */
  async dropIndexes(): Promise<void> {
    for (const [_, repository] of this.#repositories.entries()) {
      await repository.dropIndex();
    }
  }

  /**
   * Checks if the Redis connection is currently open.
   *
   * @returns A promise that resolves to true if connected, false otherwise
   *
   * @example
   * ```typescript
   * if (await manager.isConnected()) {
   *   console.log('Redis is connected');
   * }
   * ```
   */
  async isConnected(): Promise<boolean> {
    return this.#connection.isOpen;
  }

  /**
   * Performs a comprehensive health check on the Redis connection.
   * Tests connectivity by sending a PING command and gathering connection metrics.
   *
   * @returns A promise that resolves to a detailed health check result including:
   * - Connection status (open/ready)
   * - Ping response
   * - Registered models
   * - Response latency
   * - Error details (if unhealthy)
   *
   * @example
   * ```typescript
   * const health = await manager.healthCheck();
   * if (health.healthy) {
   *   console.log(`Redis is healthy. Latency: ${health.details.latency}`);
   *   console.log(`Models: ${health.details.models?.join(', ')}`);
   * } else {
   *   console.error(`Redis is unhealthy: ${health.message}`);
   * }
   * ```
   */
  async healthCheck(): Promise<RedisOMHealthCheckResult> {
    const start = Date.now();
    const timestamp = start;

    if (!this.#connection.isOpen) {
      return {
        healthy: false,
        message: 'Redis connection is not open',
        details: {
          name: this.name,
          isOpen: this.#connection.isOpen,
          isReady: this.#connection.isReady,
        },
        timestamp,
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
          latency: `${latency}ms`,
        },
        latency,
        timestamp,
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Redis health check failed: ${error instanceof Error ? error.message : String(error)}`,
        details: {
          name: this.name,
          isOpen: this.#connection.isOpen,
          isReady: this.#connection.isReady,
          error: error instanceof Error ? error.stack : String(error),
        },
        latency: Date.now() - start,
        timestamp,
      };
    }
  }
}
