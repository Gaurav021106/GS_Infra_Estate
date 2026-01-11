// routes/public.routes.js
const express = require('express');
const router = express.Router();

// Import controller once and destructure what you need
const publicController = require('../controllers/public.controller');
const {
  homePage,
  propertyDetailPage,
  legacyPropertyRedirect,
  sitemapXml,
  robotsTxt,
  enquiryHandler,
  propertiesPage,
  aboutPage,
  servicesPage,
  contactPage,
} = publicController;

const propertyController = require('../controllers/propertyController');

// ===== CACHE CONTROL MIDDLEWARE =====
const cacheMiddleware = (maxAge = 300) => (req, res, next) => {
  res.set({
    'Cache-Control': `public, max-age=${maxAge}`,
    'Pragma': 'public',
    'Expires': new Date(Date.now() + maxAge * 1000).toUTCString(),
  });
  next();
};

const noCacheMiddleware = (req, res, next) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  next();
};

// ROOT
router.get('/', cacheMiddleware(300), homePage);

// CITY LISTING PAGES
router.get('/properties-in-dehradun', (req, res, next) => {
  req.params.city = 'dehradun';
  return propertyController.getPropertiesByCity(req, res, next);
});

router.get('/properties-in-rishikesh', (req, res, next) => {
  req.params.city = 'rishikesh';
  return propertyController.getPropertiesByCity(req, res, next);
});

router.get('/properties-in-haridwar', (req, res, next) => {
  req.params.city = 'haridwar';
  return propertyController.getPropertiesByCity(req, res, next);
});

// [FIX] Redirect bare /property path to prevent 404s
router.get('/property', (req, res) => res.redirect('/properties'));

// [FIXED ROUTE] Removed Regex constraint to prevent server crash
// The validation logic inside propertyController will handle the ID check
router.get('/property/:slug-:id', propertyController.getPropertyDetail);

// optional SEO pattern using public.controller -> propertyDetailPage
router.get('/properties/:location/:category/:slug-:id', propertyDetailPage);

// legacy numeric ID pattern
router.get('/property/:id', legacyPropertyRedirect);

// TYPE + CITY PAGES (legacy patterns)
router.get('/flats-in-:city', (req, res, next) => {
  req.params.type = 'flats';
  return propertyController.getPropertiesByTypeAndCity(req, res, next);
});

router.get('/houses-in-:city', (req, res, next) => {
  req.params.type = 'houses';
  return propertyController.getPropertiesByTypeAndCity(req, res, next);
});

router.get('/plots-in-:city', (req, res, next) => {
  req.params.type = 'plots';
  return propertyController.getPropertiesByTypeAndCity(req, res, next);
});

router.get('/commercial-properties-in-:city', (req, res, next) => {
  req.params.type = 'commercial-properties';
  return propertyController.getPropertiesByTypeAndCity(req, res, next);
});

// New generic type-in-city SEO URLs
router.get('/:type-in-:city', (req, res, next) => {
  return propertyController.getPropertiesByTypeAndCity(req, res, next);
});

// SITEMAP / ROBOTS
router.get('/sitemap.xml', sitemapXml);
router.get('/robots.txt', robotsTxt);

// ENQUIRY (JSON API)
router.post('/enquiry', enquiryHandler);

// CATEGORY LISTING PAGE (uses controller, not inline)
router.get('/category/:category', cacheMiddleware(600), publicController.propertiesByCategory);

// ======================= NEW STATIC / LISTING PAGES =======================

// Properties page - Shows all available properties (paginated)
router.get('/properties', propertiesPage);

// About page
router.get('/about', aboutPage);

// Services page
router.get('/services', servicesPage);

// Contact page
router.get('/contact', contactPage);

// LOCAL 404 HANDLER FOR PUBLIC ROUTER
router.use((req, res) => {
  const statusCode = 404;
  const message = 'Page not found';

  res.status(statusCode).render('error', {
    statusCode,
    message,
    seo: {
      title: '404 - Page Not Found | GS Infra Estates',
      desc: 'The page you are looking for does not exist.',
      keywords: res.locals.seo?.keywords || '',
    },
    stack: null,
  });
});

module.exports = router;