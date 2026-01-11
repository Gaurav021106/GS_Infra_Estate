const express = require('express');
const router = express.Router();

// Placeholder - add your alerts routes here
router.get('/', (req, res) => {
  res.json({ message: 'Alerts route working' });
});

module.exports = router;
