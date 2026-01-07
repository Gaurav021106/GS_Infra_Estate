// controllers/admin.controller.js
const Property = require('../models/property');
const { splitByCategory } = require('../utils/propertyHelpers');
const { Resend } = require('resend');
const { notifyNewProperty } = require('../services/alertsService');

const resend = new Resend(process.env.RESEND_API_KEY);

// ======================= OTP HELPER ===================
const generateOTP = () => {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < 6; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
};

// ======================= RESEND STARTUP TEST =======================
resend.emails
  .list()
  .then((listResult) => {
    console.log('✅ Resend API Connected Successfully');
    console.log('ℹ️ Resend list() sample total:', listResult?.data?.length ?? 0);
  })
  .catch((err) => {
    console.error('❌ Resend API Connection Failed:', {
      name: err.name,
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
    });
  });

// ======================= SEND ADMIN OTP EMAIL =======================
async function sendOtpEmail(adminEmail, code) {
  try {
    console.log('📤 Sending Admin OTP:', {
      from: process.env.FROM_EMAIL,
      toEnv: process.env.ADMINEMAIL,
      toParam: adminEmail,
      nodeEnv: process.env.NODE_ENV,
    });

    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: process.env.ADMINEMAIL,
      subject: '🔐 GS Infra Estates - Admin Login Verification',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5; border-radius: 10px; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #0066cc 0%, #0080ff 100%); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">GS Infra Estates</h1>
          </div>
          <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333333; margin-bottom: 20px;">Admin Login Verification</h2>
            <p style="font-size: 16px; color: #666666; margin-bottom: 20px;">
              Admin login request from GS Infra system to: <strong>${adminEmail}</strong>
            </p>

            <div style="background-color: #f8f9fa; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 25px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              <p style="color: #555555; font-size: 14px; margin-bottom: 10px;">Your one-time verification code is:</p>
              <h1 style="color: #0066cc; font-size: 48px; letter-spacing: 8px; margin: 0; font-weight: bold;">
                ${code}
              </h1>
              <p style="color: #ff6b35; font-size: 14px; font-weight: bold; margin-bottom: 10px;">
                Valid for 10 minutes only
              </p>
            </div>

            <hr style="border: none; border-top: 1px solid #dddddd; margin: 20px 0;" />

            <p style="color: #999999; font-size: 12px; line-height: 1.5;">
              Sent from <strong>${process.env.FROM_EMAIL}</strong><br />
              If you didn't request this code, please ignore this email and contact support immediately.
            </p>
          </div>
          <div style="text-align: center; padding: 15px; background-color: #f8f9fa; border-radius: 0 0 10px 10px; margin-top: -10px;">
            <p style="color: #666666; font-size: 11px; margin: 0;">
              © GS Infra Estates 2025
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('❌ Resend send error:', {
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        cause: error.cause,
        from: process.env.FROM_EMAIL,
        to: process.env.ADMINEMAIL,
      });

      const e = new Error(error.message || 'Failed to send email via Resend');
      e.name = error.name || 'ResendError';
      e.statusCode = error.statusCode || 500;
      e.code = error.code;
      e.resendError = error;
      throw e;
    }

    console.log('✅ Admin OTP sent:', {
      to: process.env.ADMINEMAIL,
      from: process.env.FROM_EMAIL,
      id: data?.id,
    });

    return data;
  } catch (err) {
    console.error('❌ Admin OTP Error:', {
      name: err.name,
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      stack: err.stack,
      resendError: err.resendError || null,
    });

    throw err;
  }
}

// helper for JSON vs HTML
const wantsJson = (req) =>
  req.xhr ||
  (req.headers.accept && req.headers.accept.includes('application/json'));

// ======================= LOGIN VIEW =======================
exports.showLogin = (req, res) => {
  try {
    res.render('admin/login', {
      title: 'GS Infra Estates - Admin Login',
      email: req.session.adminEmail || null,
      adminEmail: process.env.ADMINEMAIL || 'gauravsaklani021106@gmail.com',
    });
  } catch (err) {
    console.error('❌ Login view error:', err);
    res.status(500).send('Server error');
  }
};

