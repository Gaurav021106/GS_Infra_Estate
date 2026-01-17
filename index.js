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
const publicRoutes = require('./routes/public.routes');
const adminRoutes = require('./routes/admin.routes');
const apiRoutes = require('./routes/api.routes');
const alertsRoutes = require('./routes/alerts');

connectDB();

const app = express();
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

if (isProd) {
  app.set('view cache', true);
  app.enable('view cache');
}

app.use(compression({ level: 6, threshold: 1024 }));

// [MEMORY FIX] Optimized In-Memory Cache
app.locals.cache = new Map();
const CACHE_DURATION = 300;
const MAX_CACHE_SIZE = 50;

app.use((req, res, next) => {
  const isCacheable = req.method === 'GET' && !req.url.includes('admin');
  if (!isCacheable) return next();
  
  const cacheKey = req.originalUrl || req.url;
  
  // LRU-like eviction
  if (app.locals.cache.size > MAX_CACHE_SIZE) {
    const firstKey = app.locals.cache.keys().next().value;
    app.locals.cache.delete(firstKey);
  }

  const cachedData = app.locals.cache.get(cacheKey);
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION * 1000) {
    res.set('X-Cache', 'HIT');
    return res.json(cachedData.data);
  }
  
  res.set('X-Cache', 'MISS');
  next();
});

app.disable('x-powered-by');

// [SECURITY]
app.use(
  helmet({
    contentSecurityPolicy: isProd
      ? {
          useDefaults: true,
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:", "blob:"], // Added blob: for worker scripts
            styleSrc: ["'self'", "'unsafe-inline'", "https:"],
            fontSrc: ["'self'", "https:", "data:"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "https:", "wss:"],
            frameSrc: ["'self'", "https:", "blob:"], // Allowed blob for 3D viewers
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  })
);

// [STATIC ASSETS OPTIMIZATION]
app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: isProd ? '365d' : 0,
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      // 3D Model Optimization - Long Cache for heavy files
      if (filePath.match(/\.(glb|gltf|bin)$/)) {
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
        res.set('Content-Type', filePath.endsWith('.glb') ? 'model/gltf-binary' : 'application/json');
      } 
      // Images & Fonts
      else if (filePath.match(/\.(jpg|jpeg|png|gif|ico|svg|webp|woff|woff2|ttf|eot)$/)) {
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
      } 
      // CSS/JS
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
});