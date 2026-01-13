(function () {
  'use strict';

  // ---------- Helpers ----------
  function isLocalAnchor(a) {
    if (!a) return false;
    if (a.target === '_blank' || a.hasAttribute('download')) return false;

    const href = a.getAttribute('href');
    if (!href) return false;
    if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return false;

    try {
      const url = new URL(href, location.href);
      return url.origin === location.origin;
    } catch (e) {
      return false;
    }
  }

  // Send GA4 page_view for SPA navigation
  function trackPageView(urlLike) {
    if (typeof gtag !== 'function') return;

    const url = new URL(urlLike, window.location.origin);

    gtag('event', 'page_view', {
      page_location: url.toString(),
      page_path: url.pathname + url.search + url.hash,
      page_title: document.title,
    });
  }

  // ---------- SPA Navigation ----------
  async function fetchAndSwap(url, pushState = true) {
    const main = document.querySelector('main');
    if (!main) {
      location.href = url;
      return;
    }

    try {
      const res = await fetch(url, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });

      if (!res.ok) {
        location.href = url;
        return;
      }

      const text = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      const newMain = doc.querySelector('main');
      const newTitle = doc.querySelector('title');

      if (!newMain) {
        location.href = url;
        return;
      }

      // Swap content
      main.innerHTML = newMain.innerHTML;
      if (newTitle) document.title = newTitle.textContent;

      // Re-execute scripts contained in newMain
      newMain.querySelectorAll('script').forEach((s) => {
        const sc = document.createElement('script');
        if (s.src) sc.src = s.src;
        if (s.type) sc.type = s.type;
        if (s.noModule) sc.noModule = true;
        if (s.defer) sc.defer = true;
        if (s.async) sc.async = true;
        if (!s.src) sc.textContent = s.textContent;

        document.body.appendChild(sc);
        sc.onload = () => sc.remove();
      });

      if (pushState) {
        history.pushState({}, '', url);
      }

      trackPageView(url);

    } catch (err) {
      location.href = url;
    }
  }

  // ---------- Nav Active State ----------
  function setActive() {
    const hash = location.hash || '';
    const path = location.pathname || '/';

    document.querySelectorAll('.nav-link').forEach((a) => {
      const href = a.getAttribute('href') || '';

      if (href.startsWith('#')) {
        a.classList.toggle('nav-active', href === hash);
      } else {
        try {
          const url = new URL(href, location.href);
          a.classList.toggle('nav-active', url.pathname === path);
        } catch (e) {
          a.classList.remove('nav-active');
        }
      }
    });
  }

  // ---------- Unified Click Handler ----------
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest('a');
    if (!a) return;

    const href = a.getAttribute('href');
    if (!href) return;

    const main = document.querySelector('main');

    // Home link (/)
    if (a.classList.contains('nav-link') && href === '/') {
      ev.preventDefault();

      if (main) {
        main.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      document.querySelectorAll('.nav-link').forEach(x => x.classList.remove('nav-active'));
      a.classList.add('nav-active');
      history.replaceState({}, '', '/');
      trackPageView('/');
      return;
    }

    // Hash links (#section)
    if (href.startsWith('#')) {
      ev.preventDefault();
      const target = document.querySelector(href);
      if (!target) return;

      const nav = document.querySelector('nav');
      const extraOffset = 20;
      const offset = nav ? nav.offsetHeight + extraOffset : 80;

      if (main) {
        const mainRect = main.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        main.scrollTo({
          top: main.scrollTop + targetRect.top - mainRect.top - offset,
          behavior: 'smooth',
        });
      } else {
        const rect = target.getBoundingClientRect();
        const top = window.scrollY + rect.top - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }

      document.querySelectorAll('.nav-link').forEach(x => x.classList.remove('nav-active'));
      if (a.classList.contains('nav-link')) a.classList.add('nav-active');
      history.replaceState({}, '', href);
      return;
    }

    // SPA internal links (same origin, not hash)
    if (!isLocalAnchor(a)) return;

    // ============================================================
    // [FIX] FORCE RELOAD FOR CATEGORY PAGES
    // We explicitly check if the link is for a category.
    // If it is, we use 'return' to skip the SPA logic below.
    // This allows the browser to perform a standard page reload.
    // ============================================================
    if (a.pathname.startsWith('/category/') || a.pathname.includes('/property')) {
      return; 
    }
    // ============================================================

    // Otherwise, prevent reload and use SPA transition
    ev.preventDefault();

    const currentPathAndQuery = window.location.pathname + window.location.search;
    if (href === currentPathAndQuery) return;

    document.querySelectorAll('.nav-link').forEach(x => x.classList.remove('nav-active'));
    if (a.classList.contains('nav-link')) a.classList.add('nav-active');

    fetchAndSwap(href, true);
  });

  // ---------- History API ----------
  window.addEventListener('popstate', () => {
    setActive();
    fetchAndSwap(location.href, false);
    trackPageView(location.href);
  });

  window.addEventListener('hashchange', setActive);
  setActive();

  // ---------- Mobile Dropdown ----------
  const btn  = document.getElementById('profileDropdownBtn');
  const menu = document.getElementById('profileDropdownMenu');
  const icon = document.getElementById('profileDropdownIcon');

  if (btn && menu) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('hidden');
      if (icon) icon.classList.toggle('rotate-180');
    });

    document.addEventListener('click', () => {
      if (!menu.classList.contains('hidden')) {
        menu.classList.add('hidden');
        if (icon) icon.classList.remove('rotate-180');
      }
    });
  }

  // ---------- Navbar Scroll Effect ----------
  let ticking = false;

  function updateNavbar() {
    const nav = document.querySelector('nav');
    if (!nav) return;

    if (window.scrollY > 30) {
      nav.classList.add('shadow-md', 'py-2.5', 'md:py-3');
      nav.classList.remove('py-3', 'md:py-3.5');
    } else {
      nav.classList.remove('shadow-md', 'py-2.5', 'md:py-3');
      nav.classList.add('py-3', 'md:py-3.5');
    }
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        updateNavbar();
        ticking = false;
      });
      ticking = true;
    }
  });
})();