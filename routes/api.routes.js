const express = require('express');
const router = express.Router();

const {
  listProperties,
  getProperty,
} = require('../controllers/api.controller');

router.get('/properties', listProperties);
router.get('/properties/:id', getProperty);
// Location-based search routes for better SEO
router.get('/search/city/:city', listProperties); // Search by city (Dehradun, Rishikesh)
router.get('/search/city/:city/state/:state', listProperties); // Search by city and state
router.get('/search/locality/:locality', listProperties); // Search by locality

module.exports = router;
