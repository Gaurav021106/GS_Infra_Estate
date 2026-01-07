const Property = require('../models/property');
const { Resend } = require('resend');
const { makeSlug, splitByCategory } = require('../utils/propertyHelpers');

const resend = new Resend(process.env.RESEND_API_KEY);

// =======================
// HOME PAGE
// =======================
exports.homePage = async (req, res) => {
  try {
    const props = await Property.find()
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();

    const { flats, plots, agri } = splitByCategory(props);
    const featured = props[0];

    let seo = {
      title: 'Rishikesh Property | Flats, Plots, Agri Land - GS Infra',
      desc: 'Verified Rishikesh properties: luxury flats, plots & agri land with virtual tours, EMI calculators. Best deals in Uttarakhand real estate.',
      keywords:
        'Rishikesh property, flats Rishikesh, plots Rishikesh, Dehradun property, agri land Rishikesh, Uttarakhand real estate, GS Infra Estates, luxury villas Rishikesh',
    };

    if (featured) {
      const catLabel =
        featured.category === 'flat/house'
          ? 'Flats & Houses'
          : featured.category === 'plot'
          ? 'Residential Plots'
          : 'Agricultural Land';

      seo.title = `${catLabel} in Rishikesh | ${featured.price} - GS Infra`;
      seo.desc = `Premium ${catLabel.toLowerCase()} in ${featured.location} - ${
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
    console.error('❌ Home page error:', err);
    res.render('pages/home', {
      flats: [],
      plots: [],
      agri: [],
      seo: res.locals.seo || {},
    });
  }
};

// =======================
// PROPERTY DETAIL PAGE
// SEO URL: /properties/:location/:category/:slug-:id
// =======================
exports.propertyDetailPage = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).lean();
    if (!property) {
      return res.redirect('/');
    }

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
        `/properties/${locationParam}/${catParam}/${correctSlug}-${property.id}`,
      );
    }

    const seo = {
      title: `${property.title} | ${property.price} | ${property.location} - GS Infra Estates`,
      desc: `${property.description.substring(
        0,
        155,
      )}... Premium property in Rishikesh. Virtual tour & EMI calculator available.`,
      keywords: `${property.location} ${property.category} property, ${property.location} real estate, plots ${property.location}`,
    };

    res.render('pages/property-detail', {
      property,
      seo,
    });
  } catch (err) {
    console.error('❌ Property detail error:', err);
    res.redirect('/');
  }
};

// =======================
// LEGACY PROPERTY REDIRECT
// Short link: /property/:id  -> home + modal
// =======================
exports.legacyPropertyRedirect = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).lean();
    if (!property) {
      return res.redirect('/');
    }

    res.render('pages/home', {
      email: req.session.adminEmail || null,
      property,
      showPropertyModal: true,
    });
  } catch (err) {
    console.error('❌ Legacy redirect error:', err);
    res.redirect('/');
  }
};

// =======================
// SITEMAP.XML
// =======================
exports.sitemapXml = async (req, res) => {
  try {
    const props = await Property.find().lean();
    const base = req.protocol + '://' + req.get('host');

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Home page
    xml += `  <url>\n`;
    xml += `    <loc>${base}/</loc>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>1.0</priority>\n`;
    xml += `  </url>\n`;

    // Property detail pages
    props.forEach((p) => {
      const slug = makeSlug(p.title);
      const loc = p.location?.toLowerCase() || 'rishikesh';
      const cat = p.category || 'flat/house';

      xml += `  <url>\n`;
      xml += `    <loc>${base}/properties/${loc}/${cat}/${slug}-${p._id}</loc>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    });

    xml += `</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    console.error('❌ Sitemap error:', err);
    res.status(500).send('Sitemap generation error');
  }
};

// =======================
// ROBOTS.TXT
// =======================
exports.robotsTxt = (req, res) => {
  const base = req.protocol + '://' + req.get('host');
  const robots = `
User-agent: *
Disallow:

Sitemap: ${base}/sitemap.xml
`.trim();

  res.header('Content-Type', 'text/plain');
  res.send(robots);
};

// =======================
// ENQUIRY HANDLER (JSON API)
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
      <p><strong>Received:</strong> ${new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
      })}</p>
      <p><strong>Source:</strong> Website (${req.get('referrer') || 'Direct'})</p>
      <p><strong>IP:</strong> ${req.ip || 'Unknown'}</p>
    `;

    await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: process.env.TO_EMAIL ,
      subject: 'New Property Enquiry - GS Infra Estates',
      html,
    });

    // Optionally handle "subscribe" flag here (save to DB, etc.)

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
