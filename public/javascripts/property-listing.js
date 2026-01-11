document.addEventListener('DOMContentLoaded', function () {
  const allProperties = {
    residential: window.residential || [],
    commercialPlots: window.commercialPlots || [],
    landPlots: window.landPlots || [],
    premiumInvestment: window.premiumInvestment || [],
  };

  const locationFilter  = document.getElementById('locationFilter');
  const priceFilter     = document.getElementById('priceFilter');
  const clearFiltersBtn = document.getElementById('clearFilters');
  const resultsCount    = document.getElementById('resultsCount');
  const countNum        = document.getElementById('countNum');
  const loadingSpinner  = document.getElementById('loadingSpinner');

  const emailAlertBtn    = document.getElementById('emailAlertBtn');
  const emailAlertModal  = document.getElementById('emailAlertModal');
  const emailAlertInput  = document.getElementById('emailAlertInput');
  const emailAlertSave   = document.getElementById('emailAlertSave');
  const emailAlertCancel = document.getElementById('emailAlertCancel');

  // ===================== LOCATION OPTIONS =====================
  const locationsSet = new Set();
  Object.values(allProperties).forEach(list => {
    list.forEach(p => {
      if (p && p.location) locationsSet.add(p.location);
    });
  });

  if (locationFilter) {
    Array.from(locationsSet).sort().forEach(loc => {
      const option = document.createElement('option');
      option.value = loc;
      option.textContent = loc;
      locationFilter.appendChild(option);
    });
  }

  // ===================== FILTER LOGIC =========================
  function applyFilters() {
    if (!locationFilter || !priceFilter) return;

    const selectedLocation   = locationFilter.value.toLowerCase().trim();
    const selectedPriceRange = priceFilter.value;

    if (loadingSpinner) loadingSpinner.classList.remove('hidden');
    if (resultsCount)   resultsCount.classList.add('hidden');

    setTimeout(function () {
      let totalVisible = 0;
      const cards = document.querySelectorAll('.property-card');

      cards.forEach(card => {
        const cardLocation = (card.dataset.location || '').toLowerCase();
        const cardPrice    = parseInt(card.dataset.price || '0', 10);

        const matchesLocation =
          !selectedLocation ||
          cardLocation.includes(selectedLocation) ||
          selectedLocation.includes(cardLocation);

        let matchesPrice = true;
        if (selectedPriceRange) {
          const [minStr, maxStr] = selectedPriceRange.split('-');
          const min = parseInt(minStr, 10);
          const max = (!maxStr || maxStr === '+') ? Infinity : parseInt(maxStr, 10);
          matchesPrice = cardPrice >= min && cardPrice <= max;
        }

        if (matchesLocation && matchesPrice) {
          card.style.display = 'flex';
          card.classList.remove('animate-fadeInUp');
          void card.offsetWidth; // restart animation
          card.classList.add('animate-fadeInUp');
          totalVisible++;
        } else {
          card.style.display = 'none';
        }
      });

      if (totalVisible > 0 && resultsCount && countNum) {
        countNum.textContent = String(totalVisible);
        resultsCount.classList.remove('hidden');
      }

      if (loadingSpinner) loadingSpinner.classList.add('hidden');
    }, 250);
  }

  if (locationFilter) locationFilter.addEventListener('change', applyFilters);
  if (priceFilter)    priceFilter.addEventListener('change', applyFilters);

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      if (locationFilter) locationFilter.value = '';
      if (priceFilter)    priceFilter.value = '';
      document.querySelectorAll('.property-card').forEach(card => {
        card.style.display = 'flex';
      });
      if (resultsCount) resultsCount.classList.add('hidden');
    });
  }

  // Initial filter run
  applyFilters();

  // ===================== EMAIL ALERT MODAL ====================
  function openEmailModal() {
    if (!emailAlertModal) return;
    emailAlertModal.classList.remove('hidden');
    emailAlertModal.classList.add('flex');
    if (emailAlertInput) emailAlertInput.focus();
  }

  function closeEmailModal() {
    if (!emailAlertModal) return;
    emailAlertModal.classList.add('hidden');
    emailAlertModal.classList.remove('flex');
    if (emailAlertInput) emailAlertInput.value = '';
  }

  if (emailAlertBtn)    emailAlertBtn.addEventListener('click', openEmailModal);
  if (emailAlertCancel) emailAlertCancel.addEventListener('click', closeEmailModal);

  if (emailAlertModal) {
    emailAlertModal.addEventListener('click', e => {
      if (e.target === emailAlertModal) closeEmailModal();
    });
  }

  if (emailAlertSave) {
    emailAlertSave.addEventListener('click', async () => {
      const email = (emailAlertInput?.value || '').trim();
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        alert('Please enter a valid email address.');
        return;
      }

      try {
        const res = await fetch('/alerts/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        if (res.ok) {
          alert('Email alerts enabled successfully!');
          closeEmailModal();
        } else {
          const data = await res.json().catch(() => ({}));
          alert(data.message || 'Something went wrong. Please try again.');
        }
      } catch (err) {
        alert('Network error. Please try again.');
      }
    });
  }
});
