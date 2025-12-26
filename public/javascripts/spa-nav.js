(function () {
  const root = document.documentElement;

  // ---------- Helpers ----------
  function toMs(val) {
    if (!val) return 0;
    val = String(val).trim();
    if (val.endsWith('ms')) return parseFloat(val);
    if (val.endsWith('s')) return parseFloat(val) * 1000;
    return parseInt(val, 10) || 0;
  }

  function delay(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

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

  // ---------- SPA fetch + swap ----------
  async function fetchAndSwap(url, pushState = true) {
    const main = document.querySelector('main');
    if (!main) { location.href = url; return; }

    const duration = toMs(getComputedStyle(root).getPropertyValue('--global-transition-duration'));
    const delayMs = toMs(getComputedStyle(root).getPropertyValue('--global-transition-delay'));
    const waitMs = duration + delayMs;

    main.classList.add('page-exit');
    await delay(waitMs);

    try {
      const res = await fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      if (!res.ok) { location.href = url; return; }
      const text = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      const newMain = doc.querySelector('main');
      const newTitle = doc.querySelector('title');
      if (!newMain) { location.href = url; return; }

      main.innerHTML = newMain.innerHTML;
      if (newTitle) document.title = newTitle.textContent;

      newMain.querySelectorAll('script').forEach((s) => {
        const sc = document.createElement('script');
        if (s.src) sc.src = s.src;
        else sc.textContent = s.textContent;
        document.body.appendChild(sc);
        sc.onload = () => sc.remove();
      });
    } catch (err) {
      location.href = url;
      return;
    } finally {
      main.classList.remove('page-exit');
      main.classList.add('page-enter');
      setTimeout(() => main.classList.remove('page-enter'), duration + 50);
    }
  }

  async function fetchAndAppendRelated(url, related = [], pushState = true) {
    const main = document.querySelector('main');
    if (!main) { location.href = url; return; }

    const duration = toMs(getComputedStyle(root).getPropertyValue('--global-transition-duration'));
    const delayMs = toMs(getComputedStyle(root).getPropertyValue('--global-transition-delay'));
    const waitMs = duration + delayMs;

    main.classList.add('page-exit');
    await delay(waitMs);

    try {
      const res = await fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      if (!res.ok) { location.href = url; return; }
      const text = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      const newMain = doc.querySelector('main');
      const newTitle = doc.querySelector('title');
      if (!newMain) { location.href = url; return; }

      main.innerHTML = newMain.innerHTML;
      if (newTitle) document.title = newTitle.textContent;
      if (pushState) history.pushState({}, '', url);

      newMain.querySelectorAll('script').forEach((s) => {
        const sc = document.createElement('script');
        if (s.src) sc.src = s.src;
        else sc.textContent = s.textContent;
        document.body.appendChild(sc);
        sc.onload = () => sc.remove();
      });

      for (const rel of related) {
        try {
          const r = await fetch(rel.trim(), { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
          if (!r.ok) continue;
          const t = await r.text();
          const d = parser.parseFromString(t, 'text/html');
          const rm = d.querySelector('main');
          const rt = d.querySelector('title');
          if (!rm) continue;

          const section = document.createElement('section');
          section.className = 'related-section page-section mt-8 p-6 bg-white rounded-xl shadow-sm w-full';
          if (rt && rt.textContent) {
            const h = document.createElement('h3');
            h.className = 'text-2xl font-semibold mb-4';
            h.textContent = rt.textContent;
            section.appendChild(h);
          }
          const wrapper = document.createElement('div');
          wrapper.innerHTML = rm.innerHTML;
          section.appendChild(wrapper);
          main.appendChild(section);

          rm.querySelectorAll('script').forEach((s) => {
            const sc = document.createElement('script');
            if (s.src) sc.src = s.src;
            else sc.textContent = s.textContent;
            document.body.appendChild(sc);
            sc.onload = () => sc.remove();
          });
        } catch (ee) {
          continue;
        }
      }
    } catch (err) {
      location.href = url;
      return;
    } finally {
      main.classList.remove('page-exit');
      main.classList.add('page-enter');
      setTimeout(() => main.classList.remove('page-enter'), duration + 50);
    }
  }

  // ---------- Nav active state ----------
  function setActive() {
    const hash = location.hash || '';
    const path = location.pathname || '/';
    document.querySelectorAll('.nav-link').forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (href.startsWith('#')) {
        if (href === hash) a.classList.add('nav-active');
        else a.classList.remove('nav-active');
      } else {
        try {
          const url = new URL(href, location.href);
          if (url.pathname === path) a.classList.add('nav-active');
          else a.classList.remove('nav-active');
        } catch (e) {
          a.classList.remove('nav-active');
        }
      }
    });
  }

  // ---------- Unified click handler ----------
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest('a');
    if (!a) return;

    const href = a.getAttribute('href');
    if (!href) return;

    const main = document.querySelector('main');

    // 0) Home link: scroll to top
    if (a.classList.contains('nav-link') && href === '/') {
      ev.preventDefault();

      if (main) {
        main.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      document.querySelectorAll('.nav-link').forEach((x) =>
        x.classList.remove('nav-active')
      );
      a.classList.add('nav-active');
      history.replaceState({}, '', '/');
      return;
    }

    // 1) Hash links: scroll to section
    if (href.startsWith('#')) {
      ev.preventDefault();

      const target = document.querySelector(href);
      if (!target) return;

      if (main) {
        const mainRect = main.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const offset = targetRect.top - mainRect.top;

        main.scrollTo({
          top: main.scrollTop + offset - 80, // adjust for fixed navbar height
          behavior: 'smooth',
        });
      } else {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      document.querySelectorAll('.nav-link').forEach((x) =>
        x.classList.remove('nav-active')
      );
      if (a.classList.contains('nav-link')) {
        a.classList.add('nav-active');
      }

      history.replaceState({}, '', href);
      return;
    }

    // 2) SPA internal links
    if (!isLocalAnchor(a)) return;

    ev.preventDefault();
    if (href === window.location.pathname + window.location.search) return;

    const related = (a.dataset && a.dataset.related)
      ? a.dataset.related.split(',').map((s) => s.trim()).filter(Boolean)
      : null;

    document.querySelectorAll('.nav-link').forEach((x) =>
      x.classList.remove('nav-active')
    );
    if (a.classList.contains('nav-link')) {
      a.classList.add('nav-active');
    }

    if (related && related.length) {
      fetchAndAppendRelated(href, related, true);
    } else {
      fetchAndSwap(href, true);
    }
  });

  // ---------- History events ----------
  window.addEventListener('popstate', () => {
    setActive();
    fetchAndSwap(location.href, false);
  });

  window.addEventListener('hashchange', setActive);
  setActive();

  // ---------- Dropdown (mobile) ----------
  const btn = document.getElementById('profileDropdownBtn');
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
})();
