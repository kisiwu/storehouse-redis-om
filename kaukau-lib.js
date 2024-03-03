module.exports = {
  enableLogs: true,
  exitOnFail: true,
  files: 'test/lib',
  ext: '.test.js',
  options: {
    bail: false,
    fullTrace: true,
    grep: '',
    ignoreLeaks: false,
    reporter: 'spec',
    retries: 0,
    slow: 2000,
    timeout: 7000,
    ui: 'bdd',
    color: true,
  },
  parameters: {
    redis: {
      host: process.env.TEST_REDIS_HOST,
      port: typeof process.env.TEST_REDIS_PORT === 'undefined' ? undefined : parseInt(process.env.TEST_REDIS_PORT),
      password: process.env.TEST_REDIS_PASSWORD
    }
  },
};
