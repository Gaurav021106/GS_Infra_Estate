const fs = require('fs');
const path = require('path');

/**
 * PerformanceMonitor Class
 * Tracks request times, database queries, memory usage, and error rates
 * Optimized for minimal memory footprint and non-blocking I/O.
 */
class PerformanceMonitor {
  constructor() {
    // [MEMORY FIX] Strict limit on history size
    this.HISTORY_LIMIT = 50; 
    
    this.metrics = {
      requestCount: 0,
      responseTime: [],
      dbQueryTime: [],
      errorCount: 0,
      memoryUsage: [],
      timestamps: []
    };
    
    this.logsDir = path.join(process.cwd(), 'logs');
    this.ensureLogsDirectory();
    
    // Start memory monitoring
    this.startMemoryMonitoring();
  }

  // ============ UTILITY METHODS ============
  
  ensureLogsDirectory() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  // ============ REQUEST MONITORING ============
  
  recordRequest(duration, statusCode = 200) {
    this.metrics.requestCount++;
    this.metrics.responseTime.push(duration);
    this.metrics.timestamps.push(Date.now());
    
    // [MEMORY FIX] Keep history small
    if (this.metrics.responseTime.length > this.HISTORY_LIMIT) {
      this.metrics.responseTime.shift();
      this.metrics.timestamps.shift();
    }
    
    // Track errors
    if (statusCode >= 400) {
      this.metrics.errorCount++;
    }
  }

  // ============ DATABASE MONITORING ============
  
  recordDBQuery(duration, collection = 'unknown', operation = 'query') {
    // [MEMORY FIX] Use short keys to save memory
    this.metrics.dbQueryTime.push({
      d: duration,
      c: collection,
      op: operation,
      t: Date.now()
    });
    
    if (this.metrics.dbQueryTime.length > this.HISTORY_LIMIT) {
      this.metrics.dbQueryTime.shift();
    }
  }

  // ============ MEMORY MONITORING ============
  
  startMemoryMonitoring() {
    // [PERFORMANCE] Monitor every 2 minutes to reduce overhead
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.metrics.memoryUsage.push({
        heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
        heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
        timestamp: new Date().toISOString()
      });
      
      // Keep last 30 records
      if (this.metrics.memoryUsage.length > 30) {
        this.metrics.memoryUsage.shift();
      }
    }, 120000); 
  }

  // ============ CALCULATIONS ============
  
  getAverageResponseTime() {
    if (this.metrics.responseTime.length === 0) return 0;
    const sum = this.metrics.responseTime.reduce((a, b) => a + b, 0);
    return (sum / this.metrics.responseTime.length).toFixed(2);
  }

  getMedianResponseTime() {
    if (this.metrics.responseTime.length === 0) return 0;
    const sorted = [...this.metrics.responseTime].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 
      ? sorted[mid].toFixed(2)
      : ((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2);
  }

  getP95ResponseTime() {
    if (this.metrics.responseTime.length === 0) return 0;
    const sorted = [...this.metrics.responseTime].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[index].toFixed(2);
  }

  getP99ResponseTime() {
    if (this.metrics.responseTime.length === 0) return 0;
    const sorted = [...this.metrics.responseTime].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.99) - 1;
    return sorted[index].toFixed(2);
  }

  getAverageDBQueryTime() {
    if (this.metrics.dbQueryTime.length === 0) return 0;
    const sum = this.metrics.dbQueryTime.reduce((total, item) => total + item.d, 0);
    return (sum / this.metrics.dbQueryTime.length).toFixed(2);
  }

  getSlowQueries(threshold = 100) {
    return this.metrics.dbQueryTime
      .filter(query => query.d > threshold)
      .sort((a, b) => b.d - a.d)
      .slice(0, 10);
  }

  getErrorRate() {
    if (this.metrics.requestCount === 0) return 0;
    return ((this.metrics.errorCount / this.metrics.requestCount) * 100).toFixed(2);
  }

  // ============ METRICS RETRIEVAL ============
  
  getMetrics() {
    return {
      timestamp: new Date().toISOString(),
      requests: {
        total: this.metrics.requestCount,
        errors: this.metrics.errorCount,
        errorRate: `${this.getErrorRate()}%`
      },
      responseTime: {
        avg: `${this.getAverageResponseTime()}ms`,
        median: `${this.getMedianResponseTime()}ms`,
        p95: `${this.getP95ResponseTime()}ms`,
        p99: `${this.getP99ResponseTime()}ms`
      },
      database: {
        avgQueryTime: `${this.getAverageDBQueryTime()}ms`,
        totalQueries: this.metrics.dbQueryTime.length,
        slowQueries: this.getSlowQueries().length
      },
      memory: {
        current: this.metrics.memoryUsage.length > 0 
          ? this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1]
          : 'N/A'
      }
    };
  }

  // ============ LOGGING ============
  
  logMetrics() {
    const metrics = this.getMetrics();
    const logPath = path.join(this.logsDir, `performance-${new Date().toISOString().split('T')[0]}.json`);
    
    // [FIX] Use async file writing to prevent blocking the Event Loop
    fs.readFile(logPath, 'utf-8', (err, data) => {
      let logs = [];
      if (!err && data) {
        try { logs = JSON.parse(data); } catch (e) {}
      }
      
      logs.push(metrics);
      if (logs.length > 500) logs = logs.slice(-500);

      fs.writeFile(logPath, JSON.stringify(logs, null, 2), (err) => {
        if (err) console.error('Error writing performance log:', err);
      });
    });
    
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[Perf] Avg Res: ${metrics.responseTime.avg} | Mem: ${metrics.memory.current?.heapUsed || 'N/A'} MB`);
    }
  }

  // ============ HEALTH CHECK ============
  getHealthStatus() {
    const avgResponseTime = parseFloat(this.getAverageResponseTime());
    const errorRate = parseFloat(this.getErrorRate());
    const memUsage = this.metrics.memoryUsage.length > 0
      ? parseFloat(this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1].heapUsed)
      : 0;

    let status = 'healthy';
    let issues = [];

    if (avgResponseTime > 1000) {
      status = 'degraded';
      issues.push(`Response time is high: ${avgResponseTime}ms`);
    }

    if (errorRate > 10) {
      status = 'critical';
      issues.push(`High error rate detected: ${errorRate}%`);
    }

    if (memUsage > 450) {
      status = 'degraded';
      issues.push(`High memory usage: ${memUsage}MB`);
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      issues,
      metrics: this.getMetrics()
    };
  }

  resetMetrics() {
    this.metrics.requestCount = 0;
    this.metrics.responseTime = [];
    this.metrics.dbQueryTime = [];
    this.metrics.errorCount = 0;
    this.metrics.timestamps = [];
  }
}

module.exports = new PerformanceMonitor();