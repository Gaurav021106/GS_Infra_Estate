const express = require('express');
const router = express.Router();

const {
  homePage,
  propertyDetailPage,
  legacyPropertyRedirect,
  sitemapXml,
  robotsTxt,
  enquiryHandler,
} = require('../controllers/public.controller');

const propertyController = require('../controllers/propertyController');

// ======================= ROOT =======================
router.get('/', homePage);

// ======================= CITY LISTING PAGES (STATIC SEO) =======================
// /properties-in-dehradun?page=2
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

// ======================= TYPE + CITY PAGES (DYNAMIC SEO) =======================
// /flats-in-dehradun?page=2
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

// ======================= PROPERTY DETAIL PAGES =======================
// Old short SEO URL
router.get('/property/:slug-:id', propertyController.getPropertyDetail);

// New structured SEO URL
router.get('/properties/:location/:category/:slug-:id', propertyDetailPage);

// Legacy short link used in alerts
router.get('/property/:id', legacyPropertyRedirect);

// ======================= SITEMAP / ROBOTS =======================
router.get('/sitemap.xml', sitemapXml);
router.get('/robots.txt', robotsTxt);

// ======================= ENQUIRY (JSON API) =======================
router.post('/enquiry', enquiryHandler);

module.exports = router;
