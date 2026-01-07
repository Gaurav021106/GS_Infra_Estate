const performanceMonitor = require('../utils/performanceMonitor');

/**
 * Middleware to track request performance
 */
const requestPerformanceMiddleware = (req, res, next) => {
  const startTime = Date.now();

  // Override res.json to track when response is sent
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - startTime;
    performanceMonitor.recordRequest(duration, res.statusCode);
    return originalJson.call(this, data);
  };

  // Override res.send for non-JSON responses
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    performanceMonitor.recordRequest(duration, res.statusCode);
    return originalSend.call(this, data);
  };

  next();
};

/**
 * Middleware for tracking database query performance
 */
const dbQueryMonitoringMiddleware = (req, res, next) => {
  // Wrap mongoose to track query performance
  req.dbQueryStart = Date.now;
  req.recordDBQuery = (collection, operation = 'query') => {
    const duration = Date.now() - req.dbQueryStart();
    performanceMonitor.recordDBQuery(duration, collection, operation);
  };
  next();
};

module.exports = {
  requestPerformanceMiddleware,
  dbQueryMonitoringMiddleware
};
