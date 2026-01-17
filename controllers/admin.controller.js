// controllers/admin.controller.js
const Property = require('../models/property');
const { Resend } = require('resend');
const { notifyNewProperty } = require('../services/alertsService');
const path = require('path');
const { getRawUrls, optimizeBackground } = require('../utils/mediaOptimizer');

const resend = new Resend(process.env.RESEND_API_KEY);

// ======================= CONSTANTS =======================
const ADMIN_FALLBACK_EMAIL = 'gauravsaklani021106@gmail.com';

// [MEMORY OPTIMIZATION] Select only fields needed for the dashboard card view
const DASHBOARD_SELECT = 'title category price status location city imageUrls createdAt featured active';

// ======================= HELPERS =========================
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
    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: adminEmail,
      subject: '🔐 GS Infra Estates - Admin Login Verification',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5; border-radius: 10px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Admin Verification Code</h2>
          <h1 style="color: #0066cc; font-size: 32px;">${code}</h1>
          <p>Valid for 10 minutes.</p>
        </div>
      `,
    });
    if (error) throw new Error(error.message);
    return data;
  } catch (err) {
    console.error('❌ Admin OTP Error:', err);
    throw err;
  }
}

// ======================= LOGIN VIEW ======================
exports.showLogin = (req, res, next) => {
  res.render('admin/login', {
    title: 'GS Infra Estates - Admin Login',
    email: req.session.adminEmail || null,
    adminEmail: process.env.ADMINEMAIL || ADMIN_FALLBACK_EMAIL,
    error: null,
    message: null,
    seo: { title: 'Admin Login', desc: 'Admin login', keywords: '' },
  });
};

// ======================= LOGIN STEP 1 ====================
exports.loginStep1 = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (username !== process.env.ADMINEMAIL || password !== process.env.ADMINPASS) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }
    const code = generateOTP();
    req.session.otp = { code, expiry: Date.now() + 10 * 60 * 1000, attempts: 0 };
    await new Promise((resolve) => req.session.save(resolve));
    await sendOtpEmail(process.env.ADMINEMAIL, code);
    return res.json({ ok: true, message: 'Code sent to email.' });
  } catch (error) {
    console.error('❌ Login Step 1 Error:', error);
    return res.status(500).json({ ok: false, error: 'Error sending code' });
  }
};

// ======================= LOGIN STEP 2 ====================
exports.loginVerify = async (req, res) => {
  try {
    const { verificationCode } = req.body;
    const otpSession = req.session.otp;

    if (!otpSession || otpSession.expiry < Date.now()) {
      return res.status(400).json({ ok: false, error: 'Code expired or invalid' });
    }
    if (verificationCode !== otpSession.code) {
      return res.status(400).json({ ok: false, error: 'Invalid code' });
    }

    req.session.isAdmin = true;
    req.session.adminEmail = process.env.ADMINEMAIL;
    delete req.session.otp;
    await new Promise((resolve) => req.session.save(resolve));

    return res.json({ ok: true, redirect: '/admin/dashboard' });
  } catch (error) {
    console.error('Login verify error', error);
    return res.status(500).json({ ok: false, error: 'Verification failed' });
  }
};

// ======================= LOGOUT ==========================
exports.logoutAdmin = (req, res) => {
  req.session.destroy(() => res.redirect('/'));
};

// ======================= DASHBOARD VIEW =================
exports.dashboard = async (req, res) => {
  try {
    // [MEMORY FIX] Select only necessary fields and use lean() to reduce object size
    const [props, editingProperty] = await Promise.all([
      Property.find()
        .select(DASHBOARD_SELECT)
        .sort({ createdAt: -1 })
        .limit(500) // Safety limit
        .lean(),
      req.query.id ? Property.findById(req.query.id).lean() : null,
    ]);

    const buckets = splitIntoAdminBuckets(props);

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
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
    res.status(500).send('Dashboard Error');
  }
};

// ======================= LIST PROPERTIES JSON ===========
exports.listPropertiesJson = async (req, res) => {
  try {
    // [MEMORY FIX] Select only necessary fields
    const props = await Property.find()
      .select(DASHBOARD_SELECT)
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();
    const buckets = splitIntoAdminBuckets(props);
    res.json({ ok: true, ...buckets });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Failed' });
  }
};

// ======================= CREATE PROPERTY =================
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

    // 1. Get raw URLs immediately
    const rawMedia = getRawUrls(req.files || {});

    // 2. Create DB entry with raw media first
    const property = await Property.create({
      category, title, description,
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
      city, state, locality, pincode
    });

    console.log(`✅ Property created (Raw): ${title}`);

    // 3. Send response immediately (before processing media)
    if (wantsJson(req)) {
       res.status(201).json({ ok: true, property, message: "Created. Processing media in background." });
    } else {
       res.redirect('/admin/dashboard?status=created');
    }

    // 4. Trigger background optimization (Fire & Forget)
    if (req.files) {
        optimizeBackground(property._id, req.files);
    }
    notifyNewProperty(property).catch(e => console.error(e));

  } catch (err) {
    console.error('❌ Create property error:', err);
    return wantsJson(req) ? res.status(500).json({ ok: false, error: err.message }) : res.status(500).send(err.message);
  }
};

// ======================= UPDATE PROPERTY =================
exports.updateProperty = async (req, res) => {
  try {
    const updates = { ...req.body };
    updates.active = req.body.active === 'on';
    updates.featured = req.body.featured === 'on';

    if (typeof updates.suitableFor === 'string') updates.suitableFor = updates.suitableFor.split(',').filter(Boolean);
    if (typeof updates.features === 'string') updates.features = updates.features.split(',').filter(Boolean);
    if (typeof updates.searchTags === 'string') updates.searchTags = updates.searchTags.split(',').filter(Boolean);

    let rawMedia = { imageUrls: [], videoUrls: [], virtualTourUrl: null };
    if (req.files && Object.keys(req.files).length > 0) {
      rawMedia = getRawUrls(req.files);
    }

    const currentProp = await Property.findById(req.params.id);
    if (!currentProp) return res.status(404).send('Not Found');

    if (rawMedia.map3dUrl) updates.map3dUrl = rawMedia.map3dUrl;
    if (rawMedia.virtualTourUrl) updates.virtualTourUrl = rawMedia.virtualTourUrl;
    if (rawMedia.imageUrls.length > 0) updates.imageUrls = [...currentProp.imageUrls, ...rawMedia.imageUrls];
    if (rawMedia.videoUrls.length > 0) updates.videoUrls = [...currentProp.videoUrls, ...rawMedia.videoUrls];

    const property = await Property.findByIdAndUpdate(req.params.id, updates, { new: true }).lean();

    if (wantsJson(req)) res.json({ ok: true, property });
    else res.redirect('/admin/dashboard?status=updated');

    if (req.files && Object.keys(req.files).length > 0) {
       optimizeBackground(property._id, req.files);
    }

  } catch (err) {
    console.error(err);
    res.status(500).send('Update failed');
  }
};

exports.editForm = async (req, res) => {
  req.query.id = req.params.id;
  return exports.dashboard(req, res); 
};

exports.deleteProperty = async (req, res) => {
  try {
    const property = await Property.findByIdAndDelete(req.params.id).lean();
    if (wantsJson(req)) return res.json({ ok: true });
    return res.redirect('/admin/dashboard?status=deleted');
  } catch (err) {
    res.status(500).send('Delete failed');
  }
};

module.exports = exports;