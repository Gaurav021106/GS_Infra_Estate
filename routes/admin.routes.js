// routes/admin.routes.js
const express = require('express');
const router = express.Router();

const adminController = require('../controllers/admin.controller');
const authAdmin = require('../middleware/authAdmin');
const multer = require('multer');

/**
 * ====================== MULTER CONFIG ======================
 * Stores uploaded files in /public/uploads with unique filenames.
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure /public/uploads exists
    cb(null, 'public/uploads');
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = file.originalname.split('.').pop();
    cb(null, `${unique}.${ext}`);
  },
});

const upload = multer({ storage });

/**
 * Accept multiple named file fields from the admin property form.
 * name attributes in EJS must match:
 *  - map3dFile
 *  - virtualTourFile
 *  - images
 *  - videos
 */
const uploadFields = upload.fields([
  { name: 'map3dFile', maxCount: 1 },
  { name: 'virtualTourFile', maxCount: 1 },
  { name: 'images', maxCount: 10 },
  { name: 'videos', maxCount: 10 },
]);

/**
 * ====================== PUBLIC ADMIN ROUTES ======================
 * Mounted at /admin in index.js:
 *  - GET  /admin/login
 *  - POST /admin/login
 *  - POST /admin/login/verify
 *  - GET  /admin/logout
 */

// Login page (email + password + OTP flow)
router.get('/login', adminController.showLogin);

// Step 1: email + password (POST /admin/login)
router.post('/login', adminController.loginStep1);

// Step 2: verify OTP (POST /admin/login/verify)
router.post('/login/verify', adminController.loginVerify);

// Logout (clears session, then redirect to /)
router.get('/logout', adminController.logoutAdmin);

/**
 * ====================== PROTECTED ADMIN ROUTES ======================
 * All routes below require req.session.isAdmin === true via authAdmin middleware.
 *
 * Mounted at /admin in index.js:
 *  - GET    /admin/dashboard
 *  - GET    /admin/properties/json
 *  - POST   /admin/properties/new
 *  - GET    /admin/properties/:id/edit
 *  - POST   /admin/properties/:id/update
 *  - POST   /admin/properties/:id/delete
 */

// Dashboard (EJS view)
router.get('/dashboard', authAdmin, adminController.dashboard);

// JSON list for SPA dashboard / AJAX usage
router.get('/properties/json', authAdmin, adminController.listPropertiesJson);

// Create property (supports files, returns JSON or redirect)
router.post(
  '/properties/new',
  authAdmin,
  uploadFields,
  adminController.createProperty
);

// Edit property view (optional, if navigating by URL)
router.get(
  '/properties/:id/edit',
  authAdmin,
  adminController.editForm
);

// Update property (supports files, returns JSON or redirect)
router.post(
  '/properties/:id/update',
  authAdmin,
  uploadFields,
  adminController.updateProperty
);

// Delete property (returns JSON or redirect)
router.post(
  '/properties/:id/delete',
  authAdmin,
  adminController.deleteProperty
);

module.exports = router;
