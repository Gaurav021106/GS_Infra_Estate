require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo'); // v4
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

// ======================= CONNECT DATABASE =======================
connectDB();

// ======================= APP & MIDDLEWARE =======================
const app = express();
const isProd = process.env.NODE_ENV === 'production';

// 1. TRUST PROXY (Critical for Render/Heroku)
app.set('trust proxy', 1);

// 2. PRODUCTION VIEW CACHING
if (isProd) {
  app.set('view cache', true);
  app.enable('view cache');
}

// 3. RESPONSE COMPRESSION - Reduces payload size by 50-70%
app.use(compression({
  level: 6,
  threshold: 1024
}));


// 4. RESPONSE CACHING - Simple in-memory cache for better performance
app.locals.cache = {};
const CACHE_DURATION = 300; // 5 minutes in seconds

// Simple cache middleware
app.use((req, res, next) => {
  const isCacheable = req.method === 'GET' && !req.url.includes('admin');
  if (!isCacheable) return next();
  
  const cacheKey = req.originalUrl || req.url;
  const cachedData = app.locals.cache[cacheKey];
  
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION * 1000) {
    res.set('X-Cache', 'HIT');
    return res.json(cachedData.data);
  }
  
  res.set('X-Cache', 'MISS');
  next();
});


// Disable X-Powered-By header for security
app.disable('x-powered-by');

// ======================= SECURITY HEADERS (HELMET) =======================
app.use(
  helmet({
    contentSecurityPolicy: isProd
      ? {
          useDefaults: true,
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
              "'self'",
              "'unsafe-inline'",
              "'unsafe-eval'",
              'https://cdn.jsdelivr.net',
              'https://www.googletagmanager.com',
            ],
            styleSrc: [
              "'self'",
              "'unsafe-inline'",
              'https://fonts.googleapis.com',
              'https://fonts.cdnfonts.com',
            ],
            fontSrc: [
              "'self'",
              'https://fonts.gstatic.com',
              'https://fonts.cdnfonts.com',
              'https://r2cdn.perplexity.ai',
              'data:',
            ],
            imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
            connectSrc: ["'self'", 'https:', 'wss:'],
            frameSrc: ["'self'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: isProd
      ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        }
      : false,
  })
);

// ======================= COMPRESSION =======================
app.use(
  compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
  })
);

// ======================= CACHING HEADERS =======================
app.use((req, res, next) => {
  if (req.method === 'GET') {
    if (
      req.path.match(
        /\.(jpg|jpeg|png|gif|ico|svg|webp|css|js|woff|woff2|ttf|eot)$/
      )
    ) {
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (req.path === '/') {
      res.set(
        'Cache-Control',
        'public, max-age=3600, s-maxage=7200, stale-while-revalidate=86400'
      );
    } else if (req.path.match(/^\/properties/)) {
      res.set(
        'Cache-Control',
        'public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400'
      );
    } else {
      res.set('Cache-Control', 'public, max-age=600, s-maxage=1200');
    }
  } else {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});

// ======================= RATE LIMITING =======================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many submissions. Please wait before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// Apply rate limiters
app.use('/api/', apiLimiter);
app.use('/enquiry', formLimiter);
app.use('/admin/login', authLimiter);

// ======================= LOGGING (MORGAN) =======================
if (isProd) {
  app.use(
    morgan('combined', {
      skip: (req, res) => res.statusCode < 400,
    })
  );
} else {
  app.use(morgan('dev'));
}

// ======================= BODY PARSING =======================
app.use(
  express.json({
    limit: '10mb',
    strict: true,
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
    parameterLimit: 10000,
  })
);

// ======================= INPUT SANITIZATION =======================
const sanitizeData = (obj) => {
  if (typeof obj !== 'object' || obj === null) return obj;

  const sanitized = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const sanitizedKey = key.replace(/^\$|\.|\[|\]/g, '_');
      const value = obj[key];

      sanitized[sanitizedKey] =
        typeof value === 'object' && value !== null
          ? sanitizeData(value)
          : value;
    }
  }

  return sanitized;
};

app.use((req, res, next) => {
  if (req.body && Object.keys(req.body).length > 0) {
    req.body = sanitizeData(req.body);
  }
  if (req.query && Object.keys(req.query).length > 0) {
    req.query = sanitizeData(req.query);
  }
  next();
});

// ======================= VIEW ENGINE =======================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ======================= STATIC ASSETS =======================
app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: isProd ? '365d' : 0,
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.set('Cache-Control', 'public, max-age=0, must-revalidate');
      } else if (filePath.match(/\.(jpg|jpeg|png|gif|ico|svg|webp)$/)) {
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (filePath.match(/\.(css|js)$/)) {
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  })
);

// ======================= SESSION CONFIGURATION =======================
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  name: 'sessionId',
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
  },
  rolling: true,
  proxy: isProd,
};

