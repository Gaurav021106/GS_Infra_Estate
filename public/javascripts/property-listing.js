(function () {
  'use strict';

  function initPropertyListing() {
    // ===================== SELECTORS =====================
    const searchInput     = document.getElementById('searchInput');
    const searchBtn       = document.getElementById('searchBtn');
    const priceFilter     = document.getElementById('priceFilter');
    const typeFilter      = document.getElementById('typeFilter');
    const resetFiltersBtn = document.getElementById('resetFilters');

    // Result Counts & Loading State
    const resultsCount    = document.getElementById('resultsCount');
    const countNum        = document.getElementById('countNum');
    const skeleton        = document.getElementById('skeleton');
    const propertyGrid    = document.getElementById('propertyGrid');
    const loadingSpinner  = document.getElementById('loadingSpinner');

    // ===================== IMMEDIATE DISPLAY FIX =====================
    // Instantly hide skeleton and show grid if elements exist
    // This runs as soon as the DOM is ready, not waiting for all images to load
    if (skeleton) skeleton.style.display = 'none';
    if (propertyGrid) propertyGrid.classList.remove('hidden');

    // ===================== FILTER LOGIC =====================
    function applyFilters() {
      if (loadingSpinner) loadingSpinner.classList.remove('hidden');
      if (resultsCount) resultsCount.classList.add('hidden');

      // Small timeout to allow UI to show spinner if calculation is heavy
      setTimeout(() => {
        // Get values safely
        const searchTerm  = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const selectedPrice = priceFilter ? priceFilter.value : '';
        const selectedType  = typeFilter ? typeFilter.value.toLowerCase() : '';

        const cards = document.querySelectorAll('.property-card');
        let visibleCount = 0;

        cards.forEach(card => {
          // 1. Extract Data from DOM
          const title    = card.querySelector('h3')?.innerText.toLowerCase() || '';
          const location = (card.dataset.location || '').toLowerCase();
          const price    = parseFloat(card.dataset.price || '0');
          // Fallback for type matching if dataset isn't present
          const cardText = card.innerText.toLowerCase(); 

          // 2. Search Match (Title or Location)
          const matchesSearch = !searchTerm || 
                                title.includes(searchTerm) || 
                                location.includes(searchTerm);

          // 3. Price Match (Handling Lakhs conversion)
          let matchesPrice = true;
          if (selectedPrice) {
            // Convert raw price to Lakhs (e.g., 5000000 -> 50)
            const priceInLakhs = price / 100000;

            if (selectedPrice === '100+') {
              matchesPrice = priceInLakhs >= 100;
            } else {
              const [min, max] = selectedPrice.split('-').map(Number);
              if (!isNaN(min)) {
                matchesPrice = priceInLakhs >= min && (isNaN(max) ? true : priceInLakhs <= max);
              }
            }
          }

          // 4. Type Match
          let matchesType = true;
          if (selectedType) {
             matchesType = cardText.includes(selectedType);
          }

          // 5. Toggle Visibility with Animation Reset
          if (matchesSearch && matchesPrice && matchesType) {
            card.style.display = 'flex';
            
            // Trigger CSS reflow to restart animation for a smooth effect
            card.classList.remove('animate-fadeInUp');
            void card.offsetWidth; 
            card.classList.add('animate-fadeInUp');
            
            visibleCount++;
          } else {
            card.style.display = 'none';
          }
        });

        // Update Result Count UI
        if (resultsCount && countNum) {
          countNum.textContent = visibleCount;
          resultsCount.classList.remove('hidden');
        }
        if (loadingSpinner) loadingSpinner.classList.add('hidden');
      }, 50);
    }

    // ===================== EVENT LISTENERS =====================
    if (searchInput) {
      searchInput.addEventListener('input', applyFilters);
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          applyFilters();
        }
      });
    }

    if (searchBtn)    searchBtn.addEventListener('click', applyFilters);
    if (priceFilter)  priceFilter.addEventListener('change', applyFilters);
    if (typeFilter)   typeFilter.addEventListener('change', applyFilters);

    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (priceFilter) priceFilter.value = '';
        if (typeFilter)  typeFilter.value = '';
        // Reset all cards to visible
        const cards = document.querySelectorAll('.property-card');
        cards.forEach(card => card.style.display = 'flex');
        applyFilters();
      });
    }

    // Run once on init to ensure correct state
    applyFilters();

    // ===================== EMAIL ALERT MODAL ====================
    const emailAlertBtn    = document.getElementById('emailAlertBtn');
    const emailAlertModal  = document.getElementById('emailAlertModal');
    const emailAlertInput  = document.getElementById('emailAlertInput');
    const emailAlertSave   = document.getElementById('emailAlertSave');
    const emailAlertCancel = document.getElementById('emailAlertCancel');

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
      // Use onclick to avoid duplicate listeners
      emailAlertSave.onclick = async () => {
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
      };
    }
  }

  // ===================== SPA INITIALIZATION CHECK =====================
  // This logic fixes the "reload required" bug. 
  // It checks if the page is already loaded (for SPA navigation) and runs immediately.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPropertyListing);
  } else {
    initPropertyListing();
  }
})();