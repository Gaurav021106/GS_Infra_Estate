// controllers/admin.controller.js
const Property = require('../models/property');
const { Resend } = require('resend');
const { notifyNewProperty } = require('../services/alertsService');
const path = require('path');
// CHANGED: Use new helpers for background processing
const { getRawUrls, optimizeBackground } = require('../utils/mediaOptimizer');

const resend = new Resend(process.env.RESEND_API_KEY);

// ======================= CONSTANTS =======================
const ADMIN_FALLBACK_EMAIL = 'gauravsaklani021106@gmail.com';

// ======================= HELPERS =========================
/**
 * Helper to determine if the client expects JSON response
 */
const wantsJson = (req) =>
  req.xhr ||
  (req.headers.accept && req.headers.accept.includes('application/json')) ||
  (req.headers['content-type'] && req.headers['content-type'].includes('json'));

const getAdminEmail = (req) =>
  req.session.adminEmail ||
  process.env.ADMINEMAIL ||
  ADMIN_FALLBACK_EMAIL;

const splitIntoAdminBuckets = (props) => ({
  residential: props.filter((p) => p.category === 'residential_properties'),
  commercialPlots: props.filter((p) => p.category === 'commercial_plots'),
  landPlots: props.filter((p) => p.category === 'land_plots'),
  premiumInvestment: props.filter((p) => p.category === 'premium_investment'),
});

const generateOTP = () => {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < 6; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
};


// ======================= SEND ADMIN OTP EMAIL ============
async function sendOtpEmail(adminEmail, code) {
  try {
    console.log('📤 Sending Admin OTP:', {
      from: process.env.FROM_EMAIL,
      toEnv: process.env.ADMINEMAIL,
      toParam: adminEmail,
    });

    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: adminEmail,
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
              If you didn't request this code, please ignore this email.
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('❌ Resend send error:', error);
      throw new Error(error.message || 'Failed to send email via Resend');
    }

    console.log('✅ Admin OTP sent:', { id: data?.id });
    return data;
  } catch (err) {
    console.error('❌ Admin OTP Error:', err);
    throw err;
  }
}

// ======================= LOGIN VIEW ======================
exports.showLogin = (req, res, next) => {
  try {
    res.render('admin/login', {
      title: 'GS Infra Estates - Admin Login',
      email: req.session.adminEmail || null,
      adminEmail: process.env.ADMINEMAIL || ADMIN_FALLBACK_EMAIL,
      error: null,
      message: null,
      seo: {
        title: 'Admin Login | GS Infra Estates',
        desc: 'Secure admin login panel for GS Infra Estates.',
        keywords: 'admin login, gs infra estates, dashboard',
      },
    });
  } catch (err) {
    console.error('❌ Login view error:', err);
    next(err);
  }
};

// ======================= LOGIN STEP 1 ====================
exports.loginStep1 = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ ok: false, error: 'Email and password are required' });
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
    };

    await new Promise((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    await sendOtpEmail(ADMINEMAIL, code);

    console.log(`✅ OTP generated for Admin: ${ADMINEMAIL}`);
    return res.json({
      ok: true,
      username: ADMINEMAIL,
      message: 'Code sent to your email! Check inbox/spam folder.',
    });
  } catch (error) {
    console.error('❌ Login Step 1 Error:', error);

    if (req.session.otp) {
      delete req.session.otp;
      req.session.save(() => {});
    }

    const status = Number.isInteger(error.statusCode) ? error.statusCode : 503;
    return res.status(status).json({
      ok: false,
      error: 'Unable to send verification code',
    });
  }
};

