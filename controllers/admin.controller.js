const Property = require('../models/property');
const { Resend } = require('resend');
const { generateOTP, splitByCategory } = require('../utils/propertyHelpers');

// Create transporter with proper Gmail settings
const transporter = nodemailer.createTransport({
  service: 'gmail', // Let Nodemailer handle Gmail config automatically
  auth: {
    user: 'gs.infra.estates@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD, // Must be 16-char App Password
  },
});

// Test Resend connection on startup
resend.emails.list().then(() => {
  console.log('✅ Resend API Connected Successfully');
}).catch(err => {
  console.error('❌ Resend API Connection Failed:', err.message);
});

// Helper function - Admin: gauravsaklani → gs.infra
async function sendOtpEmail(adminEmail, code) {
  try {
    console.log(`📤 Sending Admin OTP: ${process.env.FROM_EMAIL} --> ${process.env.ADMINEMAIL}`);

    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL,        // SENDER: gs.infra
      to: process.env.ADMINEMAIL,          // ADMIN: gauravsaklani
      subject: '🔐 GS Infra Estates - Admin Login Verification',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5; border-radius: 10px; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #0066cc 0%, #0080ff 100%); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">GS Infra Estates</h1>
          </div>
          <div style="background-color: #fff; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-bottom: 20px;">Admin Login Verification</h2>
            <p style="font-size: 16px; color: #666; margin-bottom: 20px;">
              Admin login request from GS Infra system to: <strong>${adminEmail}</strong>
            </p>
            <div style="background-color: #f8f9fa; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 25px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              <h1 style="color: #0066cc; font-size: 48px; letter-spacing: 8px; margin: 0; font-weight: bold;">${code}</h1>
            </div>
            <p style="color: #ff6b35; font-size: 14px; font-weight: bold; margin-bottom: 10px;">
              ⏱️ Valid for 10 minutes only
            </p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #999; font-size: 12px; line-height: 1.5;">
              Sent from: <strong>${process.env.FROM_EMAIL}</strong><br>
              If you didn't request this code, please ignore this email and contact support immediately.
            </p>
          </div>
          <div style="text-align: center; padding: 15px; background-color: #f8f9fa; border-radius: 0 0 10px 10px; margin-top: -10px;">
            <p style="color: #666; font-size: 11px; margin: 0;">GS Infra Estates © 2025</p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('✅ RESEND API WORKING BUT DOMAIN ISSUE:', {
        message: error.message,
        code: error.code,
        from: process.env.FROM_EMAIL,
        to: adminEmail
      });

      if (error.message.includes('domain') || error.message.includes('sender')) {
        console.log('🔧 Resend API successful but domain verification pending. Check Resend Dashboard → Domains');
      }

      // User-facing error
      throw new Error('Server timeout - unable to send verification code');
    }

    console.log(`✅ Admin OTP sent: ${process.env.ADMINEMAIL} ← ${process.env.FROM_EMAIL} [ID: ${data.id}]`);
    return data;
  } catch (err) {
    console.error('❌ Admin OTP Error (Console Only):', err.message);
    // Always show generic timeout message to users
    throw new Error('Server timeout - unable to send verification code');
  }
}

// LOGIN VIEW
exports.showLogin = (req, res) => {
  try {
    res.render('admin/login', { 
      title: 'GS Infra Estates - Admin Login',
      email: req.session.adminEmail || null,
      adminEmail: process.env.ADMINEMAIL || 'gauravsaklani021106@gmail.com'
    });
  } catch (err) {
    console.error('Login view error:', err);
    res.status(500).send('Server error');
  }
};

// LOGIN STEP 1 - EMAIL + PASSWORD
exports.loginStep1 = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ ok: false, error: 'Email and password are required' });
    }

    const ADMINEMAIL = process.env.ADMINEMAIL || 'gauravsaklani021106@gmail.com';
    const ADMINPASS = process.env.ADMINPASS || 'SAKLANI021106';
    
    if (username !== ADMINEMAIL || password !== ADMINPASS) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    const code = generateOTP();
    
    // Store in session
    req.session.otp = {
      code,
      expiry: Date.now() + 10 * 60 * 1000,
      attempts: 0,
      username: ADMINEMAIL
    };
    
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Send OTP (errors handled above - user sees generic timeout)
    await sendOtpEmail(ADMINEMAIL, code);
    console.log(`🔐 OTP generated for Admin: ${ADMINEMAIL}`);
    res.json({ 
      ok: true, 
      username: ADMINEMAIL,
      message: 'Code sent to your email! Check inbox/spam folder.'
    });
    
  } catch (error) {
    console.error('❌ Login Step 1 Error (Console Only):', error.message);
    
    if (req.session.otp) {
      delete req.session.otp;
      req.session.save();
    }
    
    res.status(503).json({ 
      ok: false, 
      error: 'Unable to send verification code. Please try again in a moment.'
    });
  }
};

