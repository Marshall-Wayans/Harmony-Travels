/* app.js — merged header + site interactions
   ---------------------------------------------------------------------------
   Purpose: Contains site-wide UI behaviours:
     - header shrink/pinned & auto-hide on scroll
     - mobile menu toggle that preserves aria-expanded
     - theme toggle with persistence (localStorage)
     - prefetch booking page on hover/focus to improve perceived speed
     - quick search form redirect with query params
     - IntersectionObserver reveal animations (with staggered children)
     - packages slider controls (click + touch swipe)
     - map modals (main and footer)
     - "Learn more" inline detail modal creator
     - newsletter modal shown once per session (after 50% scroll)
     - callback form (simulated), newsletter subscribe (simulated) + confetti
     - footer reveal observer
     - back-to-top behaviour and accessibility helpers (Escape closes modals)
   ---------------------------------------------------------------------------
   Notes on approach:
     - Uses small helper functions ($, $$) for concise selectors.
     - Uses IntersectionObserver where possible for efficient scroll animations.
     - Keeps changes minimal and unobtrusive to existing markup/IDs.
*/

/* ---------- small DOM helpers ---------- */
/* $ returns a single element, $$ returns an array of elements */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ---------- cached elements (query once for performance) ---------- */
const header = document.getElementById('site-header');
const menuToggle = document.getElementById('menu-toggle');
const primaryNav = document.getElementById('primary-nav');
const themeToggle = document.getElementById('theme-toggle');
const backBtn = document.getElementById('backToTop');

/* ==========================================================================
   Header: shrink/pin (using requestAnimationFrame) and auto-hide after
   inactivity when scrolling down.
   Why rAF? It avoids layout thrashing and keeps scroll handling smooth.
   ========================================================================== */
(() => {
  let lastScrollY = window.pageYOffset || document.documentElement.scrollTop;
  let ticking = false;            // prevents multiple rAF calls stacking
  const SHRINK_Y = 60;            // pixel threshold where header shrinks
  let hideTimer = null;           // holds timeout id for auto-hide

  // schedule header hide after a short period of downward scrolling
  function scheduleAutoHide() {
    if (!header) return;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      header.style.top = '-84px'; // push the header off-screen (CSS handles transitions)
    }, 850); // slight delay so it doesn't feel twitchy
  }

  // cancel the auto-hide and restore header (used when scrolling up)
  function cancelAutoHide() {
    if (!header) return;
    clearTimeout(hideTimer);
    header.style.top = '0';
  }

  // main scroll handler (optimised using rAF)
  function onScroll() {
    const y = window.pageYOffset || document.documentElement.scrollTop;

    if (!ticking) {
      window.requestAnimationFrame(() => {
        // shrink header when past SHRINK_Y for a compact look
        if (y > SHRINK_Y) header && header.classList.add('scrolled');
        else header && header.classList.remove('scrolled');

        // if user scrolls up, "pin" (reveal) the header; if scrolling down, unpin and schedule hide
        if (y < lastScrollY) {
          header && header.classList.add('pinned');
          cancelAutoHide(); // keep header visible while user scrolls up
        } else {
          header && header.classList.remove('pinned');
          scheduleAutoHide(); // hide after inactivity when scrolling down
        }

        lastScrollY = y <= 0 ? 0 : y;
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  // run once to set correct initial state
  onScroll();
})();

/* ==========================================================================
   Mobile menu toggle
   - toggles aria-expanded on the button
   - toggles display of the primary navigation on small screens
   Why: keeps menu accessible & usable without heavy frameworks.
   ========================================================================== */
if (menuToggle) {
  menuToggle.addEventListener('click', () => {
    const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!expanded));
    if (primaryNav) {
      if (expanded) {
        // close menu
        primaryNav.style.display = 'none';
      } else {
        // open menu (CSS will handle desktop behavior)
        primaryNav.style.display = 'flex';
        primaryNav.style.flexDirection = getComputedStyle(primaryNav).flexDirection || 'column';
      }
    }
  });
}

/* ==========================================================================
   Theme toggle (dark/light) with persistence
   - toggles body.light and updates icon + aria-label
   - stores preference in localStorage
   Why: lets user pick preferred theme and remembers it between visits.
   ========================================================================== */
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light');
    const isLight = document.body.classList.contains('light');
    themeToggle.innerHTML = isLight ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    themeToggle.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
    try { localStorage.setItem('ht_theme_light', isLight ? '1' : '0'); } catch (e) { /* ignore storage errors */ }
  });
}
// apply saved theme on load (if any)
try {
  const saved = localStorage.getItem('ht_theme_light');
  if (saved === '1') {
    document.body.classList.add('light');
    if (themeToggle) themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
  }
} catch (e) { /* ignore localStorage access errors on restricted browsers */ }

