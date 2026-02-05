import { IManager, ManagerArg } from '@storehouse/core/lib/manager';
import { Registry } from '@storehouse/core/lib/registry';
import { Schema, Repository, RedisConnection } from 'redis-om'
import Logger from '@novice1/logger';
import { RedisClientOptions, RedisClientType, RedisDefaultModules, RedisFunctions, RedisModules, RedisScripts, RespVersions, TypeMapping, createClient } from 'redis';
import { randomBytes } from 'node:crypto';


const Log = Logger.debugger('@storehouse/redis-om:manager');

export interface RedisOMManagerArg<M extends RedisModules = RedisDefaultModules, F extends RedisFunctions = RedisFunctions, S extends RedisScripts = RedisScripts, RESP extends RespVersions = 2, TYPE_MAPPING extends TypeMapping = TypeMapping> extends ManagerArg {
  config?: {
    models?: Schema[],
    options?: RedisClientOptions<M, F, S, RESP, TYPE_MAPPING>
  }
}

export function getModel(registry: Registry, managerName: string, modelName?: string): Repository {
  const model = registry.getModel<Repository | undefined>(managerName, modelName);
  if (!model) {
    throw new ReferenceError(`Could not find model "${modelName || managerName}"`);
  }
  return model;
}

export function getManager<M extends RedisOMManager = RedisOMManager>(registry: Registry, managerName?: string): M {
  const manager = registry.getManager<M>(managerName);
  if (!manager) {
    throw new ReferenceError(`Could not find manager "${managerName || registry.defaultManager}"`);
  }
  if (!(manager instanceof RedisOMManager)) {
    throw new TypeError(`Manager "${managerName || registry.defaultManager}" is not instance of RedisOMManager`);
  }
  return manager;
}

export function getConnection<M extends RedisModules = RedisDefaultModules, F extends RedisFunctions = RedisFunctions, S extends RedisScripts = RedisScripts, RESP extends RespVersions = 2, TYPE_MAPPING extends TypeMapping = TypeMapping>(registry: Registry, managerName?: string): RedisClientType<M, F, S, RESP, TYPE_MAPPING> {
  const conn = registry.getConnection<RedisClientType<M, F, S, RESP, TYPE_MAPPING>>(managerName);
  if (!conn) {
    throw new ReferenceError(`Could not find connection "${managerName || registry.defaultManager}"`);
  }
  return conn;
}

export class RedisOMManager<M extends RedisModules = RedisDefaultModules, F extends RedisFunctions = RedisFunctions, S extends RedisScripts = RedisScripts, RESP extends RespVersions = 2, TYPE_MAPPING extends TypeMapping = TypeMapping> implements IManager {
  static readonly type = '@storehouse/redis-om';

  #connection: RedisClientType<M, F, S, RESP, TYPE_MAPPING>;
  #repositories: Map<string, Repository>

  protected name: string;

  constructor(settings: RedisOMManagerArg<M, F, S, RESP, TYPE_MAPPING>) {
    this.name = settings.name || `RedisOM ${Date.now()}_${randomBytes(3).toString('hex')}`;
    this.#connection = createClient(settings?.config?.options);
    this.#repositories = new Map()

    settings.config?.models
      ?.forEach((schema) => {
        this.addModel(schema)
      });

    this.#registerConnectionEvents();

    Log.info(`[${this.name}] RedisConnection created. Must call "RedisConnection.connect()".`);
  }

  #registerConnectionEvents() {
    this.#connection.on('error', (err) => {
      Log.error(`[${this.name}] Redis Client Error`, err);
    }).on('connect', () => {
      Log.info(`[${this.name}] connecting ...`, this.name);
    }).on('ready', () => {
      Log.info(`[${this.name}] connected!`, this.name);
    }).on('end', () => {
      Log.info(`[${this.name}] disconnected!`, this.name);
    }).on('reconnecting', () => {
      Log.info(`[${this.name}] reconnecting ...`, this.name);
    });
  }

  protected addModel(m: Schema) {
    this.#repositories.set(m.schemaName, new Repository(m, this.#connection as unknown as RedisConnection));

    Log.debug(`[${this.name}] added model '${m.schemaName}'`);

    return m;
  }

  getConnection(): RedisClientType<M, F, S, RESP, TYPE_MAPPING> {
    return this.#connection;
  }

  async connect(): Promise<this> {
    await this.getConnection().connect();
    return this;
  }

  async close(): Promise<string | void> {
    return await this.#connection.quit()
  }

  async closeConnection(): Promise<string | void> {
    return await this.close();
  }

  getModel(name: string): Repository | undefined {
    return this.#repositories.get(name);
  }

  /**
   * Creates indexes in Redis for use by the Repository#search method. 
   * Does not create a new index for an index that hasn't changed. 
   * Requires that RediSearch and RedisJSON are installed on your instance of Redis.
   */
  async createIndexes(): Promise<void> {
    for (const entry of this.#repositories.entries()) {
      await entry[1].createIndex()
    }
  }

  /**
   * Removes existing indexes from Redis. 
   * Use this method if you want to swap out your indexes because your Entities have changed. 
   * Requires that RediSearch and RedisJSON are installed on your instance of Redis.
   */
  async dropIndexes(): Promise<void> {
    for (const entry of this.#repositories.entries()) {
      await entry[1].dropIndex()
    }
  }
}