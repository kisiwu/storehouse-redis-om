# @storehouse/redis-om
Redis OM manager for @storehouse/core.

## Installation

Make sure you have [@storehouse/core](https://www.npmjs.com/package/@storehouse/core), [redis](https://www.npmjs.com/package/redis) and [redis-om](https://www.npmjs.com/package/redis-om) installed.

```bash
$ npm install @storehouse/redis-om
```

## Usage

### Basic

movies.ts
```ts
import { Schema } from 'redis-om'

export const movieSchema = new Schema('movies', {
  title: { type: 'string' },
  rate: { type: 'number' }
})
```

index.ts
```ts
import { Storehouse } from '@storehouse/core';
import { RedisOMManager } from '@storehouse/redis-om';
import { movieSchema } from './movies';

// register
Storehouse.add({
  local: {
    // type: '@storehouse/redis-om' if you called Storehouse.setManagerType(RedisOMManager)
    type: RedisOMManager, 
    config: {
      // RedisClientOptions
      options: {
        socket: {
          host: 'redis://localhost:6379'
        }
      },
      
      // Schema[]
      models: [
        movieSchema
      ]
    }
  }
});
```

Once the manager registered, you can access it or directly get the connection or models.

```ts
import { Storehouse } from '@storehouse/core';
import { RedisOMManager } from '@storehouse/redis-om';
import { RedisConnection, Repository } from 'redis-om';

// connection
const conn = await Storehouse.getConnection<RedisConnection>();
if (conn) {
  await conn.connect()
  console.log('retrieved connection to redis');
}

// manager
const localManager = Storehouse.getManager<RedisOMManager>('local');
if (localManager) {
  // Creates indexes in Redis for use by the Repository#search method.
  await localManager.createIndexes()
  // model (Repository)
  const moviesModel = localManager.getModel('movies');
  if (moviesModel) {
    console.log('nb movies', await moviesModel.search().return.count());
  }
}

// model
const Movies = Storehouse.getModel<Repository>('movies');
if(Movies) {
  console.log('nb movies', await Movies.search().return.count());
}
```

### Helpers

There are methods to help you retrieve the connection, manager and models so you don't have to check if they are undefined.
Those methods throw an error when they fail.

```ts
import { Storehouse } from '@storehouse/core';
import { getConnection, getManager, getModel } from '@storehouse/redis-om';

// connection
const conn = getConnection(Storehouse, 'local');
await conn.connect()
console.log('retrieved connection to redis');

// manager
const manager = getManager(Storehouse, 'local');
manager.getModel('movies');

// model
const Movies = getModel(Storehouse, 'local', 'movies');
await Movies.createIndex()
console.log('nb movies', await Movies.search().return.count());
```

### Health Check Methods

#### isConnected()

Check if a manager's connection is currently active:

```ts
const connected = await manager.isConnected();
if (connected) {
  console.log('Connection is active');
}
```

#### healthCheck()

Perform a comprehensive health check on a manager's connection:

```ts
const health = await manager.healthCheck();

if (health?.healthy) {
  console.log(`✓ Healthy - ${health.message}`);
  console.log(`Latency: ${health.latency}ms`);
  console.log('Details:', health.details);
} else {
  console.error(`✗ Unhealthy - ${health?.message}`);
}
```

### Health Check Result Structure

The health check result extends Storehouse's `HealthCheckResult` interface:

```ts
export interface RedisOMHealthCheckResult extends HealthCheckResult {
  details: {
    name: string;
    isOpen: boolean;
    isReady: boolean;
    pingResponse?: string | Buffer<ArrayBufferLike>;
    models?: string[];
    latency?: string;
    [key: string]: unknown;
  };
}
```


## References

- [Documentation](https://kisiwu.github.io/storehouse/redis-om/latest/)
- [@storehouse/core](https://www.npmjs.com/package/@storehouse/core)
- [Redis OM Node.js](https://github.com/redis/redis-om-node)