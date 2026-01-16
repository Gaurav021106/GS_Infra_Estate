// routes/admin.routes.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const adminController = require('../controllers/admin.controller');
const authAdmin = require('../middleware/authAdmin');

/**
 * ====================== MULTER CONFIG ======================
 */

// 1. Ensure upload directory exists
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 2. Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads');
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${unique}${ext}`);
  },
});

// 3. File Filter (Security)
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  // Validate 3D Models
  if (file.fieldname === 'map3dFile') {
    const allowedExts = ['.glb', '.gltf'];
    const allowedMimes = ['model/gltf-binary', 'model/gltf+json', 'application/octet-stream'];
    
    if (!allowedExts.includes(ext) && !allowedMimes.includes(file.mimetype)) {
      return cb(new Error('Only .glb and .gltf 3D model files are allowed'), false);
    }
  }
  
  // Validate Images
  else if (file.fieldname === 'images') {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
  }

  // Validate Videos
  else if (file.fieldname === 'videos' || file.fieldname === 'virtualTourFile') {
    if (!file.mimetype.startsWith('video/')) {
      return cb(new Error('Only video files are allowed'), false);
    }
  }

  cb(null, true);
};

// 4. Initialize Multer with 500MB Limit (FIXED HERE)
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024 // Increased to 500MB
  }
});

/**
 * Field Configuration
 */
const uploadFields = upload.fields([
  { name: 'map3dFile', maxCount: 1 },
  { name: 'virtualTourFile', maxCount: 1 },
  { name: 'images', maxCount: 10 },
  { name: 'videos', maxCount: 10 },
]);

/**
 * ====================== ROUTES ======================
 */

// Auth Routes
router.get('/login', adminController.showLogin);
router.post('/login', adminController.loginStep1);
router.post('/login/verify', adminController.loginVerify);
router.get('/logout', adminController.logoutAdmin);

// Dashboard & Property Routes
router.get('/dashboard', authAdmin, adminController.dashboard);
router.get('/properties/json', authAdmin, adminController.listPropertiesJson);

// Create Property (Apply upload middleware)
router.post(
  '/properties/new',
  authAdmin,
  uploadFields,
  adminController.createProperty
);

// Edit & Update
router.get('/properties/:id/edit', authAdmin, adminController.editForm);
router.post(
  '/properties/:id/update',
  authAdmin,
  uploadFields,
  adminController.updateProperty
);

// Delete
router.post('/properties/:id/delete', authAdmin, adminController.deleteProperty);

module.exports = router;