require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const { connectDB, mongoose } = require('./config/db');

// [PERFORMANCE] Import the Monitor Middleware
const { requestPerformanceMiddleware } = require('./middleware/performanceMonitor');

const publicRoutes = require('./routes/public.routes');
const adminRoutes = require('./routes/admin.routes');
const apiRoutes = require('./routes/api.routes');
const alertsRoutes = require('./routes/alerts');

connectDB();

const app = express();
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

// [PERFORMANCE] Activate the Monitor HERE (Must be before other app.use calls)
app.use(requestPerformanceMiddleware);

if (isProd) {
  app.set('view cache', true);
  app.enable('view cache');
}

// [SPEED FIX] Level 1 is much faster (less CPU) than Level 6, better for latency
app.use(compression({ level: 1, threshold: 1024 }));

// [MEMORY FIX] Optimized In-Memory Cache
app.locals.cache = new Map();
const CACHE_DURATION = 300; // 5 minutes
const MAX_CACHE_SIZE = 25;  // [MEMORY] Reduced from 50 to save RAM

app.use((req, res, next) => {
  const isCacheable = req.method === 'GET' && !req.url.includes('admin');
  if (!isCacheable) return next();
  
  const cacheKey = req.originalUrl || req.url;
  
  // 1. READ from Cache
  const cachedData = app.locals.cache.get(cacheKey);
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION * 1000) {
    res.set('X-Cache', 'HIT');
    
    // [FIX] Restore original Content-Type
    if (cachedData.contentType) {
        res.set('Content-Type', cachedData.contentType);
    }

    if (typeof cachedData.data === 'string') return res.send(cachedData.data);
    return res.json(cachedData.data);
  }
  
  // 2. WRITE to Cache
  const originalSend = res.send;
  res.send = function (body) {
    // Only cache 200 OK responses
    if (res.statusCode === 200) {
        // Evict oldest if full
        if (app.locals.cache.size >= MAX_CACHE_SIZE) {
            const firstKey = app.locals.cache.keys().next().value;
            app.locals.cache.delete(firstKey);
        }
        
        // [FIX] Store Content-Type alongside data
        app.locals.cache.set(cacheKey, { 
            data: body, 
            timestamp: Date.now(),
            contentType: res.get('Content-Type') 
        });
    }
    return originalSend.call(this, body);
  };

  res.set('X-Cache', 'MISS');
  next();
});

app.disable('x-powered-by');

// [SECURITY]
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", 
          "'unsafe-eval'",
          "https:",
          "blob:",
          "*.googletagmanager.com",
          "*.google-analytics.com",
          "cdn.jsdelivr.net"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https:",
          "fonts.googleapis.com",
          "cdn.jsdelivr.net"
        ],
        imgSrc: [
          "'self'",
          "data:",
          "https:",
          "blob:",
          "*.google-analytics.com",
          "*.googletagmanager.com"
        ],
        fontSrc: [
          "'self'",
          "https:",
          "data:",
          "fonts.gstatic.com",
          "cdn.jsdelivr.net"
        ],
        connectSrc: [
          "'self'",
          "https:",
          "wss:",
          "*.google-analytics.com",
          "*.googletagmanager.com",
          "stats.g.doubleclick.net",
          "cdn.jsdelivr.net"
        ],
        frameSrc: [
          "'self'",
          "https:",
          "blob:", 
          "*.google.com"
        ],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// [STATIC ASSETS OPTIMIZATION]
app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: isProd ? '365d' : 0,
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      if (filePath.match(/\.(glb|gltf|bin)$/)) {
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
        res.set('Content-Type', filePath.endsWith('.glb') ? 'model/gltf-binary' : 'application/json');
      } 
      else if (filePath.match(/\.(jpg|jpeg|png|gif|ico|svg|webp|woff|woff2|ttf|eot)$/)) {
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
      } 
      else if (filePath.match(/\.(css|js)$/)) {
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  })
);

// [BODY PARSING]
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb', parameterLimit: 10000 }));

// Sanitization
const sanitizeData = (obj) => {
  if (typeof obj !== 'object' || obj === null) return obj;
  const sanitized = Array.isArray(obj) ? [] : {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const sanitizedKey = key.replace(/^\$|\.|\[|\]/g, '_');
      const value = obj[key];
      sanitized[sanitizedKey] = typeof value === 'object' && value !== null ? sanitizeData(value) : value;
    }
  }
  return sanitized;
};

app.use((req, res, next) => {
  if (req.body && Object.keys(req.body).length > 0) req.body = sanitizeData(req.body);
  if (req.query && Object.keys(req.query).length > 0) req.query = sanitizeData(req.query);
  next();
});

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session
const isLocalhost = (process.env.HOST === 'localhost' || process.env.NODE_ENV !== 'production');
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  name: 'sessionId',
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: isProd && !isLocalhost,
    sameSite: 'lax',
  },
  store: process.env.MONGODB_URI ? MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions_v2',
    ttl: 24 * 60 * 60,
    autoRemove: 'native',
  }) : undefined,
  rolling: true,
  proxy: isProd,
};
app.use(session(sessionConfig));

// Global Locals
app.use((req, res, next) => {
  res.locals.lazy = 'loading="lazy"';
  res.locals.seo = { title: 'GS Infra Estates', desc: 'Real Estate in Uttarakhand', keywords: '' };
  res.locals.currentYear = new Date().getFullYear();
  res.locals.isAdmin = req.session?.isAdmin || false;
  next();
});

// Routes
app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);
app.use('/alerts', alertsRoutes);
app.use('/', publicRoutes);

app.get('/health', (req, res) => res.status(200).json({ status: 'OK', uptime: process.uptime() }));
app.use((req, res) => res.status(404).render('error', { statusCode: 404, message: 'Page not found', stack: null, seo: {} }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).render('error', { statusCode: err.status || 500, message: 'Server Error', stack: !isProd ? err.stack : null, seo: {} });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🧠 Cache: ${isProd ? 'Enabled' : 'Disabled'}`);
  console.log(`📊 Performance Monitor: Active`);
});