// ======================= LOGIN STEP 1 (EMAIL + PASSWORD) =======================
exports.loginStep1 = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ ok: false, error: 'Email and password are required' });
    }

    const ADMINEMAIL = process.env.ADMINEMAIL;
    const ADMINPASS = process.env.ADMINPASS;

    if (username !== ADMINEMAIL || password !== ADMINPASS) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    const code = generateOTP();

    req.session.otp = {
      code,
      expiry: Date.now() + 10 * 60 * 1000,
      attempts: 0,
      username: ADMINEMAIL,
    };

    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await sendOtpEmail(ADMINEMAIL, code);

    console.log(`✅ OTP generated for Admin: ${ADMINEMAIL}`);
    return res.json({
      ok: true,
      username: ADMINEMAIL,
      message: 'Code sent to your email! Check inbox/spam folder.',
    });
  } catch (error) {
    console.error('❌ Login Step 1 Error:', {
      name: error.name,
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
    });

    if (req.session.otp) {
      delete req.session.otp;
      req.session.save(() => {});
    }

    const status = Number.isInteger(error.statusCode) ? error.statusCode : 503;

    return res.status(status).json({
      ok: false,
      error: 'Unable to send verification code',
      resendError: {
        name: error.name || null,
        message: error.message || null,
        code: error.code || null,
        statusCode: error.statusCode || null,
      },
    });
  }
};

// ======================= LOGIN STEP 2 (VERIFY OTP) =======================
exports.loginVerify = async (req, res) => {
  try {
    const { verificationCode } = req.body;

    if (!verificationCode) {
      return res
        .status(400)
        .json({ ok: false, error: 'Verification code required' });
    }

    const otpSession = req.session.otp;

    if (!otpSession) {
      return res.status(400).json({
        ok: false,
        error: 'No active verification session. Please login again.',
      });
    }

    if (otpSession.attempts >= 5) {
      delete req.session.otp;
      await new Promise((resolve) => req.session.save(resolve));
      return res.status(400).json({
        ok: false,
        error: 'Too many attempts. Please login again.',
      });
    }

    if (otpSession.expiry < Date.now()) {
      delete req.session.otp;
      await new Promise((resolve) => req.session.save(resolve));
      return res
        .status(400)
        .json({ ok: false, error: 'Code expired. Please login again.' });
    }

    if (verificationCode !== otpSession.code) {
      otpSession.attempts += 1;
      await new Promise((resolve) => req.session.save(resolve));

      return res.status(400).json({
        ok: false,
        error: `Invalid code. Attempt ${otpSession.attempts}/5`,
      });
    }

    const ADMINEMAIL =
      process.env.ADMINEMAIL || 'gauravsaklani021106@gmail.com';

    req.session.isAdmin = true;
    req.session.adminEmail = ADMINEMAIL;

    delete req.session.otp;

    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log(`✅ Admin logged in: ${ADMINEMAIL}`);
    return res.json({ ok: true, redirect: '/admin/dashboard' });
  } catch (error) {
    console.error('❌ Login Verify Error:', error);
    return res
      .status(500)
      .json({ ok: false, error: 'Session verification failed' });
  }
};

// ======================= LOGOUT =======================
exports.logoutAdmin = (req, res) => {
  try {
    const adminEmail =
      req.session.adminEmail ||
      process.env.ADMINEMAIL ||
      'gauravsaklani021106@gmail.com';

    req.session.destroy((err) => {
      if (err) {
        console.error('❌ Logout error:', err);
      } else {
        console.log(`👋 Admin logged out: ${adminEmail}`);
      }
      res.redirect('/');
    });
  } catch (err) {
    console.error('❌ Logout error:', err);
    res.redirect('/');
  }
};

// ======================= DASHBOARD VIEW =======================
exports.dashboard = async (req, res) => {
  try {
    const props = await Property.find().sort({ createdAt: -1 });
    const { flats, plots, agri } = splitByCategory(props);
    const editingProperty = req.query.id
      ? await Property.findById(req.query.id)
      : null;

    res.render('admin/dashboard', {
      title: 'Admin Dashboard - GS Infra Estates',
      flats,
      plots,
      agri,
      email:
        req.session.adminEmail ||
        process.env.ADMINEMAIL ||
        'gauravsaklani021106@gmail.com',
      editingProperty,
      status: req.query.status || null,
    });
  } catch (err) {
    console.error('❌ Dashboard error:', err);
    res.status(500).render('admin/dashboard', {
      title: 'Admin Dashboard Error',
      flats: [],
      plots: [],
      agri: [],
      email:
        req.session.adminEmail ||
        process.env.ADMINEMAIL ||
        'gauravsaklani021106@gmail.com',
      error: 'Failed to load properties',
    });
  }
};

// ======================= LIST PROPERTIES AS JSON =======================
exports.listPropertiesJson = async (req, res) => {
  try {
    const props = await Property.find().sort({ createdAt: -1 });
    const { flats, plots, agri } = splitByCategory(props);
    res.json({ ok: true, flats, plots, agri });
  } catch (err) {
    console.error('❌ List properties JSON error:', err);
    res.status(500).json({ ok: false, error: 'Failed to load properties' });
  }
};