/* ==========================================================================
   Prefetch booking page: on hover/focus of CTAs we add a <link rel=prefetch>
   Why: improves perceived performance by telling the browser to fetch booking
   resources when user is likely to click.
   ========================================================================== */
function prefetchBooking() {
  if (!document.querySelector('link[rel="prefetch"][href="/booking.html"]')) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = '/booking.html';
    document.head.appendChild(link);
  }
}
$$('.btn-cta, .btn-link').forEach(el => {
  el.addEventListener('mouseover', prefetchBooking);
  el.addEventListener('focus', prefetchBooking);
});

/* ==========================================================================
   Quick search (short booking strip) — redirect to booking page with params
   - collects dest, start, end and navigates with query params.
   Why: simple client-side prefill UX without a backend.
   ========================================================================== */
const quickForm = document.getElementById('quick-search');
quickForm && quickForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const destVal = document.getElementById('quick-dest');
  const dest = destVal ? encodeURIComponent(destVal.value) : '';
  const start = document.getElementById('quick-start') ? document.getElementById('quick-start').value : '';
  const end = document.getElementById('quick-end') ? document.getElementById('quick-end').value : '';
  let url = '/booking.html';
  const params = new URLSearchParams();
  if (dest) params.set('dest', dest);
  if (start) params.set('start', start);
  if (end) params.set('end', end);
  if ([...params].length) url += '?' + params.toString();
  // navigate to booking with prefilled query params
  window.location.href = url;
});

/* ==========================================================================
   IntersectionObserver reveal with stagger
   - reveals elements with .scroll-reveal once they are in view
   - for destinations section, applies staggered reveal to child cards
   Why: efficient, avoids heavy scroll listeners and gives polished UX.
   ========================================================================== */
function initReveal() {
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        if (entry.target.classList.contains('destinations-section')) {
          const cards = entry.target.querySelectorAll('.dest-card');
          cards.forEach((c, i) => setTimeout(()=> c.classList.add('revealed'), i * 120));
        }
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  // observe all revealable sections/elements
  document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el));
}
document.addEventListener('DOMContentLoaded', initReveal);

/* ==========================================================================
   Packages slider controls — left/right buttons and touch swipe
   Why: basic carousel without extra libraries, touch-friendly for mobile.
   ========================================================================== */
const track = document.getElementById('slider-track');
const prevBtn = document.getElementById('prevPackage');
const nextBtn = document.getElementById('nextPackage');
prevBtn && prevBtn.addEventListener('click', () => track && track.scrollBy({left: -320, behavior: 'smooth'}));
nextBtn && nextBtn.addEventListener('click', () => track && track.scrollBy({left: 320, behavior: 'smooth'}));
if (track) {
  let startX = 0;
  track.addEventListener('touchstart', (e)=> startX = e.touches[0].clientX);
  track.addEventListener('touchend', (e)=> {
    const endX = e.changedTouches[0].clientX;
    if (endX - startX > 50) track.scrollBy({left:-320, behavior:'smooth'});
    if (startX - endX > 50) track.scrollBy({left:320, behavior:'smooth'});
  });
}

/* ==========================================================================
   Main map modal: opens an iframe with embed URL set in data-map attribute
   - map-close and outside-click close behaviour implemented
   Why: lightweight modal for map previews without extra deps.
   ========================================================================== */
const mapModal = document.getElementById('mapModal');
const mapFrame = document.getElementById('mapFrame');
const mapClose = document.getElementById('mapClose');
$$('.map-toggle').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const url = btn.dataset.map;
    if (!mapFrame || !mapModal) return;
    mapFrame.innerHTML = `<iframe src="${url}" width="100%" height="450" style="border:0;border-radius:8px" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
    mapModal.setAttribute('aria-hidden','false');
    mapClose && mapClose.focus(); // move keyboard focus to close button for accessibility
  });
});
mapClose && mapClose.addEventListener('click', ()=> { mapModal && mapModal.setAttribute('aria-hidden','true'); if (mapFrame) mapFrame.innerHTML = ''; });
window.addEventListener('click', (e)=> { if (e.target === mapModal) { mapModal && mapModal.setAttribute('aria-hidden','true'); if (mapFrame) mapFrame.innerHTML=''; } });

/* ==========================================================================
   Footer map modal (separate element ids)
   ========================================================================== */
const footerMapModal = document.getElementById('footerMapModal');
const footerMapFrame = document.getElementById('footerMapFrame');
const footerMapClose = document.getElementById('footerMapClose');
const openMapBtn = document.getElementById('openMap');
openMapBtn && openMapBtn.addEventListener('click', (e) => {
  const url = e.currentTarget.dataset.map || 'https://www.google.com/maps?q=Nairobi,Kenya&output=embed';
  if (!footerMapFrame || !footerMapModal) return;
  footerMapFrame.innerHTML = `<iframe src="${url}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
  footerMapModal.setAttribute('aria-hidden', 'false');
  footerMapClose && footerMapClose.focus();
});
footerMapClose && footerMapClose.addEventListener('click', () => {
  footerMapModal && footerMapModal.setAttribute('aria-hidden','true');
  footerMapFrame && (footerMapFrame.innerHTML = '');
});
window.addEventListener('click', (e) => {
  if (e.target === footerMapModal) { footerMapModal && footerMapModal.setAttribute('aria-hidden','true'); footerMapFrame && (footerMapFrame.innerHTML = ''); }
});

