document.addEventListener('DOMContentLoaded', () => {
  const lightbox = document.getElementById('imageLightbox');
  const lightboxImg = document.getElementById('lightboxImage');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const lightboxClose = document.getElementById('lightboxClose');

  if (!lightbox || !lightboxImg || !lightboxClose) return;

  document.querySelectorAll('.view-image-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const src = btn.dataset.image || '';
      const title = btn.dataset.title || 'Property photo';

      if (!src) return;

      lightboxImg.src = src;
      lightboxImg.alt = title;
      if (lightboxCaption) lightboxCaption.textContent = title;
      lightbox.classList.remove('hidden');
      lightbox.classList.add('flex');
    });
  });

  function closeLightbox() {
    lightbox.classList.add('hidden');
    lightbox.classList.remove('flex');
    lightboxImg.src = '';
  }

  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', e => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !lightbox.classList.contains('hidden')) {
      closeLightbox();
    }
  });
});