// ======================= CREATE PROPERTY =======================
exports.createProperty = async (req, res) => {
  try {
    let {
      category,
      title,
      description,
      price,
      location,
      suitableFor,
      status,
      sqft,
      city,
      state,
    } = req.body;

    if (!category || !title || !price || !location) {
      const msg = 'Missing required fields';
      return wantsJson(req)
        ? res.status(400).json({ ok: false, error: msg })
        : res.status(400).send(msg);
    }

    if ((!city || !state) && location) {
      const parts = location.split(',').map((p) => p.trim());
      if (!city && parts.length >= 1) city = parts[0];
      if (!state && parts.length >= 2) state = parts[1];
    }

    const suitableArr = suitableFor
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const uploads = (file) => `/uploads/${file.filename}`;

    const map3dFile = req.files?.map3dFile?.[0]
      ? uploads(req.files.map3dFile[0])
      : null;
    const virtualTourFile = req.files?.virtualTourFile?.[0]
      ? uploads(req.files.virtualTourFile[0])
      : null;

    const imageArr =
      req.files?.images?.slice(0, 10).map((f) => uploads(f)) || [];
    const videoArr =
      req.files?.videos?.slice(0, 10).map((f) => uploads(f)) || [];

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
      city,
      state,
    });

    console.log(`✅ Property created: ${title} (ID: ${property.id})`);

    notifyNewProperty(property).catch((err) => {
      console.error('❌ Property alert send failed:', err.message);
    });

    if (wantsJson(req)) {
      return res.status(201).json({ ok: true, property });
    }
    return res.redirect('/admin/dashboard?status=created');
  } catch (err) {
    console.error('❌ Create property error:', err);
    return wantsJson(req)
      ? res.status(500).json({ ok: false, error: 'Failed to create property' })
      : res.status(500).send('Failed to create property');
  }
};

// ======================= EDIT FORM (for URL-based edit) =======================
exports.editForm = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).send('Property not found');
    }

    const props = await Property.find().sort({ createdAt: -1 });
    const { flats, plots, agri } = splitByCategory(props);

    res.render('admin/dashboard', {
      title: 'Admin Dashboard - GS Infra Estates',
      flats,
      plots,
      agri,
      email:
        req.session.adminEmail ||
        process.env.ADMINEMAIL ||
        'gauravsaklani021106@gmail.com',
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

    const uploads = (file) => `/uploads/${file.filename}`;

    if (req.files?.map3dFile?.[0]) {
      updates.map3dUrl = uploads(req.files.map3dFile[0]);
    }

    if (req.files?.virtualTourFile?.[0]) {
      updates.virtualTourUrl = uploads(req.files.virtualTourFile[0]);
    }

    if (req.files?.images) {
      const newImgs = req.files.images.map((f) => uploads(f));
      updates.imageUrls = updates.imageUrls
        ? [...updates.imageUrls, ...newImgs]
        : newImgs;
    }

    if (req.files?.videos) {
      const newVids = req.files.videos.map((f) => uploads(f));
      updates.videoUrls = updates.videoUrls
        ? [...updates.videoUrls, ...newVids]
        : newVids;
    }

    const property = await Property.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!property) {
      const msg = 'Property not found';
      return wantsJson(req)
        ? res.status(404).json({ ok: false, error: msg })
        : res.status(404).send(msg);
    }

    console.log(`✅ Property updated: ${property.title}`);

    if (wantsJson(req)) {
      return res.json({ ok: true, property });
    }
    return res.redirect('/admin/dashboard?status=updated');
  } catch (err) {
    console.error('❌ Update property error:', err);
    return wantsJson(req)
      ? res.status(500).json({ ok: false, error: 'Update failed' })
      : res.status(500).send('Update failed');
  }
};

// ======================= DELETE PROPERTY =======================
exports.deleteProperty = async (req, res) => {
  try {
    const property = await Property.findByIdAndDelete(req.params.id);

    if (!property) {
      const msg = 'Property not found';
      return wantsJson(req)
        ? res.status(404).json({ ok: false, error: msg })
        : res.status(404).send(msg);
    }

    console.log(`🗑️ Property deleted: ${property.title}`);

    if (wantsJson(req)) {
      return res.json({ ok: true, id: property._id });
    }
    return res.redirect('/admin/dashboard?status=deleted');
  } catch (err) {
    console.error('❌ Delete property error:', err);
    return wantsJson(req)
      ? res.status(500).json({ ok: false, error: 'Delete failed' })
      : res.status(500).send('Delete failed');
  }
};