/* ==========================================================================
   "Learn more" inline detail modal — creates a small modal with content map
   Why: avoids many hidden elements in markup; creates modal on demand.
   ========================================================================== */
$$('.more-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.more || 'info';
    const contentMap = {
      maasai: `<h3>Maasai Mara — Highlights</h3><p>Perfect for safari lovers. Best time: July–Oct. Includes game drives and cultural visits.</p>`,
      amboseli: `<h3>Amboseli — Highlights</h3><p>Famed for elephant photography with Kilimanjaro views.</p>`,
      diani: `<h3>Diani — Highlights</h3><p>Beachfront relaxation, water sports, and coral reefs.</p>`,
      mount: `<h3>Mount Kenya — Highlights</h3><p>Alpine hikes and scenic vistas; options for day hikes and multi-day climbs.</p>`,
      nakuru: `<h3>Lake Nakuru — Highlights</h3><p>Flamingos, rhinos and birding paradise.</p>`,
      lamu: `<h3>Lamu — Highlights</h3><p>Historic Swahili town with dhows and relaxed pace.</p>`
    };
    const html = contentMap[key] || '<p>More details coming soon.</p>';
    const modal = document.createElement('div');
    modal.className = 'modal'; modal.setAttribute('aria-hidden','false');
    modal.innerHTML = `<div class="modal-panel">${html}<button class="modal-close">Close</button></div>`;
    document.body.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', ()=> modal.remove());
    modal.addEventListener('click', (ev)=> { if (ev.target === modal) modal.remove(); });
  });
});

/* ==========================================================================
   Newsletter modal displayed once per session after user scrolls 50% down
   Why: unobtrusive timing, stored in sessionStorage so it's shown once per session.
   ========================================================================== */
let newsletterShown = sessionStorage.getItem('ht_news_shown') === '1';
const newsletterModal = document.getElementById('newsletterModal');
const newsletterClose = document.getElementById('newsletterClose');
function checkNewsletter() {
  if (newsletterShown) return;
  const scrolled = window.scrollY + window.innerHeight;
  if (scrolled > document.body.scrollHeight * 0.5) {
    newsletterShown = true;
    try { sessionStorage.setItem('ht_news_shown','1'); } catch(e){}
    newsletterModal && newsletterModal.setAttribute('aria-hidden','false');
  }
}
window.addEventListener('scroll', checkNewsletter);
newsletterClose && newsletterClose.addEventListener('click', ()=> newsletterModal && newsletterModal.setAttribute('aria-hidden','true'));

// optional modal subscribe inside newsletter modal (id: modalSubscribe)
const modalSubscribe = document.getElementById('modalSubscribe');
modalSubscribe && modalSubscribe.addEventListener('submit', (e)=> {
  e.preventDefault();
  alert('Thanks! (demo)');
  newsletterModal && newsletterModal.setAttribute('aria-hidden','true');
});

/* ==========================================================================
   Global Escape key handler to close open modals (accessibility friendly)
   ========================================================================== */
document.addEventListener('keydown', (e)=> {
  if (e.key === 'Escape') {
    if (mapModal && mapModal.getAttribute('aria-hidden') === 'false') {
      mapModal.setAttribute('aria-hidden','true'); if (mapFrame) mapFrame.innerHTML = '';
    }
    if (footerMapModal && footerMapModal.getAttribute('aria-hidden') === 'false') {
      footerMapModal.setAttribute('aria-hidden','true'); if (footerMapFrame) footerMapFrame.innerHTML = '';
    }
    const openNewsletter = document.getElementById('newsletterModal');
    if (openNewsletter && openNewsletter.getAttribute('aria-hidden') === 'false') openNewsletter.setAttribute('aria-hidden','true');
    document.querySelectorAll('.modal[aria-hidden="false"]').forEach(m => m.setAttribute('aria-hidden','true'));
  }
});

