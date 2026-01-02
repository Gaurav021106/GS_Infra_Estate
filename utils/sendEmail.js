const { Resend } = require('resend');

if (!process.env.RESEND_API_KEY) {
  console.warn('RESEND_API_KEY is not set');
}

const resend = new Resend(process.env.RESEND_API_KEY || '');

async function sendEmail({ to, subject, html, text }) {
  if (!Array.isArray(to)) {
    to = [to];
  }

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.MAIL_FROM ,
      to,
      subject,
      text: text || '',
      html
    });

    if (error) {
      console.error('Resend error:', error);
      throw error;
    }

    return data;
  } catch (err) {
    console.error('sendEmail failed:', err);
    throw err;
  }
}

module.exports = sendEmail;
