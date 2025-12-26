const express = require('express');

const router = express.Router();

const {
  homePage,
  propertyDetailPage,
  legacyPropertyRedirect,
  sitemapXml,
  robotsTxt,
  enquiryHandler,
} = require('../controllers/home.controller');

router.get('/', homePage);

router.get(
  '/properties/:location/:category/:slug-:id',
  propertyDetailPage,
);

router.get('/property/:id', legacyPropertyRedirect);

router.get('/sitemap.xml', sitemapXml);

router.get('/robots.txt', robotsTxt);

router.post('/enquiry', enquiryHandler);

module.exports = router;
