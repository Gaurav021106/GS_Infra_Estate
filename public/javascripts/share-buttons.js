document.addEventListener('DOMContentLoaded', () => {
  const shareButtons = document.querySelectorAll('.share-btn');

  shareButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const title    = btn.dataset.title || 'Property in Uttarakhand';
      const location = btn.dataset.location || '';
      const price    = btn.dataset.price || '';
      const url      = window.location.href.split('#')[0];

      const shareText =
        `${title} - ${location}\nPrice: ₹${Number(price).toLocaleString('en-IN')}\n\nCheck this property: ${url}`;

      if (navigator.share) {
        navigator
          .share({ title, text: shareText, url })
          .catch(() => {
            const waUrl = 'https://wa.me/?text=' + encodeURIComponent(shareText);
            window.open(waUrl, '_blank');
          });
      } else {
        const waUrl = 'https://wa.me/?text=' + encodeURIComponent(shareText);
        window.open(waUrl, '_blank');
      }
    });
  });
});
