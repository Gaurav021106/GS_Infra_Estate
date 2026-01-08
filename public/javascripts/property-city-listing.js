(function () {
  function openWhatsAppInternal(city) {
    const message = `Hi, I'm interested in properties in ${city}. Can you help me find the right one?`;
    const whatsappUrl = `https://wa.me/918279702969?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  }

  function buildQuery() {
    const type     = document.getElementById('propertyType')?.value || '';
    const budget   = document.getElementById('budget')?.value || '';
    const locality = document.getElementById('locality')?.value.trim() || '';
    const sortBy   = document.getElementById('sortBy')?.value || '';

    const params = new URLSearchParams();
    if (type)     params.set('type', type);
    if (budget)   params.set('budget', budget);
    if (locality) params.set('locality', locality);
    if (sortBy)   params.set('sort', sortBy);

    return params.toString();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const filterBtn = document.getElementById('filterBtn');
    const sortSelect = document.getElementById('sortBy');
    const body = document.querySelector('body');
    const city = body?.dataset.cityName || '';

    // expose for inline onclick
    window.openWhatsApp = function () {
      openWhatsAppInternal(city);
    };

    function navigateWithQuery() {
      const query = buildQuery();
      const base = window.location.pathname.split('/').slice(0, 3).join('/');
      const url = query ? `${base}?${query}` : base;
      window.location.href = url;
    }

    if (filterBtn) {
      filterBtn.addEventListener('click', navigateWithQuery);
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', navigateWithQuery);
    }
  });
})();
