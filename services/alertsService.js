const { Resend } = require('resend');
const AlertSubscriber = require('../models/AlertSubscriber');

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// OPTIONAL: Health check using domains.list() instead of emails.list()
// This verifies your API key is valid by fetching your registered domains.
resend.domains.list().then(() => {
  console.log('✅ Resend API Connected Successfully (Alerts Service)');
}).catch((err) => {
  console.error('❌ Resend API Connection Failed (Alerts Service):', err.message);
});

// Send one email to multiple subscribers when a property is created
async function notifyNewProperty(property) {
  try {
    const subscribers = await AlertSubscriber.find({ active: true }).lean();
    if (!subscribers.length) {
      console.log('ℹ️ No active subscribers, skipping alert email.');
      return;
    }

    // Note: Resend "to" field accepts an array of strings, but there is a limit (usually 50).
    // If you have many subscribers, you might need to loop or use BCC.
    // For privacy, it is often better to send individually or use 'bcc' so users don't see each other's emails.
    const toList = subscribers.map(s => s.email);

    const baseUrl = (process.env.APP_BASE_URL || '').replace(/\/$/, '');  
    const detailsUrl = `${baseUrl}/property/${property.slug}-${property._id}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5; border-radius: 10px; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0066cc 0%, #0080ff 100%); padding: 18px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">GS Infra Estates</h1>
          <p style="color:#e5f1ff; margin:4px 0 0; font-size:13px;">New Property Alert</p>
        </div>
        <div style="background-color: #fff; padding: 26px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin: 0 0 12px; font-size: 18px;">New property listed in Uttarakhand</h2>
          <p style="font-size: 14px; color: #555; margin: 0 0 6px;">
            <strong>${property.title}</strong>
          </p>
          <p style="font-size: 13px; color: #666; margin: 0 0 6px;">
            Location: <strong>${property.location}</strong>
          </p>
          <p style="font-size: 13px; color: #666; margin: 0 0 6px;">
            Price: <strong>₹${Number(property.price).toLocaleString('en-IN')}</strong>
          </p>
          ${property.sqft ? `
          <p style="font-size: 13px; color: #666; margin: 0 0 6px;">
            Size: <strong>${property.sqft} sq.ft</strong>
          </p>` : ''}
          <p style="font-size: 12px; color: #777; margin: 14px 0 18px;">
            Category: <strong>${property.category || 'Property'}</strong>
          </p>
          <a href="${detailsUrl}"
             style="display:inline-block; padding: 10px 18px; background-color:#0066cc; color:#fff; text-decoration:none; border-radius:6px; font-size:13px;">
            View Property Details
          </a>
        </div>
        <div style="text-align: center; padding: 12px; background-color: #f8f9fa; border-radius: 0 0 10px 10px; margin-top: -10px;">
          <p style="color: #999; font-size: 11px; margin: 0;">
            You are receiving this email because you subscribed to property alerts on GS Infra Estates.
          </p>
        </div>
      </div>
    `;

    // Sending via BCC to protect subscriber privacy is recommended if sending one bulk email
    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'onboarding@resend.dev', // Ensure you have a valid sender
      to: 'noreply@yourdomain.com', // Dummy "to" address
      bcc: toList, // Use BCC for the actual list
      subject: `New property listed: ${property.title}`,
      html
    });

    if (error) {
      console.error('❌ Property alert email error:', error);
      return;
    }

    console.log(`✅ Property alert email sent to ${toList.length} subscribers. First ID: ${data?.id || 'N/A'}`);
  } catch (err) {
    console.error('❌ notifyNewProperty failed:', err.message);
  }
}

module.exports = { notifyNewProperty };