const performanceMonitor = require('../utils/performanceMonitor');

/**
 * Middleware to track request performance
 * [OPTIMIZED] Uses 'finish' event to capture actual network time 
 * and avoids double-counting (unlike overriding res.send/res.json).
 */
const requestPerformanceMiddleware = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // Don't log static asset requests (images, css, js) to keep logs clean
    if (!req.url.match(/\.(css|js|jpg|png|gif|ico|svg|woff|ttf|eot|map)$/)) {
        performanceMonitor.recordRequest(duration, res.statusCode);
    }
  });

  next();
};

/**
 * Middleware for tracking database query performance
 */
const dbQueryMonitoringMiddleware = (req, res, next) => {
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