// controllers/public.controller.js
const Property = require('../models/property');
const { Resend } = require('resend');
const { makeSlug } = require('../utils/propertyHelpers');

const resend = new Resend(process.env.RESEND_API_KEY);

// =======================
// HOME PAGE
// =======================
exports.homePage = async (req, res, next) => {
  try {
    const [props, residential, commercialPlots, landPlots, premiumInvestment, featured] =
      await Promise.all([
        Property.find({ status: 'available' })
          .sort({ createdAt: -1 })
          .limit(12)
          .lean(),
        Property.find({ status: 'available', category: 'residential_properties' })
          .sort({ createdAt: -1 })
          .limit(6)
          .lean(),
        Property.find({ status: 'available', category: 'commercial_plots' })
          .sort({ createdAt: -1 })
          .limit(6)
          .lean(),
        Property.find({ status: 'available', category: 'land_plots' })
          .sort({ createdAt: -1 })
          .limit(6)
          .lean(),
        Property.find({ status: 'available', category: 'premium_investment' })
          .sort({ createdAt: -1 })
          .limit(6)
          .lean(),
        Property.findOne({ featured: true, status: 'available' })
          .sort({ createdAt: -1 })
          .lean(),
      ]);

    let seo = {
      title:
        'Rishikesh & Dehradun Properties | Residential, Commercial, Land & Investment - GS Infra',
      desc:
        'Verified properties across Rishikesh, Dehradun & Uttarakhand: residential homes, commercial plots, land & premium investment assets with virtual tours.',
      keywords:
        'Rishikesh property, Dehradun property, residential properties, commercial plots, land plots, premium investment, Uttarakhand real estate, GS Infra Estate',
    };

    if (featured) {
      const catLabel =
        featured.category === 'residential_properties'
          ? 'Residential Properties'
          : featured.category === 'commercial_plots'
          ? 'Commercial Plots'
          : featured.category === 'land_plots'
          ? 'Land & Plots'
          : 'Premium & Investment';

      seo.title = `${catLabel} in ${featured.location} | ₹${featured.price.toLocaleString()} - GS Infra`;
      seo.desc = `Premium ${catLabel.toLowerCase()} in ${featured.location}. Virtual tour available.`;
    }

    res.render('pages/home', {
      email: req.session.adminEmail || null,
      residential,
      commercialPlots,
      landPlots,
      premiumInvestment,
      featured,
      seo,
    });
  } catch (err) {
    console.error('❌ Home page error:', err);
    next(err);
  }
};

// =======================
// SIMPLE DETAIL PAGE
// LEGACY: /properties/:location/:category/:slug-:id
// =======================
exports.propertyDetailPage = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id).lean();
    if (!property) return res.redirect('/');

    const locationParam = req.params.location?.toLowerCase();
    const catParam = req.params.category;

    if (
      property.location.toLowerCase() !== locationParam ||
      property.category !== catParam
    ) {
      return res.redirect('/');
    }

    const correctSlug = makeSlug(property.title);
    if (req.params.slug !== correctSlug) {
      return res.redirect(
        301,
        `/properties/${locationParam}/${catParam}/${correctSlug}-${property.id}`
      );
    }

    const seo = {
      title: `${property.title} | ₹${property.price.toLocaleString()} | ${property.location} - GS Infra Estates`,
      desc: `${(property.description || '').substring(
        0,
        155
      )}... Premium property in Uttarakhand with expert guidance.`,
      keywords: `${property.location} ${property.category} property, ${property.location} real estate`,
    };

    res.render('pages/property-detail', {
      property,
      seo,
    });
  } catch (err) {
    console.error('❌ Property detail error:', err);
    next(err);
  }
};

// =======================
// LEGACY PROPERTY REDIRECT
// Short link: /property/:id -> home + modal
// =======================
exports.legacyPropertyRedirect = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id).lean();
    if (!property) return res.redirect('/');

    res.render('pages/home', {
      email: req.session.adminEmail || null,
      property,
      showPropertyModal: true,
    });
  } catch (err) {
    console.error('❌ Legacy redirect error:', err);
    next(err);
  }
};

// =======================
// SITEMAP.XML (new slugs)
// =======================
exports.sitemapXml = async (req, res, next) => {
  try {
    const props = await Property.find({ status: 'available' }).lean();
    const base = req.protocol + '://' + req.get('host');

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Home
    xml += `  <url>\n    <loc>${base}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

    // Category pages
    const catSlugs = ['residential', 'commercial-plots', 'land-plots', 'premium-investment'];
    catSlugs.forEach((slug) => {
      xml += `  <url>\n    <loc>${base}/category/${slug}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    });

    // Individual properties
    props.forEach((p) => {
      const slug = makeSlug(p.title);
      xml += `  <url>\n    <loc>${base}/property/${slug}-${p._id}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    });

    xml += `</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    console.error('❌ Sitemap error:', err);
    next(err);
  }
};

// =======================
// ROBOTS.TXT
// =======================
exports.robotsTxt = (req, res) => {
  const base = req.protocol + '://' + req.get('host');
  const robots = `
User-agent: *
Allow: /


Sitemap: ${base}/sitemap.xml
`.trim();

  res.header('Content-Type', 'text/plain');
  res.send(robots);
};

