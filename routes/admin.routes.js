const express = require('express');
const router = express.Router();

const upload = require('../middleware/upload');
const {
  showLogin,
  loginStep1,
  loginVerify,
  logoutAdmin,
  dashboard,
  createProperty,
  editForm,
  updateProperty,
  deleteProperty,
} = require('../controllers/admin.controller');
const authAdmin = require('../middleware/authAdmin');

router.get('/login', showLogin);
router.post('/login', loginStep1);
router.post('/login/verify', loginVerify);
router.get('/logout', logoutAdmin);

router.get('/dashboard', authAdmin, dashboard);

router.post(
  '/properties/new',
  authAdmin,
  upload.fields([
    { name: 'map3dFile', maxCount: 1 },
    { name: 'virtualTourFile', maxCount: 1 },
    { name: 'images', maxCount: 10 },
    { name: 'videos', maxCount: 10 },
  ]),
  createProperty,
);

router.get('/properties/:id/edit', authAdmin, editForm);

router.post(
  '/properties/:id/update',
  authAdmin,
  upload.fields([
    { name: 'map3dFile', maxCount: 1 },
    { name: 'virtualTourFile', maxCount: 1 },
    { name: 'images', maxCount: 10 },
    { name: 'videos', maxCount: 10 },
  ]),
  updateProperty,
);

router.post('/properties/:id/delete', authAdmin, deleteProperty);

module.exports = router;
