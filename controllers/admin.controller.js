const Property = require('../models/property');
const nodemailer = require('nodemailer');
const { generateOTP, splitByCategory } = require('../utils/propertyHelpers');

// Create transporter with proper Gmail settings
const transporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 587,
  secure: false,
  auth: {
    user: 'apikey', // this literal string
    pass: process.env.SENDGRID_API_KEY,
  },
});


// Test the connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Gmail SMTP Error:', error.message);
  } else {
    console.log('✅ Gmail SMTP Ready - OTP emails will work');
  }
});

// Helper function to send OTP email
async function sendOtpEmail(email, code) {
  try {
    const info = await transporter.sendMail({
      from: 'gs.infra.estates@gmail.com',
      to: email,
      subject: 'GS Infra Estates - Admin Login Verification',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5; border-radius: 10px;">
          <h2 style="color: #333; margin-bottom: 20px;">🔐 GS Infra Estates Admin Login</h2>
          <p style="font-size: 16px; color: #666; margin-bottom: 20px;">Your admin login code is:</p>
          <div style="background-color: #fff; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
            <h1 style="color: #0066cc; font-size: 48px; letter-spacing: 8px; margin: 0;">${code}</h1>
          </div>
          <p style="color: #999; font-size: 14px; margin-bottom: 10px;">⏱️ <b>Valid for 10 minutes only</b></p>
          <p style="color: #999; font-size: 12px; border-top: 1px solid #ddd; padding-top: 15px; margin-top: 15px;">
            If you didn't request this code, please ignore this email and contact support immediately.
          </p>
        </div>
      `,
    });
    console.log(`✅ OTP email sent to ${email} (Message ID: ${info.messageId})`);
  } catch (err) {
    console.error(`❌ Failed to send OTP to ${email}:`, err.message);
    throw err;
  }
}

// ======================= LOGIN VIEW =======================
exports.showLogin = (req, res) => {
  res.render('admin/login', {
    title: 'GS Infra Estates - Admin Login',
  });
};

// ======================= LOGIN STEP 1 (EMAIL + PASSWORD) =======================
exports.loginStep1 = async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res
      .status(400)
      .json({ ok: false, error: 'Email and password are required' });
  }

  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'gauravsaklani021106@gmail.com';
  const ADMIN_PASS = process.env.ADMIN_PASS || 'SAKLANI021106';

  if (username !== ADMIN_EMAIL || password !== ADMIN_PASS) {
    return res
      .status(401)
      .json({ ok: false, error: 'Invalid credentials' });
  }

  const code = generateOTP();

  // Store in session
  req.session.otp = {
    code,
    expiry: Date.now() + 10 * 60 * 1000, // 10 minutes
    attempts: 0,
    username,
  };

  // IMPORTANT: Save session before sending response
  req.session.save((err) => {
    if (err) {
      console.error('❌ Session save error:', err);
      return res
        .status(500)
        .json({ ok: false, error: 'Session error. Please try again.' });
    }

    sendOtpEmail(username, code)
      .then(() => {
        console.log(`📧 OTP code for ${username}: ${code}`);
        return res.json({
          ok: true,
          username,
          message: 'Code sent to your email',
        });
      })
      .catch((mailErr) => {
        console.error('❌ Email delivery failed:', mailErr.message);
        return res
          .status(500)
          .json({ ok: false, error: 'Email delivery failed. Please check Gmail settings.' });
      });
  });
};

// ======================= LOGIN STEP 2 (VERIFY OTP) =======================
exports.loginVerify = (req, res) => {
  const { verificationCode } = req.body || {};

  console.log('📋 Session ID:', req.sessionID);
  console.log('📋 Verifying OTP...');

  if (!verificationCode) {
    return res
      .status(400)
      .json({ ok: false, error: 'Verification code required' });
  }

  const otpSession = req.session.otp;

  if (!otpSession) {
    console.error('❌ No OTP session found');
    return res
      .status(400)
      .json({ ok: false, error: 'No active verification session. Please login again.' });
  }

  if (otpSession.attempts >= 5) {
    delete req.session.otp;
    req.session.save();
    console.error('❌ Too many OTP attempts');
    return res.status(400).json({
      ok: false,
      error: 'Too many attempts. Please login again.',
    });
  }

  if (otpSession.expiry < Date.now()) {
    delete req.session.otp;
    req.session.save();
    console.error('❌ OTP code expired');
    return res
      .status(400)
      .json({ ok: false, error: 'Code expired. Please login again.' });
  }

  if (verificationCode !== otpSession.code) {
    otpSession.attempts += 1;
    req.session.save();
    console.error(`❌ Invalid OTP. Attempt ${otpSession.attempts}/5`);
    return res
      .status(400)
      .json({ 
        ok: false, 
        error: `Invalid verification code (Attempt ${otpSession.attempts}/5)` 
      });
  }

  // Success - set admin flag
  req.session.isAdmin = true;
  req.session.adminEmail = otpSession.username;
  delete req.session.otp;

  req.session.save((err) => {
    if (err) {
      console.error('❌ Session save error on verify:', err);
      return res.status(500).json({ ok: false, error: 'Session error' });
    }

    console.log(`✅ Admin logged in: ${req.session.adminEmail}`);

    return res.json({ ok: true, redirect: '/admin/dashboard' });
  });
};

// ======================= LOGOUT =======================
exports.logoutAdmin = (req, res) => {
  const adminEmail = req.session.adminEmail;
  req.session.destroy((err) => {
    if (err) {
      console.error('❌ Logout error:', err);
    } else {
      console.log(`✅ Admin logged out: ${adminEmail}`);
    }
    res.redirect('/');
  });
};

// ======================= DASHBOARD VIEW =======================
exports.dashboard = async (req, res) => {
  try {
    const props = await Property.find().sort({ createdAt: -1 });
    const { flats, plots, agri } = splitByCategory(props);

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      flats,
      plots,
      agri,
      email: req.session.adminEmail,
      editingProperty: null,
      status: req.query.status || null,
    });
  } catch (err) {
    console.error('❌ Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
};

// ======================= CREATE PROPERTY =======================
exports.createProperty = async (req, res) => {
  try {
    const {
      category,
      title,
      description,
      price,
      location,
      suitableFor,
      status,
      sqft,
    } = req.body;

    if (!category || !title || !price || !location) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const suitableArr = (suitableFor || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const map3dFile =
      req.files?.map3dFile && req.files.map3dFile[0]
        ? '/uploads/' + req.files.map3dFile[0].filename
        : null;

    const virtualTourFile =
      req.files?.virtualTourFile && req.files.virtualTourFile[0]
        ? '/uploads/' + req.files.virtualTourFile[0].filename
        : null;

    const imageArr = (req.files?.images || [])
      .slice(0, 10)
      .map((f) => '/uploads/' + f.filename);

    const videoArr = (req.files?.videos || [])
      .slice(0, 10)
      .map((f) => '/uploads/' + f.filename);

    const property = await Property.create({
      category,
      title,
      description,
      price,
      location,
      suitableFor: suitableArr,
      status: status || 'available',
      map3dUrl: map3dFile,
      virtualTourUrl: virtualTourFile,
      imageUrls: imageArr,
      videoUrls: videoArr,
      sqft,
    });

    console.log(`✅ Property created: ${title} (ID: ${property._id})`);
    res.redirect('/admin/dashboard?status=created');
  } catch (err) {
    console.error('❌ Create property error:', err);
    res.status(500).json({ error: 'Failed to create property' });
  }
};

// ======================= EDIT FORM (PRE-FILL) =======================
exports.editForm = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).send('Property not found');
    }

    const props = await Property.find().sort({ createdAt: -1 });
    const { flats, plots, agri } = splitByCategory(props);

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      flats,
      plots,
      agri,
      email: req.session.adminEmail,
      editingProperty: property,
      status: null,
    });
  } catch (err) {
    console.error('❌ Edit form error:', err);
    res.status(500).send('Server error');
  }
};

// ======================= UPDATE PROPERTY =======================
exports.updateProperty = async (req, res) => {
  try {
    const updates = { ...req.body };

    if (updates.suitableFor) {
      updates.suitableFor = updates.suitableFor
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }

    if (req.files) {
      if (req.files.map3dFile) {
        updates.map3dUrl = '/uploads/' + req.files.map3dFile[0].filename;
      }

      if (req.files.virtualTourFile) {
        updates.virtualTourUrl =
          '/uploads/' + req.files.virtualTourFile[0].filename;
      }

      if (req.files.images) {
        const newImgs = req.files.images.map(
          (f) => '/uploads/' + f.filename,
        );
        updates.imageUrls = (updates.imageUrls || []).concat(newImgs);
      }

      if (req.files.videos) {
        const newVids = req.files.videos.map(
          (f) => '/uploads/' + f.filename,
        );
        updates.videoUrls = (updates.videoUrls || []).concat(newVids);
      }
    }

    const property = await Property.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        new: true,
        runValidators: true,
      },
    );

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    console.log(`✅ Property updated: ${property.title}`);
    res.redirect('/admin/dashboard?status=updated');
  } catch (err) {
    console.error('❌ Update property error:', err);
    res.status(500).json({ error: 'Update failed' });
  }
};

// ======================= DELETE PROPERTY =======================
exports.deleteProperty = async (req, res) => {
  try {
    const property = await Property.findByIdAndDelete(req.params.id);
    if (property) {
      console.log(`✅ Property deleted: ${property.title}`);
    }
    res.redirect('/admin/dashboard?status=deleted');
  } catch (err) {
    console.error('❌ Delete property error:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
};
