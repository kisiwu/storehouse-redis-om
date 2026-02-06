# Changelog

## [1.0.0] - 2026-02-06

### Added
- Health check functionality from `@storehouse/core`
  - `healthCheck()` method returns detailed connection status, ping response, latency, and registered models
  - `isConnected()` method to check connection status
- TypeScript generic type support
  - Generic type parameter `<T>` added to `getModel()` helper function for type-safe entity operations
  - Generic type parameter `<T>` added to `RedisOMManager.getModel()` method
  - Template parameters at class level for Redis modules, functions, scripts, RESP version, and type mapping
- Comprehensive JSDoc documentation for all exported functions, classes, interfaces, and methods
- Specific error classes from `@storehouse/core`:
  - `ModelNotFoundError` thrown when model is not found
  - `ManagerNotFoundError` thrown when manager is not found
  - `InvalidManagerConfigError` thrown when manager type is invalid

### Changed
- **BREAKING:** `getConnection()` now returns `RedisClientType` from `redis` package instead of `RedisConnection` from `redis-om`
- **BREAKING:** `RedisOMManager.getConnection()` now returns `RedisClientType` instead of `RedisConnection`
- Updated all dependencies to latest versions
- Improved README with better structure, examples, and TypeScript usage guide
- Enhanced health check result interface with additional fields (error details, timestamp, latency)

### Fixed
- Connection event logging now uses appropriate log levels (`Log.warn` for 'end' event)

[Unreleased]: https://github.com/kisiwu/storehouse-redis-om/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/kisiwu/storehouse-redis-om/releases/tag/v1.0.0