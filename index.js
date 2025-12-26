require('dotenv').config();

const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

const { connectDB, mongoose } = require('./config/db');
const publicRoutes = require('./routes/public.routes');
const adminRoutes = require('./routes/admin.routes');
const apiRoutes = require('./routes/api.routes');

// ======================= CONNECT DATABASE =======================
connectDB();

// ======================= APP & MIDDLEWARE =======================
const app = express();

// Behind proxy (Render, Vercel, etc.)
app.set('trust proxy', 1);

// HTTPS REDIRECT FOR PRODUCTION
// Temporarily disabled for local testing - uncomment before deploying to Render
/*
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(`https://${req.header('host')}${req.url}`);
    }
    next();
  });
}
*/

// SECURITY HEADERS
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
          'https://cdn.jsdelivr.net',
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
          'data:',
        ],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
      },
    },
  }),
);

// RATE LIMITING
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);
app.use('/enquiry', limiter);

// LOGGING
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// COMPRESSION
app.use(
  compression({
    threshold: 0,
    level: 6,
  }),
);

// BODY PARSING
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// SIMPLE DATA SANITIZER
const sanitizeData = (obj) => {
  if (typeof obj !== 'object' || obj === null) return obj;

  const sanitized = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const sanitizedKey = key.replace(/[$\\.]/g, '_');
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
  if (req.params && Object.keys(req.params).length > 0) {
    req.params = sanitizeData(req.params);
  }
  next();
});

// VIEW ENGINE
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// STATIC ASSETS
app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
    etag: true,
  }),
);

// ======================= SESSIONS =======================
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-now',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: false, // Changed from: process.env.NODE_ENV === 'production'
    sameSite: 'lax',
  },
};

try {
  sessionConfig.store = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 24 * 60 * 60,
    touchAfter: 24 * 3600,
  });
  console.log('✅ MongoDB session store configured');
} catch (err) {
  console.error('❌ Session store error:', err);
  console.warn(
    '⚠️ MongoDB session store not configured, using memory store',
  );
}

app.use(session(sessionConfig));

// ======================= SEO & VIEW LOCALS ======================
app.use((req, res, next) => {
  res.locals.lazy = 'loading="lazy"';
  res.locals.seo = {
    title:
      'GS Infra Estates - Properties in Dehradun, Rishikesh & Surroundings',
    desc: 'Premium flats, plots & agricultural land in Dehradun, Rishikesh, Baniwala, Ranipokhri, Laal Tappad. Verified properties with virtual tours across Uttarakhand.',
    keywords:
      'Dehradun property, Rishikesh property, flats Dehradun, plots Rishikesh, Baniwala plots, Ranipokhri land, Laal Tappad property, Uttarakhand real estate, GS Infra Estates',
  };

  res.locals.ogTitle = res.locals.seo.title;
  res.locals.ogDesc = res.locals.seo.desc;
  res.locals.ogImage = '/og-image.jpg';
  res.locals.canonical =
    req.protocol + '://' + req.get('host') + req.originalUrl;

  next();
});

// ======================= ROUTES =======================
app.use('/', publicRoutes);
app.use('/api', apiRoutes);
app.use('/admin', adminRoutes);

// ======================= 404 HANDLER =======================
app.use((req, res) => {
  res.status(404).render('pages/404', {
    seo: {
      title: '404 - Page Not Found | GS Infra Estates',
      desc: 'The page you are looking for does not exist.',
      keywords: res.locals.seo.keywords,
    },
  });
});

// ======================= ERROR HANDLER =======================
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);

  const errorMessage =
    process.env.NODE_ENV === 'production'
      ? 'Something went wrong!'
      : err.message;

  const statusCode = err.status || err.statusCode || 500;

  if (res.headersSent) return next(err);

  if (req.accepts('html')) {
    res.status(statusCode).render('pages/error', {
      message: errorMessage,
      seo: {
        title: `Error ${statusCode} | GS Infra Estates`,
        desc: errorMessage,
        keywords: res.locals.seo?.keywords || '',
      },
    });
  } else {
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  }
});

// ======================= SERVER START =======================
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log('\n' + '='.repeat(70));
  console.log(`🚀 GS Infra Estates LIVE on http://localhost:${PORT}`);
  console.log(
    `📊 Environment: ${process.env.NODE_ENV || 'development'}`,
  );
  console.log(
    `🗄️ Database: ${
      mongoose.connection.readyState === 1 ? 'Connected' : 'Connecting...'
    }`,
  );
  console.log('='.repeat(70) + '\n');
});

module.exports = app;
