const Redis = require('redis');
const logger = require('./errors/logger');

const redisClient = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  logger.info('Connected to Redis');
});

const connectToRedis = async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    logger.error('Redis connection error:', err);
  }
};

connectToRedis();

const DEFAULT_EXPIRATION = 3600; // 1 hour in seconds

class Cache {
  static async get(key) {
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      logger.error('Redis get error:', err);
      return null;
    }
  }

  static async set(key, value, expiration = DEFAULT_EXPIRATION) {
    try {
      const stringValue = JSON.stringify(value);
      await redisClient.setEx(key, expiration, stringValue);
    } catch (err) {
      logger.error('Redis set error:', err);
    }
  }

  static async del(key) {
    try {
      await redisClient.del(key);
    } catch (err) {
      logger.error('Redis delete error:', err);
    }
  }

  static async clear() {
    try {
      await redisClient.flushAll();
    } catch (err) {
      logger.error('Redis flush error:', err);
    }
  }
}

module.exports = Cache;