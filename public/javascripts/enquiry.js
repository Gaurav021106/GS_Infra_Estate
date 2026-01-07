// public/javascripts/enquiry.js
(function () {
  const form = document.getElementById('enquiryForm');
  if (!form) return;

  const submitButton = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const name = document.getElementById('enq-name').value.trim();
    const phone = document.getElementById('enq-phone').value.trim();
    const location = document.getElementById('enq-location').value.trim();
    const requirement = document.getElementById('enq-requirement').value.trim();
    const subscribe = document.getElementById('enq-subscribe').checked;

    if (!name || !phone) {
      alert('Please fill at least Name and Phone.');
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Sending...';
    }

    try {
      const res = await fetch('/enquiry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          phone,
          location,
          requirement,
          subscribe,
        }),
      });

      if (!res.ok) {
        // Non-200 status (e.g. 400/500)
        alert('Server error. Please try again.');
        return;
      }

      const data = await res.json();

      if (!data.ok) {
        alert(data.error || 'Failed to send enquiry. Please try again.');
      } else {
        alert('Thank you! Your enquiry has been sent.');
        form.reset();
      }
    } catch (err) {
      console.error(err);
      alert('Network error. Please try again.');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Get Call Back';
      }
    }
  });
})();
