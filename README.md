# @storehouse/redis-om

Redis-OM manager adapter for [@storehouse/core](https://www.npmjs.com/package/@storehouse/core). Provides seamless integration with [Redis](https://redis.io/) using the [Redis-OM](https://github.com/redis/redis-om-node) object mapping library.

## Features

- **Type-safe Redis operations** with Redis-OM object mapping
- **Schema-based models** for structured data storage
- **Full-text search** support with RediSearch
- **Connection lifecycle management** with automatic event logging
- **Health check utilities** for monitoring
- **Multi-manager support** via Storehouse registry

## Prerequisites

- **Redis server** with [RediSearch](https://redis.io/docs/stack/search/) and [RedisJSON](https://redis.io/docs/stack/json/) modules (for search functionality)
- **Node.js** 16 or higher

## Installation

```bash
npm install @storehouse/core redis redis-om @storehouse/redis-om
```

## Quick Start

### 1. Define Your Schemas

Create Redis-OM schemas to define your data structures:

**schemas/movie.ts**
```ts
import { Schema } from 'redis-om'

export const movieSchema = new Schema('movies', {
  title: { type: 'string' },
  director: { type: 'string' },
  year: { type: 'number' },
  rating: { type: 'number' },
  genres: { type: 'string[]' }
})
```

### 2. Register the Manager

**index.ts**
```ts
import { Storehouse } from '@storehouse/core';
import { RedisOMManager } from '@storehouse/redis-om';
import { movieSchema } from './schemas/movie';

// Register the manager
Storehouse.add({
  redis: {
    type: RedisOMManager, 
    config: {
      // Redis client connection options
      options: {
        socket: {
          host: 'localhost',
          port: 6379
        }
      },
      // Register your schemas
      models: [movieSchema]
    }
  }
});
```

### 3. Connect and Use

```ts
import { Storehouse } from '@storehouse/core';
import { RedisOMManager } from '@storehouse/redis-om';
import { Repository } from 'redis-om';
import { RedisClientType } from 'redis';

// Get the manager
const manager = Storehouse.getManager<RedisOMManager>('redis');

if (manager) {
  // Connect to Redis
  await manager.connect();

  // Create search indexes (required for Repository#search)
  await manager.createIndexes();
  
  // Get a repository
  const moviesRepo = manager.getModel('movies');

  if (moviesRepo) {
    // Create a new movie
    const movie = await moviesRepo.save({
      title: 'Inception',
      director: 'Christopher Nolan',
      year: 2010,
      rating: 8.8,
      genres: ['Sci-Fi', 'Thriller']
    });
    
    console.log('Created movie:', movie);
    
    // Search for movies
    const sciFiMovies = await moviesRepo
      .search()
      .where('genres').contains('Sci-Fi')
      .return.all();
    
    console.log('Sci-Fi movies:', sciFiMovies.length);
    
    // Get total count
    const count = await moviesRepo.search().return.count();
    console.log('Total movies:', count);
  }
}
```

## API Reference

### Helper Functions

The package provides helper functions that throw errors instead of returning undefined, making your code cleaner and safer.

#### `getManager()`

Retrieves a RedisOMManager instance from the registry.

```ts
import { Storehouse } from '@storehouse/core';
import { getManager } from '@storehouse/redis-om';

const manager = getManager(Storehouse, 'redis');
await manager.connect();
```

**Throws:**
- `ManagerNotFoundError` - If the manager doesn't exist
- `InvalidManagerConfigError` - If the manager is not a RedisOMManager instance

#### `getConnection()`

Retrieves the underlying Redis client connection.

```ts
import { Storehouse } from '@storehouse/core';
import { getConnection } from '@storehouse/redis-om';

const client = getConnection(Storehouse, 'redis');

// Use Redis client directly
await client.set('key', 'value');
const value = await client.get('key');
```

**Throws:**
- `ManagerNotFoundError` - If the manager doesn't exist

#### `getModel()`

Retrieves a Redis-OM Repository by name.

```ts
import { Storehouse } from '@storehouse/core';
import { getModel } from '@storehouse/redis-om';

// Get model from default manager
const movies = getModel(Storehouse, 'movies');

// Get model from specific manager
const users = getModel(Storehouse, 'redis', 'users');

// Use the repository
await movies.createIndex();
const count = await movies.search().return.count();
```

**Throws:**
- `ModelNotFoundError` - If the model doesn't exist


### RedisOMManager Class

#### Methods

##### `connect(): Promise<this>`

Establishes connection to Redis.

```ts
await manager.connect();
```

##### `close(): Promise<string>`

Closes the Redis connection gracefully using QUIT command.

```ts
await manager.close();
```

##### `getConnection(): RedisClientType`

Returns the underlying Redis client instance.

```ts
const client = manager.getConnection();
await client.ping();
```

##### `getModel<T>(name: string): Repository<T & Entity> | undefined`

Retrieves a registered repository by schema name.

```ts
const moviesRepo = manager.getModel('movies');
```

##### `createIndexes(): Promise<void>`

Creates search indexes for all registered repositories. Required for using `Repository#search()`.

**Requires:** RediSearch and RedisJSON modules installed on Redis.

```ts
await manager.createIndexes();
```

##### `dropIndexes(): Promise<void>`

Removes all existing indexes. Useful when schemas change.

**Requires:** RediSearch and RedisJSON modules installed on Redis.

```ts
await manager.dropIndexes();
await manager.createIndexes(); // Recreate with updated schemas
```

##### `isConnected(): Promise<boolean>`

Checks if the connection is currently active.

```ts
const connected = await manager.isConnected();
if (connected) {
  console.log('Redis is connected');
}
```

##### `healthCheck(): Promise<RedisOMHealthCheckResult>`

Performs a comprehensive health check including ping test and latency measurement.

```ts
const health = await manager.healthCheck();

if (health.healthy) {
  console.log(`✓ Redis is healthy`);
  console.log(`  Latency: ${health.details.latency}`);
  console.log(`  Models: ${health.details.models?.join(', ')}`);
  console.log(`  Ping: ${health.details.pingResponse}`);
} else {
  console.error(`✗ Redis is unhealthy: ${health.message}`);
}
```

### Health Check Result

The health check returns a detailed result object with the following structure:

- `healthy: boolean` - Overall health status
- `message: string` - Descriptive message about the health status
- `timestamp: number` - Timestamp when the health check was performed
- `latency?: number` - Response time in milliseconds
- `details: object` - Detailed connection information
  - `name: string` - Manager name
  - `isOpen: boolean` - Connection open status
  - `isReady: boolean` - Connection ready status
  - `pingResponse?: string | Buffer` - Redis PING response
  - `models?: string[]` - Registered model names
  - `latency?: string` - Response time in ms
  - `error?: string` - Error details (if unhealthy)

## Advanced Usage

### Multiple Managers

You can register multiple Redis connections:

```ts
Storehouse.add({
  cache: {
    type: RedisOMManager,
    config: {
      options: { url: 'redis://localhost:6379' },
      models: [sessionSchema]
    }
  },
  queue: {
    type: RedisOMManager,
    config: {
      options: { url: 'redis://localhost:6380' },
      models: [jobSchema]
    }
  }
});

// Access specific managers
const cacheManager = getManager(Storehouse, 'cache');
const queueManager = getManager(Storehouse, 'queue');
```

### Using the Manager Type

Set the manager type to simplify configuration and use string identifiers instead of class references:

```ts
import { Storehouse } from '@storehouse/core';
import { RedisOMManager } from '@storehouse/redis-om';

// Set default manager type
Storehouse.setManagerType(RedisOMManager);

// Now you can use type string instead of class
Storehouse.add({
  redis: {
    type: '@storehouse/redis-om',
    config: {
      options: { url: 'redis://localhost:6379' },
      models: [movieSchema]
    }
  }
});
```

### Direct Connection Access

Access the Redis client directly for advanced operations beyond what Redis-OM provides:

```ts
const client = getConnection(Storehouse, 'redis');

// Use Redis commands directly
await client.hSet('user:1000', {
  name: 'John',
  email: 'john@example.com'
});

const user = await client.hGetAll('user:1000');
```

### Connection Event Handling

The manager automatically logs connection lifecycle events. These are logged using the `@novice1/logger` package and can be enabled with Debug mode:

```ts
import { Debug } from '@novice1/logger';

Debug.enable('@storehouse/redis-om*');
```

**Events logged:**
- `error` - Connection errors
- `connect` - Connection initiated
- `ready` - Connection established
- `end` - Connection closed
- `reconnecting` - Reconnection attempt

## TypeScript Support

The package is written in TypeScript and provides full type definitions for type-safe operations:

```ts
import { RedisClientType } from 'redis';
import { Repository } from 'redis-om';
import { RedisOMManager, RedisOMHealthCheckResult } from '@storehouse/redis-om';

// Typed manager
const manager = getManager<RedisOMManager>(Storehouse, 'redis');

// Typed connection
const client: RedisClientType = getConnection(Storehouse, 'redis');

// Typed model
const movies = getModel<{ 
  title: string; 
  director: string; 
  year: number; 
  rating: number; 
  genres: string[]
  }>(Storehouse, 'movies');
```

## Error Handling

All helper functions throw specific errors for better error handling:
- `ManagerNotFoundError` - When a manager is not found in the registry
- `ModelNotFoundError` - When a model is not found
- `InvalidManagerConfigError` - When a manager is not of the expected type

```ts
import {
  getManager,
  getModel,
  getConnection
} from '@storehouse/redis-om';
import {
  ManagerNotFoundError,
  ModelNotFoundError,
  InvalidManagerConfigError
} from '@storehouse/core';

try {
  const manager = getManager(Storehouse, 'nonexistent');
} catch (error) {
  if (error instanceof ManagerNotFoundError) {
    console.error('Manager not found:', error.message);
  } else if (error instanceof InvalidManagerConfigError) {
    console.error('Invalid manager type:', error.message);
  }
}

try {
  const model = getModel(Storehouse, 'nonexistent');
} catch (error) {
  if (error instanceof ModelNotFoundError) {
    console.error('Model not found:', error.message);
  }
}
```

## Best Practices

1. **Always create indexes** - Call `createIndexes()` after connecting to enable search functionality
2. **Use health checks** - Monitor connection health in production environments
3. **Handle disconnections** - Implement reconnection and retry logic for critical operations
4. **Close connections** - Always call `close()` when shutting down your application
5. **Schema versioning** - Use `dropIndexes()` then `createIndexes()` when updating schemas

## Resources

- [Documentation](https://kisiwu.github.io/storehouse/redis-om/latest/)
- [@storehouse/core](https://www.npmjs.com/package/@storehouse/core)
- [Redis OM Node.js](https://github.com/redis/redis-om-node)
- [Redis Documentation](https://redis.io/docs/latest/)

## License

MIT