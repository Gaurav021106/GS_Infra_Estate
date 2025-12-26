const express = require('express');
const router = express.Router();

const {
  listProperties,
  getProperty,
} = require('../controllers/api.controller');

router.get('/properties', listProperties);
router.get('/properties/:id', getProperty);

module.exports = router;
