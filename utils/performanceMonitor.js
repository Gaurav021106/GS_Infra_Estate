const fs = require('fs');
const path = require('path');

/**
 * PerformanceMonitor Class
 * Tracks request times, database queries, memory usage, and error rates
 * Optimized for minimal memory footprint.
 */
class PerformanceMonitor {
  constructor() {
    // [MEMORY FIX] Strict limit on history size
    this.HISTORY_LIMIT = 100; 
    
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
    this.metrics.timestamps.push(Date.now()); // Store timestamp as number
    
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
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.metrics.memoryUsage.push({
        heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
        heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
        timestamp: new Date().toISOString()
      });
      
      // Keep last 60 records
      if (this.metrics.memoryUsage.length > 60) {
        this.metrics.memoryUsage.shift();
      }
    }, 60000); // Record every 60 seconds
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
    // [MEMORY FIX] Access 'd' instead of 'duration'
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
    
    let logs = [];
    if (fs.existsSync(logPath)) {
      try {
        logs = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
      } catch (err) {
        logs = [];
      }
    }
    
    logs.push(metrics);
    // Keep log file from growing infinitely (keep last 1000 entries)
    if (logs.length > 1000) logs = logs.slice(-1000);

    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
    
    console.log(`
    ╔════════════════════════════════════════╗
    ║      PERFORMANCE METRICS               ║
    ╠════════════════════════════════════════╣
    ║  Total Requests: ${metrics.requests.total.toString().padEnd(27)} ║
    ║  Errors: ${metrics.requests.errors.toString().padEnd(33)} ║
    ║  Error Rate: ${metrics.requests.errorRate.padEnd(31)} ║
    ║  Avg Response: ${metrics.responseTime.avg.padEnd(30)} ║
    ║  Memory (Heap): ${metrics.memory.current?.heapUsed || 'N/A'.padEnd(28)} MB ║
    ╚════════════════════════════════════════╝
    `);
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

    if (avgResponseTime > 500) {
      status = 'degraded';
      issues.push(`Response time is high: ${avgResponseTime}ms`);
    }

    if (errorRate > 5) {
      status = 'critical';
      issues.push(`High error rate detected: ${errorRate}%`);
    }

    if (memUsage > 500) {
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

  // ============ RESET METRICS ============
  
  resetMetrics() {
    this.metrics = {
      requestCount: 0,
      responseTime: [],
      dbQueryTime: [],
      errorCount: 0,
      memoryUsage: this.metrics.memoryUsage, // Keep memory history
      timestamps: []
    };
  }
}

module.exports = new PerformanceMonitor();