// LOGIN STEP 2 - VERIFY OTP
exports.loginVerify = async (req, res) => {
  try {
    const { verificationCode } = req.body;
    
    if (!verificationCode) {
      return res.status(400).json({ ok: false, error: 'Verification code required' });
    }

    const otpSession = req.session.otp;
    
    if (!otpSession) {
      return res.status(400).json({ ok: false, error: 'No active verification session. Please login again.' });
    }

    if (otpSession.attempts >= 5) {
      delete req.session.otp;
      await new Promise(resolve => req.session.save(resolve));
      return res.status(400).json({ ok: false, error: 'Too many attempts. Please login again.' });
    }

    if (otpSession.expiry < Date.now()) {
      delete req.session.otp;
      await new Promise(resolve => req.session.save(resolve));
      return res.status(400).json({ ok: false, error: 'Code expired. Please login again.' });
    }

    if (verificationCode !== otpSession.code) {
      otpSession.attempts += 1;
      await new Promise(resolve => req.session.save(resolve));
      return res.status(400).json({ 
        ok: false, 
        error: `Invalid code. Attempt ${otpSession.attempts}/5` 
      });
    }

    const ADMINEMAIL = process.env.ADMINEMAIL || 'gauravsaklani021106@gmail.com';

    // Success
    req.session.isAdmin = true;
    req.session.adminEmail = ADMINEMAIL;
    delete req.session.otp;
    
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    console.log('✅ Admin logged in:', ADMINEMAIL);
    res.json({ ok: true, redirect: '/admin/dashboard' });
    
  } catch (error) {
    console.error('❌ Login Verify Error:', error);
    res.status(500).json({ ok: false, error: 'Session verification failed' });
  }
};

// LOGOUT
exports.logoutAdmin = (req, res) => {
  try {
    const adminEmail = req.session.adminEmail || process.env.ADMINEMAIL || 'gauravsaklani021106@gmail.com';
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
      } else {
        console.log('👋 Admin logged out:', adminEmail);
      }
    });
    res.redirect('/');
  } catch (err) {
    console.error('Logout error:', err);
    res.redirect('/');
  }
};

// DASHBOARD
exports.dashboard = async (req, res) => {
  try {
    const props = await Property.find().sort({ createdAt: -1 });
    const [flats, plots, agri] = splitByCategory(props);
    
    res.render('admin/dashboard', {
      title: 'Admin Dashboard - GS Infra Estates',
      flats, plots, agri,
      email: req.session.adminEmail || process.env.ADMINEMAIL || 'gauravsaklani021106@gmail.com',
      editingProperty: null,
      status: req.query.status || null
    });
  } catch (err) {
    console.error('❌ Dashboard error:', err);
    res.status(500).render('admin/dashboard', {
      title: 'Admin Dashboard Error',
      flats: [], plots: [], agri: [],
      email: req.session.adminEmail,
      error: 'Failed to load properties'
    });
  }
};

// CREATE PROPERTY
exports.createProperty = async (req, res) => {
  try {
    const { category, title, description, price, location, suitableFor, status, sqft } = req.body;
    
    if (!category || !title || !price || !location) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const suitableArr = suitableFor?.split(',').map(s => s.trim()).filter(Boolean);
    const map3dFile = req.files?.map3dFile?.[0] ? `uploads/${req.files.map3dFile[0].filename}` : null;
    const virtualTourFile = req.files?.virtualTourFile?.[0] ? `uploads/${req.files.virtualTourFile[0].filename}` : null;
    const imageArr = req.files?.images?.slice(0, 10).map(f => `uploads/${f.filename}`);
    const videoArr = req.files?.videos?.slice(0, 10).map(f => `uploads/${f.filename}`);

    const property = await Property.create({
      category, title, description, price, location,
      suitableFor: suitableArr, status: status || 'available',
      map3dUrl: map3dFile, virtualTourUrl: virtualTourFile,
      imageUrls: imageArr, videoUrls: videoArr, sqft
    });

    console.log(`🏠 Property created: ${title} ID: ${property.id}`);
    res.redirect('/admin/dashboard?status=created');
  } catch (err) {
    console.error('❌ Create property error:', err);
    res.status(500).json({ error: 'Failed to create property' });
  }
};

// EDIT FORM
exports.editForm = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).send('Property not found');

    const props = await Property.find().sort({ createdAt: -1 });
    const [flats, plots, agri] = splitByCategory(props);

    res.render('admin/dashboard', {
      title: 'Admin Dashboard - GS Infra Estates',
      flats, plots, agri,
      email: req.session.adminEmail || process.env.ADMINEMAIL || 'gauravsaklani021106@gmail.com',
      editingProperty: property,
      status: null
    });
  } catch (err) {
    console.error('❌ Edit form error:', err);
    res.status(500).send('Server error');
  }
};

// UPDATE PROPERTY
exports.updateProperty = async (req, res) => {
  try {
    const updates = { ...req.body };
    
    if (updates.suitableFor) {
      updates.suitableFor = updates.suitableFor.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (req.files) {
      if (req.files.map3dFile) updates.map3dUrl = `uploads/${req.files.map3dFile[0].filename}`;
      if (req.files.virtualTourFile) updates.virtualTourUrl = `uploads/${req.files.virtualTourFile[0].filename}`;
      if (req.files.images) {
        const newImgs = req.files.images.map(f => `uploads/${f.filename}`);
        updates.imageUrls = updates.imageUrls ? [...updates.imageUrls, ...newImgs] : newImgs;
      }
      if (req.files.videos) {
        const newVids = req.files.videos.map(f => `uploads/${f.filename}`);
        updates.videoUrls = updates.videoUrls ? [...updates.videoUrls, ...newVids] : newVids;
      }
    }

    const property = await Property.findByIdAndUpdate(req.params.id, updates, { 
      new: true, 
      runValidators: true 
    });

    if (!property) return res.status(404).json({ error: 'Property not found' });

    console.log(`✏️ Property updated: ${property.title}`);
    res.redirect('/admin/dashboard?status=updated');
  } catch (err) {
    console.error('❌ Update property error:', err);
    res.status(500).json({ error: 'Update failed' });
  }
};

// DELETE PROPERTY
exports.deleteProperty = async (req, res) => {
  try {
    const property = await Property.findByIdAndDelete(req.params.id);
    if (property) {
      console.log(`🗑️ Property deleted: ${property.title}`);
    }
    res.redirect('/admin/dashboard?status=deleted');
  } catch (err) {
    console.error('❌ Delete property error:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
};
