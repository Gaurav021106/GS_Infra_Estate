const express = require('express');
const router = express.Router();
const AlertSubscriber = require('../models/AlertSubscriber');
const sendEmail = require('../utils/sendEmail');

router.post('/subscribe', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ message: 'Email required' });
    }

    await AlertSubscriber.updateOne(
      { email },
      { $set: { email, active: true } },
      { upsert: true }
    );

    res.json({ message: 'Subscribed' });
  } catch (err) {
    console.error('Subscribe error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/unsubscribe', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ message: 'Email required' });
    }

    await AlertSubscriber.updateOne(
      { email },
      { $set: { active: false } }
    );

    res.json({ message: 'Unsubscribed' });
  } catch (err) {
    console.error('Unsubscribe error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Optional: test mail
router.post('/test-mail', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ message: 'Email required' });
    }

    await sendEmail({
      to: email,
      subject: 'Test property alert (Resend)',
      text: 'This is a test email from GS Infra & Estate alerts using Resend.',
      html: '<p>This is a test email from <strong>GS Infra & Estate</strong> alerts using Resend.</p>'
    });

    res.json({ message: 'Test mail sent' });
  } catch (err) {
    console.error('Test mail error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