if (process.env.MONGODB_URI) {
  try {
    sessionConfig.store = MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: 'sessions',
      ttl: 24 * 60 * 60,
      autoRemove: 'native',
      crypto: {
        secret:
          process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
      },
    });
    console.log('✅ MongoDB session store configured successfully');
  } catch (err) {
    console.error('❌ Session store error:', err.message);
    console.warn(
      '⚠️  Falling back to memory store (not recommended for production)'
    );
  }
} else {
  console.warn('⚠️  MONGODB_URI not found - using memory store');
}

app.use(session(sessionConfig));

// ======================= SEO & GLOBAL VIEW LOCALS =======================
app.use((req, res, next) => {
  res.locals.lazy = 'loading="lazy"';

  res.locals.seo = {
    title: 'GS Infra Estates - Properties in Dehradun, Rishikesh & Surroundings',
    desc: 'Premium flats, plots & agricultural land in Dehradun, Rishikesh, Baniwala, Ranipokhri, Laal Tappad. Verified properties with virtual tours across Uttarakhand.',
    keywords:
      'Dehradun property, Rishikesh property, flats Dehradun, plots Rishikesh, Baniwala plots, Ranipokhri land, Laal Tappad property, Uttarakhand real estate, GS Infra Estates',
  };

  res.locals.ogTitle = res.locals.seo.title;
  res.locals.ogDesc = res.locals.seo.desc;
  res.locals.ogImage = `${req.protocol}://${req.get('host')}/og-image.jpg`;
  res.locals.ogUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

  res.locals.canonical = `${req.protocol}://${req.get('host')}${req.path}`;
  res.locals.currentYear = new Date().getFullYear();
  res.locals.isAdmin = req.session?.isAdmin || false;

  next();
});

// ======================= ROUTES (FIXED ORDER) =======================
// 1. Admin Routes (Must come BEFORE public routes to capture /admin requests)
app.use('/admin', adminRoutes);

// 2. API & Alert Routes (Must come BEFORE public routes)
app.use('/api', apiRoutes);
app.use('/alerts', alertsRoutes);

// 3. Public Routes (Must come LAST because it has a catch-all 404 handler)
app.use('/', publicRoutes);

// ======================= HEALTH CHECK ENDPOINT =======================
app.get('/health', (req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    environment: process.env.NODE_ENV || 'development',
    database:
      mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  };

  try {
    res.status(200).json(healthCheck);
  } catch (error) {
    healthCheck.message = error.message;
    res.status(503).json(healthCheck);
  }
});

// ======================= ROBOTS.TXT =======================
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Sitemap: ${req.protocol}://${req.get('host')}/sitemap.xml`);
});

// ======================= 404 HANDLER =======================
// Use single error view, not pages/404
app.use((req, res) => {
  console.log(`⚠️  404 Not Found: ${req.method} ${req.originalUrl}`);

  res.status(404).render('error', {
    statusCode: 404,
    message: 'Page not found',
    stack: null,
    seo: {
      title: '404 - Page Not Found | GS Infra Estates',
      desc: 'The page you are looking for does not exist.',
      keywords: res.locals.seo?.keywords || '',
    },
  });
});

// ======================= GLOBAL ERROR HANDLER =======================
app.use((err, req, res, next) => {
  console.error('❌ Error occurred:');
  console.error('Time:', new Date().toISOString());
  console.error('Path:', req.method, req.originalUrl);
  console.error('Error:', err.stack);

  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.status || err.statusCode || 500;

  const errorMessage =
    isProd && statusCode === 500
      ? 'Internal server error. Please try again later.'
      : err.message;

  res.status(statusCode).render('error', {
    statusCode,
    message: errorMessage,
    seo: {
      title: `Error ${statusCode} | GS Infra Estates`,
      desc: errorMessage,
      keywords: res.locals.seo?.keywords || '',
    },
    stack: !isProd ? err.stack : null,
  });
});

// ======================= GRACEFUL SHUTDOWN =======================
const gracefulShutdown = (signal) => {
  console.log(`\n⚠️  ${signal} signal received: closing HTTP server`);

  server.close(() => {
    console.log('✅ HTTP server closed');

    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  });

  setTimeout(() => {
    console.error('⚠️  Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// ======================= SERVER START =======================
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log('\n' + '='.repeat(70));
  console.log(`🚀 GS Infra Estates LIVE`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(
    `🗄️  Database: ${
      mongoose.connection.readyState === 1 ? '✅ Connected' : '⏳ Connecting...'
    }`
  );
  console.log(
    `💾 Session Store: ${
      sessionConfig.store ? '✅ MongoDB' : '⚠️  Memory (dev only)'
    }`
  );
  console.log(`🔒 Security: ✅ Helmet, Rate Limiting, Sanitization`);
  console.log('='.repeat(70) + '\n');
});

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION! Shutting down...');
  console.error(err.name, err.message);
  console.error(err.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ UNHANDLED REJECTION! Shutting down...');
  console.error(err.name, err.message);
  console.error(err.stack);
  server.close(() => {
    process.exit(1);
  });
});

module.exports = app;