// =======================
// ENQUIRY HANDLER (JSON)
// =======================
exports.enquiryHandler = async (req, res) => {
  try {
    const {
      name,
      phone,
      location,
      requirement,
      propertyId,
      subscribe,
      email,
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        ok: false,
        error: 'Name and phone are required',
      });
    }

    const html = `
      <h2>New Property Enquiry</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Location:</strong> ${location || 'Rishikesh'}</p>
      <p><strong>Requirement:</strong> ${requirement || 'Not specified'}</p>
      <p><strong>Property:</strong> ${propertyId || 'General Enquiry'}</p>
      <p><strong>Subscribe:</strong> ${subscribe ? 'YES' : 'No'}</p>
      <p><strong>Email:</strong> ${email || 'Not provided'}</p>
      <p><strong>Received:</strong> ${new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
      })}</p>
    `;

    await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: process.env.TO_EMAIL,
      subject: 'New Property Enquiry - GS Infra Estates',
      html,
    });

    return res.status(200).json({
      ok: true,
      message: 'Enquiry sent successfully',
    });
  } catch (err) {
    console.error('❌ Enquiry handler error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Failed to send enquiry',
    });
  }
};

// =======================
// PROPERTIES BY CATEGORY
// /category/:category -> new 4 categories
// =======================
exports.propertiesByCategory = async (req, res, next) => {
  try {
    const categoryParam = req.params.category; // e.g. residential, commercial-plots

    let dbCategory;
    let categoryLabel;

    switch (categoryParam.toLowerCase()) {
      case 'flat':
      case 'residential':
      case 'residential_properties':
        dbCategory = 'residential_properties';
        categoryLabel = 'Residential Properties';
        break;
      case 'commercial-plots':
      case 'commercial':
        dbCategory = 'commercial_plots';
        categoryLabel = 'Commercial Properties';
        break;
      case 'plot':
      case 'land-plots':
      case 'land':
      case 'plots':
        dbCategory = 'land_plots';
        categoryLabel = 'Land & Plots';
        break;
      case 'agri':
      case 'premium-investment':
      case 'premium':
      case 'investment':
        dbCategory = 'premium_investment';
        categoryLabel = 'Premium & Investment';
        break;
      default:
        return res.status(404).render('error', {
          statusCode: 404,
          message: 'Category not found',
        });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    const query = { category: dbCategory, status: 'available' };

    const [properties, total] = await Promise.all([
      Property.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Property.countDocuments(query),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const hasProperties = properties && properties.length > 0;

    const seo = {
      title: `${categoryLabel} in Rishikesh & Dehradun | GS Infra Estates`,
      desc: `Browse ${categoryLabel.toLowerCase()} listings in Rishikesh, Dehradun and nearby Uttarakhand locations.`,
      keywords:
        'Rishikesh property, Dehradun property, residential, commercial plots, land, premium investment',
    };

    res.render('pages/properties_listing', {
      seo,
      categorySlug: categoryParam,
      categoryName: categoryLabel,
      properties: properties || [],
      hasProperties,
      message: !hasProperties
        ? 'No properties added in this category yet!'
        : null,
      pagination: {
        page,
        totalPages,
        total,
      },
    });
  } catch (err) {
    console.error('Category error:', err);
    next(err);
  }
};

// ======================= PROPERTIES PAGE (ALL) =======================
exports.propertiesPage = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    const query = { status: 'available' };

    const [properties, total] = await Promise.all([
      Property.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Property.countDocuments(query),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const hasProperties = properties && properties.length > 0;

    const seo = {
      title: 'Properties in Rishikesh & Dehradun | GS Infra Estates',
      desc: 'Browse all available properties - Residential, Commercial, Land & Investment properties',
      keywords: 'properties for sale, residential properties, commercial properties',
    };

    res.render('pages/properties_listing', {
      seo,
      categorySlug: null,
      categoryName: 'All Properties',
      properties: properties || [],
      hasProperties,
      message: !hasProperties ? 'No properties available right now.' : null,
      pagination: {
        page,
        totalPages,
        total,
      },
    });
  } catch (err) {
    console.error('Properties page error:', err);
    next(err);
  }
};

// ======================= ABOUT PAGE =======================
exports.aboutPage = async (req, res, next) => {
  try {
    const seo = {
      title: 'About Us | GS Infra Estates',
      desc: 'Learn about GS Infra Estates - Your trusted real estate partner',
      keywords: 'about GS Infra Estates, real estate company',
    };
    res.render('pages/about', { seo });
  } catch (err) {
    console.error('About page error:', err);
    next(err);
  }
};

// ======================= SERVICES PAGE =======================
exports.servicesPage = async (req, res, next) => {
  try {
    const seo = {
      title: 'Our Services | GS Infra Estates',
      desc: 'Explore our comprehensive real estate services',
      keywords: 'real estate services, property consultations',
    };
    res.render('pages/services', { seo });
  } catch (err) {
    console.error('Services page error:', err);
    next(err);
  }
};

// ======================= CONTACT PAGE =======================
exports.contactPage = async (req, res, next) => {
  try {
    const seo = {
      title: 'Contact Us | GS Infra Estates',
      desc: 'Get in touch with GS Infra Estates',
      keywords: 'contact us, real estate inquiry',
    };
    res.render('pages/contact', { seo });
  } catch (err) {
    console.error('Contact page error:', err);
    next(err);
  }
};
