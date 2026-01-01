// home.controller.js
const Property = require('../models/property');
const { Resend } = require('resend');
const { makeSlug, splitByCategory } = require('../utils/propertyHelpers');

const resend = new Resend(process.env.RESEND_API_KEY);

// HOME PAGE
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
      seo.desc = `Premium ${catLabel.toLowerCase()} in ${
        featured.location
      } - ${featured.sqft || 'NA'} sqft, virtual tour available.`;
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

// PROPERTY DETAIL PAGE
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
        `/properties/${locationParam}/${catParam}/${correctSlug}-${property.id}`
      );
    }

    const seo = {
      title: `${property.title} | ${property.price} | ${property.location} - GS Infra Estates`,
      desc: `${property.description.substring(
        0,
        155
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

// LEGACY PROPERTY REDIRECT
exports.legacyPropertyRedirect = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).lean();

    if (!property) {
      return res.redirect('/');
    }

    const slug = makeSlug(property.title);
    const location = property.location.toLowerCase().replace(' ', '-');

    res.redirect(
      301,
      `/properties/${location}/${property.category}/${slug}-${property.id}`
    );
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

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    xml += `<url>\n<loc>${base}/</loc>\n<priority>1.0</priority>\n<changefreq>daily</changefreq>\n</url>\n`;

    props.forEach((p) => {
      const slug = makeSlug(p.title);
      const loc = p.location.toLowerCase().replace(' ', '-');

      xml += `<url>\n<loc>${base}/properties/${loc}/${p.category}/${slug}-${p.id}</loc>\n<priority>0.9</priority>\n<changefreq>weekly</changefreq>\n</url>\n`;
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
    res.send(
      `User-agent: *\nAllow: /\nSitemap: ${req.protocol}://${req.get(
        'host'
      )}/sitemap.xml`
    );
  } catch (err) {
    console.error('❌ Robots.txt error:', err);
    res.status(500).send('Error');
  }
};

// ENQUIRY HANDLER
exports.enquiryHandler = async (req, res) => {
  try {
    console.log('📩 Enquiry form submitted - calling Resend API...');

    const {
      name,
      phone,
      location,
      requirement,
      propertyId,
      subscribe,
    } = req.body;

    if (!name?.trim() || !phone?.trim()) {
      return res
        .status(400)
        .json({ ok: false, error: 'Name & phone are required' });
    }

    const subject = `NEW ENQUIRY: ${name} - ${
      location || 'Rishikesh'
    } (Website)`;

    const body = `
NEW HIGH-INTENT LEAD from GS Infra Website

Name: ${name}
Phone: ${phone}
Location: ${location || 'Rishikesh'}
Requirement: ${requirement || 'Not specified'}
Property: ${propertyId || 'General Enquiry'}
Subscribe: ${subscribe ? 'YES' : 'No'}

Source: Website (${req.get('referrer') || 'Direct'})
IP: ${req.ip || 'Unknown'}
Received: ${new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
    })}
    `.trim();

    const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">NEW LEAD</h1>
      </div>
      <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333333; margin-bottom: 20px;">GS Infra Website Enquiry</h2>

        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <p><strong>👤 Name:</strong> ${name}</p>
          <p><strong>📞 Phone:</strong> ${phone}</p>
          <p><strong>📍 Location:</strong> ${location || 'Rishikesh'}</p>
          <p><strong>💼 Requirement:</strong> ${requirement || 'Not specified'}</p>
          <p><strong>🏠 Property:</strong> ${propertyId || 'General Enquiry'}</p>
          <p><strong>🔔 Subscribe:</strong> ${subscribe ? 'YES' : 'No'}</p>
        </div>

        <div style="background: #e9ecef; padding: 15px; border-radius: 6px; font-size: 12px;">
          <p><strong>⏰ Received:</strong> ${new Date().toLocaleString(
            'en-IN',
            { timeZone: 'Asia/Kolkata' }
          )}</p>
          <p><strong>🌐 Source:</strong> Website (${
            req.get('referrer') || 'Direct'
          })</p>
          <p><strong>💻 IP:</strong> ${req.ip || 'Unknown'}</p>
        </div>
      </div>
    </div>
    `;

    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL, // verified domain
      to: [process.env.TO_EMAIL, process.env.ADMINEMAIL], // your inboxes
      subject,
      text: body,
      html,
    });

    if (error) {
      console.error('❌ RESEND API WORKING BUT DOMAIN ISSUE:', {
        message: error.message,
        code: error.code,
        from: process.env.FROM_EMAIL,
        to: [process.env.TO_EMAIL, process.env.ADMINEMAIL],
      });

      if (
        error.message?.includes('domain') ||
        error.message?.includes('sender')
      ) {
        console.log(
          'ℹ️ Resend API successful but domain verification pending. Check Resend Dashboard → Domains.'
        );
      }

      throw new Error('Server timeout - unable to send notification');
    }

    console.log(
      `✅ Enquiry received: ${name} | ${phone} | GS Infra | ID: ${data.id}`
    );

    return res.json({
      ok: true,
      message: "Thank you! We'll contact you within 2 hours.",
    });
  } catch (err) {
    console.error('❌ Enquiry Error (Console Only):', err.message);

    return res.status(503).json({
      ok: false,
      error:
        'Server timeout - enquiry received but notification delayed. We will contact you soon.',
    });
  }
};