// ======================= LOGIN STEP 2 ====================
exports.loginVerify = async (req, res) => {
  try {
    const { verificationCode } = req.body;

    if (!verificationCode) return res.status(400).json({ ok: false, error: 'Verification code required' });

    const otpSession = req.session.otp;

    if (!otpSession) return res.status(400).json({ ok: false, error: 'No active verification session. Please login again.' });

    if (otpSession.attempts >= 5) {
      delete req.session.otp;
      await new Promise((resolve) => req.session.save(resolve));
      return res.status(400).json({ ok: false, error: 'Too many attempts. Please login again.' });
    }

    if (otpSession.expiry < Date.now()) {
      delete req.session.otp;
      await new Promise((resolve) => req.session.save(resolve));
      return res.status(400).json({ ok: false, error: 'Code expired. Please login again.' });
    }

    if (verificationCode !== otpSession.code) {
      otpSession.attempts += 1;
      await new Promise((resolve) => req.session.save(resolve));
      return res.status(400).json({ ok: false, error: `Invalid code. Attempt ${otpSession.attempts}/5` });
    }

    const ADMINEMAIL = process.env.ADMINEMAIL || ADMIN_FALLBACK_EMAIL;

    req.session.isAdmin = true;
    req.session.adminEmail = ADMINEMAIL;
    delete req.session.otp;

    await new Promise((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    console.log(`✅ Admin logged in: ${ADMINEMAIL}`);
    return res.json({ ok: true, redirect: '/admin/dashboard' });
  } catch (error) {
    console.error('❌ Login Verify Error:', error);
    return res.status(500).json({ ok: false, error: 'Session verification failed' });
  }
};

// ======================= LOGOUT ==========================
exports.logoutAdmin = (req, res) => {
  try {
    const adminEmail = getAdminEmail(req);
    req.session.destroy((err) => {
      if (err) console.error('❌ Logout error:', err);
      else console.log(`👋 Admin logged out: ${adminEmail}`);
      res.redirect('/');
    });
  } catch (err) {
    console.error('❌ Logout error:', err);
    res.redirect('/');
  }
};

// ======================= DASHBOARD VIEW =================
exports.dashboard = async (req, res) => {
  try {
    const [props, editingProperty] = await Promise.all([
      Property.find().sort({ createdAt: -1 }).lean(),
      req.query.id ? Property.findById(req.query.id).lean() : null,
    ]);

    const buckets = splitIntoAdminBuckets(props);

    res.render('admin/dashboard', {
      title: 'Admin Dashboard - GS Infra Estates',
      residential: buckets.residential,
      commercialPlots: buckets.commercialPlots,
      landPlots: buckets.landPlots,
      premiumInvestment: buckets.premiumInvestment,
      email: getAdminEmail(req),
      editingProperty,
      status: req.query.status || null,
    });
  } catch (err) {
    console.error('❌ Dashboard error:', err);
    res.status(500).render('admin/dashboard', {
      title: 'Admin Dashboard Error',
      residential: [],
      commercialPlots: [],
      landPlots: [],
      premiumInvestment: [],
      email: getAdminEmail(req),
      error: 'Failed to load properties',
    });
  }
};

// ======================= LIST PROPERTIES JSON ===========
exports.listPropertiesJson = async (req, res) => {
  try {
    const props = await Property.find().sort({ createdAt: -1 }).limit(1000).lean();
    const buckets = splitIntoAdminBuckets(props);
    res.json({ ok: true, ...buckets });
  } catch (err) {
    console.error('❌ List properties JSON error:', err);
    res.status(500).json({ ok: false, error: 'Failed to load properties' });
  }
};

// ======================= CREATE PROPERTY (OPTIMIZED) =================
exports.createProperty = async (req, res) => {
  try {
    let {
      category, title, description, price, location, suitableFor,
      status, sqft, city, state, locality, pincode, features,
      searchTags, seoMetaDescription
    } = req.body;

    if (!category || !title || !price || !location) {
      const msg = 'Missing required fields';
      return wantsJson(req) ? res.status(400).json({ ok: false, error: msg }) : res.status(400).send(msg);
    }

    if ((!city || !state) && location) {
      const parts = location.split(',').map((p) => p.trim());
      if (!city && parts.length >= 1) city = parts[0];
      if (!state && parts.length >= 2) state = parts[1];
    }

    const suitableArr = suitableFor?.split(',').map((s) => s.trim()).filter(Boolean) || [];
    const featuresArr = features?.split(',').map((s) => s.trim()).filter(Boolean) || [];
    const searchTagsArr = searchTags?.split(',').map((s) => s.trim()).filter(Boolean) || [];

    // 1. GET RAW URLS (FAST) - Returns unoptimized paths instantly
    const rawMedia = getRawUrls(req.files || {});

    // 2. SAVE PROPERTY IMMEDIATELY using raw media
    const property = await Property.create({
      category,
      title,
      description,
      price: Number(price),
      location,
      suitableFor: suitableArr,
      features: featuresArr,
      searchTags: searchTagsArr,
      seoMetaDescription,
      status: status || 'available',
      map3dUrl: rawMedia.map3dUrl,
      virtualTourUrl: rawMedia.virtualTourUrl,
      imageUrls: rawMedia.imageUrls,
      videoUrls: rawMedia.videoUrls,
      builtupArea: sqft,
      city,
      state,
      locality,
      pincode
    });

    console.log(`✅ Property created (Raw): ${title} (ID: ${property.id})`);

    // 3. SEND RESPONSE IMMEDIATELY
    if (wantsJson(req)) {
       res.status(201).json({ ok: true, property, message: "Property created. Media processing in background." });
    } else {
       res.redirect('/admin/dashboard?status=created');
    }

    // 4. TRIGGER BACKGROUND OPTIMIZATION (FIRE & FORGET)
    if (req.files) {
        // This runs asynchronously after response is sent
        optimizeBackground(property._id, req.files);
    }

    // 5. Send Alert (Async)
    notifyNewProperty(property).catch((err) => console.error('❌ Alert failed:', err.message));

  } catch (err) {
    console.error('❌ Create property error:', err);
    return wantsJson(req)
      ? res.status(500).json({ ok: false, error: err.message })
      : res.status(500).send(err.message);
  }
};

// ======================= EDIT FORM =======================
exports.editForm = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).lean();
    if (!property) return res.status(404).send('Property not found');

    const props = await Property.find().sort({ createdAt: -1 }).limit(1000).lean();
    const buckets = splitIntoAdminBuckets(props);

    res.render('admin/dashboard', {
      title: 'Admin Dashboard - GS Infra Estates',
      residential: buckets.residential,
      commercialPlots: buckets.commercialPlots,
      landPlots: buckets.landPlots,
      premiumInvestment: buckets.premiumInvestment,
      email: getAdminEmail(req),
      editingProperty: property,
      status: null,
    });
  } catch (err) {
    console.error('❌ Edit form error:', err);
    res.status(500).send('Server error');
  }
};

