import { IManager, ManagerArg } from '@storehouse/core/lib/manager';
import { Registry } from '@storehouse/core/lib/registry';
import { Schema, Repository, RedisConnection } from 'redis-om'
import Logger from '@novice1/logger';
import { RedisClientOptions, createClient } from 'redis';


const Log = Logger.debugger('@storehouse/redis-om:manager');

export interface RedisOMManagerArg extends ManagerArg {
  config?: {
    models: Schema[],
    options?: RedisClientOptions
  }
}

export function getModel(registry: Registry, managerName: string, modelName?: string): Repository | undefined {
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

export function getConnection(registry: Registry, managerName?: string): RedisConnection {
  const conn = registry.getConnection<RedisConnection>(managerName);
  if (!conn) {
    throw new ReferenceError(`Could not find connection "${managerName || registry.defaultManager}"`);
  }
  return conn;
}

export class RedisOMManager implements IManager {
  static readonly type = '@storehouse/redis-om';

  #connection: RedisConnection;
  #repositories: Map<string, Repository>

  protected name: string;

  constructor(settings: RedisOMManagerArg) {
    this.name = settings.name || `RedisOM ${Date.now()}_${Math.ceil(Math.random() * 10000) + 10}`;
    this.#connection = createClient(settings?.config?.options);
    this.#repositories = new Map()

    settings.config?.models
      .forEach((schema) => {
        this._addModel(schema)
      });

    this._registerConnectionEvents();

    Log.info('[%s] RedisConnection created. Must call "RedisConnection.connect()".', this.name);
  }

  private _registerConnectionEvents() {
    this.#connection.on('error', (err) => {
      Log.info(`[${this.name}] Redis Client Error`, err);
    });
  }

  private _addModel(m: Schema) {
    this.#repositories.set(m.schemaName, new Repository(m, this.#connection));

    Log('[%s] added model \'%s\'', this.name, m.schemaName);

    return m;
  }

  async connect(): Promise<this> {
    await this.getConnection().connect();
    return this;
  }

  getConnection(): RedisConnection {
    return this.#connection;
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
}