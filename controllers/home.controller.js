const Property = require('../models/property');
const { Resend } = require('resend');
const { makeSlug, splitByCategory } = require('../utils/propertyHelpers');

// Nodemailer transporter for enquiries
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'gs.infra.estates@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// HOME PAGE
exports.homePage = async (req, res) => {
  try {
    const props = await Property.find()
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();

    const [flats, plots, agri] = splitByCategory(props);
    const featured = props[0];

    let seo = {
      title: 'Rishikesh Property | Flats, Plots, Agri Land - GS Infra',
      desc: 'Verified Rishikesh properties: luxury flats, plots & agri land with virtual tours, EMI calculators. Best deals in Uttarakhand real estate.',
      keywords: 'Rishikesh property, flats Rishikesh, plots Rishikesh, Dehradun property, agri land Rishikesh, Uttarakhand real estate, GS Infra Estates, luxury villas Rishikesh'
    };

    if (featured) {
      const catLabel = featured.category === 'flat/house' ? 'Flats & Houses' : 
                      featured.category === 'plot' ? 'Residential Plots' : 'Agricultural Land';
      
      seo.title = `${catLabel} in Rishikesh | ${featured.price} - GS Infra`;
      seo.desc = `Premium ${catLabel.toLowerCase()} in ${featured.location} - ${featured.sqft || 'NA'} sqft, virtual tour available.`;
    }

    res.render('pages/home', {
      email: req.session.adminEmail || null,
      flats, plots, agri, seo
    });
  } catch (err) {
    console.error('❌ Home page error:', err);
    res.render('pages/home', {
      flats: [], plots: [], agri: [],
      seo: res.locals.seo || {}
    });
  }
};

// PROPERTY DETAIL PAGE
exports.propertyDetailPage = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).lean();
    
    if (!property) {
      return res.redirect('/');
    }

    const locationParam = req.params.location?.toLowerCase();
    const catParam = req.params.category;

    if (property.location.toLowerCase() !== locationParam || 
        property.category !== catParam) {
      return res.redirect('/');
    }

    const correctSlug = makeSlug(property.title);
    if (req.params.slug !== correctSlug) {
      return res.redirect(301, `/properties/${locationParam}/${catParam}/${correctSlug}-${property.id}`);
    }

    const seo = {
      title: `${property.title} | ${property.price} | ${property.location} - GS Infra Estates`,
      desc: `${property.description.substring(0, 155)}... Premium property in Rishikesh. Virtual tour & EMI calculator available.`,
      keywords: `${property.location} ${property.category} property, ${property.location} real estate, plots ${property.location}`
    };

    res.render('pages/property-detail', {
      property,
      seo
    });
  } catch (err) {
    console.error('❌ Property detail error:', err);
    res.redirect('/');
  }
};

// LEGACY PROPERTY REDIRECT
exports.legacyPropertyRedirect = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).lean();
    
    if (!property) {
      return res.redirect('/');
    }

    const slug = makeSlug(property.title);
    const location = property.location.toLowerCase().replace(' ', '-');
    
    res.redirect(301, `/properties/${location}/${property.category}/${slug}-${property.id}`);
  } catch (err) {
    console.error('❌ Legacy redirect error:', err);
    res.redirect('/');
  }
};

// SITEMAP.XML
exports.sitemapXml = async (req, res) => {
  try {
    const props = await Property.find().lean();
    const base = req.protocol + '://' + req.get('host');
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
    
    xml += `
  <url>
    <loc>${base}/</loc>
    <priority>1.0</priority>
    <changefreq>daily</changefreq>
  </url>`;

    props.forEach(p => {
      const slug = makeSlug(p.title);
      const loc = p.location.toLowerCase().replace(' ', '-');
      xml += `
  <url>
    <loc>${base}/properties/${loc}/${p.category}/${slug}-${p.id}</loc>
    <priority>0.9</priority>
    <changefreq>weekly</changefreq>
  </url>`;
    });

    xml += `</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    console.error('❌ Sitemap error:', err);
    res.status(500).send('Sitemap error');
  }
};

// ROBOTS.TXT
exports.robotsTxt = (req, res) => {
  try {
    res.type('text/plain');
    res.send(`User-agent: *
Allow: /
Sitemap: ${req.protocol}://${req.get('host')}/sitemap.xml`);
  } catch (err) {
    console.error('❌ Robots.txt error:', err);
    res.status(500).send('Error');
  }
};

// ENQUIRY HANDLER - Updated Error Handling (Generic User Messages)
exports.enquiryHandler = async (req, res) => {
  try {
    console.log('📤 Enquiry form submitted - calling Resend API...');
    
    const { name, phone, location, requirement, propertyId, subscribe } = req.body;
    
    if (!name?.trim() || !phone?.trim()) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Name & phone required' 
      });
    }

    const subject = `🆕 NEW ENQUIRY: ${name} - ${location || 'Rishikesh'}`;
    const body = `🚨 NEW HIGH-INTENT LEAD from GS Infra Website

👤 Name: ${name}
📞 Phone: ${phone}
📍 Location: ${location || 'Rishikesh'}
💼 Requirement: ${requirement || 'Not specified'}
🏠 Property: ${propertyId || 'General Enquiry'}
🔔 Subscribe: ${subscribe ? 'YES' : 'No'}
🌐 Source: Website (${req.get('referrer') || 'Direct'})
💻 IP: ${req.ip || 'Unknown'}

⏰ Received: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'gs.infra.estates@gmail.com',
      to: process.env.TO_EMAIL || process.env.ADMINEMAIL || 'gs.infra.estates@gmail.com',
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
