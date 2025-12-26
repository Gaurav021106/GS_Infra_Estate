const Property = require('../models/property');
const nodemailer = require('nodemailer');
const { makeSlug, splitByCategory } = require('../utils/propertyHelpers');

// Nodemailer transporter for enquiries
const transporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 587,
  secure: false,
  auth: {
    user: 'apikey',           // literal
    pass: process.env.SENDGRID_API_KEY,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SendGrid SMTP Error:', error.message);
  } else {
    console.log('✅ SendGrid SMTP Ready - Emails will work');
  }
});

// ======================= HOME PAGE =======================
exports.homePage = async (req, res) => {
  try {
    const props = await Property.find()
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();

    const { flats, plots, agri } = splitByCategory(props);
    const featured = props[0];

    const seo = {
      title: 'Rishikesh Property | Flats Plots Agri Land - GS Infra',
      desc: 'Verified Rishikesh properties: luxury flats, plots & agri land with virtual tours, EMI calculators. Best deals in Uttarakhand real estate.',
      keywords:
        'Rishikesh property, flats Rishikesh, plots Rishikesh, Dehradun property, agri land Rishikesh, Uttarakhand real estate, GS Infra Estates, luxury villas Rishikesh',
    };

    if (featured) {
      const catLabel =
        featured.category === 'flat_house'
          ? 'Flats & Houses'
          : featured.category === 'plot'
          ? 'Residential Plots'
          : 'Agricultural Land';

      seo.title = `${catLabel} in Rishikesh | ₹${featured.price} - GS Infra`;
      seo.desc = `Premium ${catLabel} in ${featured.location} - ${
        featured.sqft || 'NA'
      } sqft, virtual tour available.`;
    }

    res.render('pages/home', {
      email: req.session.adminEmail || null,
      flats,
      plots,
      agri,
      seo,
    });
  } catch (err) {
    console.error(err);
    res.render('pages/home', {
      flats: [],
      plots: [],
      agri: [],
      seo: res.locals.seo,
    });
  }
};

// ======================= PROPERTY DETAIL PAGE =======================
exports.propertyDetailPage = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).lean();
    if (!property) return res.redirect('/');

    const locationParam = (req.params.location || '').toLowerCase();
    const catParam = req.params.category;

    // Guard: URL category / location must match DB
    if (
      property.location.toLowerCase() !== locationParam ||
      property.category !== catParam
    ) {
      return res.redirect('/');
    }

    // Guard: slug canonicalization
    const correctSlug = makeSlug(property.title);
    if (req.params.slug !== correctSlug) {
      return res.redirect(
        301,
        `/properties/${locationParam}/${catParam}/${correctSlug}-${property._id}`,
      );
    }

    const seo = {
      title: `${property.title} | ₹${property.price} - ${property.location} - GS Infra Estates`,
      desc: `${(property.description || 'Premium property in Rishikesh').substring(
        0,
        155,
      )}... Virtual tour & EMI calculator available.`,
      keywords: `${property.location} ${property.category} property, ${property.location} real estate, plots ${property.location}`,
    };

    res.render('pages/property-detail', { property, seo });
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
};

// ======================= LEGACY PROPERTY REDIRECT =======================
exports.legacyPropertyRedirect = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).lean();
    if (!property) return res.redirect('/');

    const slug = makeSlug(property.title);
    const location = (property.location || 'rishikesh').toLowerCase();

    res.redirect(
      301,
      `/properties/${location}/${property.category}/${slug}-${property._id}`,
    );
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
};

// ======================= SITEMAP.XML =======================
exports.sitemapXml = async (req, res) => {
  try {
    const props = await Property.find().lean();
    const base = `${req.protocol}://${req.get('host')}`;

    let xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Home page
    xml += `<url><loc>${base}/</loc><priority>1.0</priority><changefreq>daily</changefreq></url>\n`;

    // Property pages
    props.forEach((p) => {
      const slug = makeSlug(p.title);
      const loc = (p.location || 'rishikesh').toLowerCase();

      xml += `<url><loc>${base}/properties/${loc}/${p.category}/${slug}-${p._id}</loc><priority>0.9</priority><changefreq>weekly</changefreq></url>\n`;
    });

    xml += '</urlset>';

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    console.error(err);
    res.status(500).send('Sitemap error');
  }
};

// ======================= ROBOTS.TXT =======================
exports.robotsTxt = (req, res) => {
  res.type('text/plain');
  res.send(
    `User-agent: *\nAllow: /\nSitemap: ${req.protocol}://${req.get(
      'host',
    )}/sitemap.xml`,
  );
};

// ======================= ENQUIRY HANDLER =======================
exports.enquiryHandler = async (req, res) => {
  try {
    const { name, phone, location, requirement, propertyId, subscribe } = req.body;

    if (!name?.trim() || !phone?.trim()) {
      return res
        .status(400)
        .json({ ok: false, error: 'Name & phone required' });
    }

    const subject = `🔥 New Enquiry: ${name} - ${location || 'Rishikesh'}`;
    const body = `
NEW HIGH-INTENT LEAD from GS Infra Website
==============================================

Name: ${name}
Phone: ${phone}
Location: ${location || 'Rishikesh'}
Requirement: ${requirement || 'Not specified'}
Property: ${propertyId || 'General Enquiry'}
Subscribe: ${subscribe ? 'YES' : 'No'}
Source: Website (${req.get('referrer') || 'Direct'})
`.trim();

    await transporter.sendMail({
      from: '"GS Infra Estates" <gs.infra.estates@gmail.com>',
      to: process.env.ADMIN_EMAIL || 'gauravsaklani021106@gmail.com',
      subject,
      text: body,
    });

    res.json({
      ok: true,
      message: "Thank you! We'll contact you within 2 hours.",
    });
  } catch (err) {
    console.error('Enquiry failed:', err);
    res
      .status(500)
      .json({ ok: false, error: 'Server error. Please try again.' });
  }
};