// ======================= UPDATE PROPERTY (OPTIMIZED) =================
exports.updateProperty = async (req, res) => {
  try {
    const updates = { ...req.body };

    // Handle Checkboxes
    updates.active = req.body.active === 'on';
    updates.featured = req.body.featured === 'on';

    // Parse Comma-Separated Fields
    if (typeof updates.suitableFor === 'string') {
      updates.suitableFor = updates.suitableFor.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (typeof updates.features === 'string') {
      updates.features = updates.features.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (typeof updates.searchTags === 'string') {
      updates.searchTags = updates.searchTags.split(',').map((s) => s.trim()).filter(Boolean);
    }

    // 1. GET NEW RAW MEDIA
    let rawMedia = { imageUrls: [], videoUrls: [], virtualTourUrl: null };
    if (req.files && Object.keys(req.files).length > 0) {
      rawMedia = getRawUrls(req.files);
    }

    // 2. FETCH CURRENT PROPERTY TO APPEND
    const currentProp = await Property.findById(req.params.id);
    if (!currentProp) return res.status(404).send('Property not found');

    if (rawMedia.map3dUrl) updates.map3dUrl = rawMedia.map3dUrl;
    if (rawMedia.virtualTourUrl) updates.virtualTourUrl = rawMedia.virtualTourUrl;

    // Append new raw files to existing ones (Images/Videos)
    if (rawMedia.imageUrls.length > 0) {
      updates.imageUrls = [...currentProp.imageUrls, ...rawMedia.imageUrls];
    }
    if (rawMedia.videoUrls.length > 0) {
      updates.videoUrls = [...currentProp.videoUrls, ...rawMedia.videoUrls];
    }

    // 3. UPDATE DB IMMEDIATELY
    const property = await Property.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).lean();

    console.log(`✅ Property updated (Raw): ${property.title}`);

    // 4. SEND RESPONSE
    if (wantsJson(req)) {
       res.json({ ok: true, property });
    } else {
       res.redirect('/admin/dashboard?status=updated');
    }

    // 5. TRIGGER BACKGROUND OPTIMIZATION
    if (req.files && Object.keys(req.files).length > 0) {
       optimizeBackground(property._id, req.files);
    }

  } catch (err) {
    console.error('❌ Update property error:', err);
    return wantsJson(req) ? res.status(500).json({ ok: false, error: 'Update failed' }) : res.status(500).send('Update failed');
  }
};

// ======================= DELETE PROPERTY =================
exports.deleteProperty = async (req, res) => {
  try {
    const property = await Property.findByIdAndDelete(req.params.id).lean();
    if (!property) {
      const msg = 'Property not found';
      return wantsJson(req) ? res.status(404).json({ ok: false, error: msg }) : res.status(404).send(msg);
    }
    console.log(`🗑️ Property deleted: ${property.title}`);
    if (wantsJson(req)) return res.json({ ok: true, id: property._id });
    return res.redirect('/admin/dashboard?status=deleted');
  } catch (err) {
    console.error('❌ Delete property error:', err);
    return wantsJson(req) ? res.status(500).json({ ok: false, error: 'Delete failed' }) : res.status(500).send('Delete failed');
  }
};

module.exports = exports;