/* ==========================================================================
   Subscribe inline demo: simple feedback for footer subscription form
   ========================================================================== */
const subscribeInline = document.getElementById('subscribeForm');
subscribeInline && subscribeInline.addEventListener('submit', (e)=> { e.preventDefault(); alert('Subscribed (demo).'); });

/* ==========================================================================
   Keyboard accessibility: allow pressing Enter on destination card to open booking
   Why: lets keyboard-only users navigate and book quickly.
   ========================================================================== */
$$('.dest-card').forEach(card => {
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const dest = card.dataset.dest;
      window.location.href = `/booking.html?dest=${encodeURIComponent(dest)}`;
    }
  });
});

/* ==========================================================================
   Footer reveal observer — adds .revealed class to animate the footer in
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const footer = document.getElementById('site-footer');
  if (!footer) return;
  const obs = new IntersectionObserver((entries, o) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        footer.classList.add('revealed');
        o.unobserve(e.target);
      }
    });
  }, {threshold: 0.15});
  obs.observe(footer);
});

/* ==========================================================================
   Callback form (simulated) — basic validation & inline message
   - validates a phone length and shows ephemeral message
   Why: better UX than an alert; demonstrates behaviour in demo environments.
   ========================================================================== */
const cbForm = document.getElementById('callbackForm');
if (cbForm) {
  cbForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const phoneInput = cbForm.querySelector('input[name="phone"]') || cbForm.querySelector('input[type="tel"]');
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const msgBox = cbForm.querySelector('.form-msg');
    if (!phone || phone.length < 9) {
      if (msgBox) { msgBox.textContent = 'Please enter a valid phone number.'; msgBox.style.color = '#ffcccb'; }
      return;
    }
    if (msgBox) { msgBox.textContent = 'Request sent! Our agent will call you shortly.'; msgBox.style.color = 'var(--accent)'; }
    setTimeout(()=> { if (msgBox) { msgBox.textContent = ''; } cbForm.reset(); }, 3500);
  });
}

/* ==========================================================================
   Newsletter subscribe (footer) + confetti animation (lightweight)
   - confetti implemented by adding small spans + CSS transitions
   Why: delight users on subscribe without heavy libraries.
   ========================================================================== */
const newsletterForm = document.getElementById('newsletterForm');
const confettiRoot = document.getElementById('confetti-root');

function showConfetti() {
  if (!confettiRoot) return;
  for (let i=0;i<24;i++){
    const p = document.createElement('span');
    p.className = 'confetti';
    const size = Math.random()*8 + 6;
    const left = Math.random()*100;
    p.style.left = `${left}%`;
    p.style.width = `${size}px`;
    p.style.height = `${size*0.6}px`;
    p.style.background = ['#FFD166','#FF8C42','#00B4D8','#9AE66E'][Math.floor(Math.random()*4)];
    p.style.transform = `translateY(-10px) rotate(${Math.random()*360}deg)`;
    confettiRoot.appendChild(p);
    (function(elem){
      requestAnimationFrame(()=> { elem.style.transform = `translateY(70vh) rotate(${Math.random()*720}deg)`; elem.style.opacity = '0'; });
      setTimeout(()=> elem.remove(), 1800);
    })(p);
  }
}
// inject minimal confetti CSS (so we don't need external stylesheet changes)
(function(){
  const s = document.createElement('style');
  s.textContent = `.confetti { position:fixed; top:10%; pointer-events:none; opacity:1; border-radius:2px; z-index:1700; transition: transform 1.5s cubic-bezier(.2,.8,.2,1), opacity .9s; }`;
  document.head.appendChild(s);
})();

if (newsletterForm) {
  newsletterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const emailInput = newsletterForm.querySelector('input[type="email"]');
    const email = emailInput ? emailInput.value.trim() : '';
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      alert('Please enter a valid email address.');
      return;
    }
    const btn = newsletterForm.querySelector('button[type="submit"]');
    btn && (btn.disabled = true, btn.textContent = 'Thanks!');
    showConfetti();
    try { sessionStorage.setItem('ht_subscribed', '1'); } catch(e){}
    setTimeout(()=> {
      newsletterForm.reset();
      if (btn) { btn.disabled = false; btn.textContent = 'Subscribe'; }
    }, 1600);
  });
}

/* ==========================================================================
   Back to top button behaviour
   - shows after ~15% scrolled down
   - smooth scroll to top on click
   Why: small UX convenience for long pages.
   ========================================================================== */
if (backBtn) {
  window.addEventListener('scroll', () => {
    const show = window.scrollY > document.body.scrollHeight * 0.15;
    backBtn.classList.toggle('show', show);
  });
  backBtn.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({top:0, behavior:'smooth'});
  });
}


