/* Digital Takhleeq website interactions. No dependencies. */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---- Settings you may want to change ---------------------------------- */
  var CONFIG = {
    endpoint: 'api/contact.php',          // change to your Python API URL if you use that backend
    whatsapp: '923455052261',
    // Starting prices in PKR. Only Website has a confirmed starting price.
    // To show a number for another capability, add data-price="..." to its button in index.html.
    currency: 'PKR'
  };

  /* ---- Footer year -------------------------------------------------------- */
  var yr = $('#year');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---- Header, progress bar, floating WhatsApp ---------------------------- */
  var header = $('#header');
  var progress = $('.progress');
  var wa = $('#waFloat');
  var ticking = false;
  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (header) header.classList.toggle('is-scrolled', y > 8);
    if (progress) progress.style.setProperty('--p', max > 0 ? Math.min(1, y / max).toFixed(4) : 0);
    if (wa) wa.classList.toggle('is-visible', y > 520);
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  /* ---- Mobile menu --------------------------------------------------------- */
  var menuBtn = $('#menuBtn');
  var menu = $('#menu');
  function setMenu(open) {
    if (!menu || !menuBtn) return;
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(function () { menu.classList.add('is-open'); });
    } else {
      menu.classList.remove('is-open');
      setTimeout(function () { if (!menu.classList.contains('is-open')) menu.hidden = true; }, reduce ? 0 : 380);
    }
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
  }
  if (menuBtn) {
    menuBtn.addEventListener('click', function () { setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'); });
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
    window.addEventListener('resize', function () { if (window.innerWidth > 920) setMenu(false); });
  }

  /* ---- Reveal on scroll ----------------------------------------------------- */
  var revealEls = $$('[data-reveal]');
  function reveal(el) {
    el.classList.add('is-in');
    // After the entrance finishes, drop the attribute so hover transitions take over.
    setTimeout(function () { el.removeAttribute('data-reveal'); }, 1400);
  }
  if (!('IntersectionObserver' in window) || reduce) {
    revealEls.forEach(function (el) { el.classList.add('is-in'); el.removeAttribute('data-reveal'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { reveal(en.target); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
    // Safety net: never leave content hidden if something goes wrong.
    setTimeout(function () { revealEls.forEach(function (el) { if (!el.classList.contains('is-in')) reveal(el); }); }, 6000);
  }

  /* ---- Scroll spy ----------------------------------------------------------- */
  var navLinks = $$('.nav a');
  var spyIds = ['services', 'system', 'work', 'pricing', 'about', 'contact'];
  if (navLinks.length) {
    var spySections = spyIds.concat(['process', 'faq']).map(function (id) { return document.getElementById(id); }).filter(Boolean);
    var spyTick = false;
    var runSpy = function () {
      spyTick = false;
      var line = window.innerHeight * 0.4, current = null;
      spySections.forEach(function (sec) {
        var r = sec.getBoundingClientRect();
        if (r.top <= line && r.bottom > line) current = sec.id;
      });
      var id = current === 'process' ? 'system' : current === 'faq' ? 'about' : current;
      navLinks.forEach(function (a) {
        a.setAttribute('aria-current', a.getAttribute('href') === '#' + id ? 'true' : 'false');
      });
    };
    window.addEventListener('scroll', function () { if (!spyTick) { spyTick = true; requestAnimationFrame(runSpy); } }, { passive: true });
    window.addEventListener('resize', runSpy);
    runSpy();
  }

  /* ---- Lead journey (autoplay, click to jump) -------------------------------- */
  var journey = $('#journey');
  if (journey) {
    var steps = $$('.step', journey);
    var idx = 0;
    var inView = false;
    var DUR = 5;
    journey.style.setProperty('--dur', DUR + 's');

    function setStep(i) {
      idx = (i + steps.length) % steps.length;
      steps.forEach(function (s, n) {
        var on = n === idx;
        s.classList.toggle('is-active', on);
        $('.step-btn', s).setAttribute('aria-expanded', on ? 'true' : 'false');
      });
      // restart the progress animation
      journey.classList.remove('is-playing');
      void journey.offsetWidth;
      if (!reduce && inView) journey.classList.add('is-playing');
    }
    steps.forEach(function (s, n) {
      $('.step-btn', s).addEventListener('click', function () { setStep(n); });
      $('.step-btn', s).addEventListener('animationend', function (e) {
        if (e.pseudoElement === '::after' || e.animationName === 'fill') setStep(idx + 1);
      });
    });
    journey.addEventListener('mouseenter', function () { journey.classList.add('is-paused'); });
    journey.addEventListener('mouseleave', function () { journey.classList.remove('is-paused'); });
    journey.addEventListener('focusin', function () { journey.classList.add('is-paused'); });
    journey.addEventListener('focusout', function () { journey.classList.remove('is-paused'); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        inView = en[0].isIntersecting;
        if (inView && !reduce) { journey.classList.remove('is-playing'); void journey.offsetWidth; journey.classList.add('is-playing'); }
        else journey.classList.remove('is-playing');
      }, { threshold: 0.35 }).observe(journey);
    }
  }

  /* ---- FAQ accordion ---------------------------------------------------------- */
  var faqBtns = $$('.faq-q');
  faqBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      faqBtns.forEach(function (b) {
        b.setAttribute('aria-expanded', 'false');
        var it = b.closest('.faq-item'); if (it) it.classList.remove('is-open');
      });
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      if (!open) { var item = btn.closest('.faq-item'); if (item) item.classList.add('is-open'); }
    });
  });

  /* ---- Pricing calculator ------------------------------------------------------ */
  var caps = $$('.cap');
  var figure = $('#quoteFigure');
  var countEl = $('#quoteCount');
  var tagsEl = $('#quoteTags');
  var noteEl = $('#quoteNote');
  var shownValue = null;
  var raf = null;

  function fmt(n) { return CONFIG.currency + ' ' + Math.round(n).toLocaleString('en-US') + '+'; }
  function animateTo(target) {
    if (!figure) return;
    cancelAnimationFrame(raf);
    if (target === null) { figure.textContent = 'Custom quote'; shownValue = null; return; }
    var from = shownValue === null ? 0 : shownValue;
    if (reduce || from === target) { figure.textContent = fmt(target); shownValue = target; return; }
    var t0 = null, dur = 600;
    (function tick(t) {
      if (t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      figure.textContent = fmt(from + (target - from) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
      else shownValue = target;
    })(performance.now());
  }
  function updateQuote() {
    var on = caps.filter(function (c) { return c.classList.contains('is-on'); });
    var priced = on.filter(function (c) { return c.dataset.price; });
    var total = priced.reduce(function (s, c) { return s + Number(c.dataset.price); }, 0);
    animateTo(priced.length ? total : null);
    if (countEl) countEl.textContent = on.length === 0 ? 'Nothing selected yet' : on.length + (on.length === 1 ? ' capability selected' : ' capabilities selected');
    if (tagsEl) {
      tagsEl.innerHTML = '';
      on.forEach(function (c) {
        var li = document.createElement('li');
        li.textContent = c.dataset.cap;
        tagsEl.appendChild(li);
      });
    }
    if (noteEl) {
      var unpriced = on.length - priced.length;
      noteEl.textContent = !on.length
        ? 'Select at least one capability to see a starting figure.'
        : (priced.length
          ? (unpriced ? 'The Website starting price is shown. ' : '') + (unpriced ? 'Other capabilities are quoted after a discovery call. ' : '') + 'Payments run in three milestones: 40% deposit, 30% review, 30% handover.'
          : 'These capabilities are quoted after a short discovery call. Payments run in three milestones: 40% deposit, 30% review, 30% handover.');
    }
  }
  caps.forEach(function (c) {
    c.addEventListener('click', function () {
      var on = !c.classList.contains('is-on');
      c.classList.toggle('is-on', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
      updateQuote();
    });
  });
  updateQuote();

  /* ---- Pre-fill the contact form from services and pricing ----------------------- */
  var svcMap = { 'Website': 'Websites', 'E-commerce': 'Websites', 'Technical SEO': 'Digital growth', 'Content': 'Digital growth', 'Social media': 'Social media', 'Paid ads': 'Advertising', 'Automation': 'Automation', 'Custom software': 'Custom systems' };
  function setServices(list) {
    $$('#svcChips input[type="checkbox"]').forEach(function (cb) { cb.checked = list.indexOf(cb.value) !== -1; });
  }
  $$('[data-service]').forEach(function (a) {
    a.addEventListener('click', function () { setServices([a.dataset.service]); });
  });
  var quoteCta = $('#quoteCta');
  if (quoteCta) quoteCta.addEventListener('click', function () {
    var list = [];
    caps.filter(function (c) { return c.classList.contains('is-on'); }).forEach(function (c) {
      var m = svcMap[c.dataset.cap]; if (m && list.indexOf(m) === -1) list.push(m);
    });
    setServices(list);
    var msg = $('#f-message');
    if (msg && !msg.value) {
      var chosen = caps.filter(function (c) { return c.classList.contains('is-on'); }).map(function (c) { return c.dataset.cap; });
      if (chosen.length) msg.value = 'I am interested in: ' + chosen.join(', ') + '.\n';
    }
  });

  /* ---- Project screenshot fallback ------------------------------------------------ */
  $$('.shot img').forEach(function (img) {
    function drop() { img.remove(); }
    img.addEventListener('error', drop);
    if (img.complete && img.naturalWidth === 0) drop();
  });

  /* ---- Contact form ------------------------------------------------------------------- */
  var form = $('#contactForm');
  if (form) {
    var tsField = $('#f-ts');
    if (tsField) tsField.value = String(Date.now());
    var statusEl = $('#formStatus');
    var submitBtn = $('#submitBtn');
    var success = $('#formSuccess');
    var fallback = $('#formFallback');

    function setError(name, msg) {
      var p = form.querySelector('[data-err="' + name + '"]');
      if (!p) return;
      p.textContent = msg || '';
      var field = p.closest('.field');
      if (field) field.classList.toggle('has-error', !!msg);
      var input = field && field.querySelector('input, textarea');
      if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    }
    function clearErrors() {
      $$('[data-err]', form).forEach(function (p) { setError(p.dataset.err, ''); });
      statusEl.textContent = ''; statusEl.classList.remove('is-error');
    }
    // Note: form.name would return the form's own name attribute, so fields are looked up explicitly.
    function fld(n) { return form.elements.namedItem(n); }
    function validate() {
      var ok = true, first = null;
      var name = fld('name').value.trim();
      var email = fld('email').value.trim();
      var message = fld('message').value.trim();
      function bad(n, m, el) { setError(n, m); ok = false; if (!first) first = el; }
      if (name.length < 2) bad('name', 'Please enter your name.', fld('name'));
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) bad('email', 'Please enter a valid email address.', fld('email'));
      if (fld('phone').value && !/^[+0-9()\-\s]{7,20}$/.test(fld('phone').value.trim())) bad('phone', 'Use digits, spaces, + or - only.', fld('phone'));
      if (message.length < 10) bad('message', 'Tell us a little more, at least a sentence.', fld('message'));
      if (!fld('consent').checked) bad('consent', 'Please agree so we can reply to you.', fld('consent'));
      if (first) first.focus();
      return ok;
    }
    ['name', 'email', 'phone', 'message'].forEach(function (n) {
      fld(n).addEventListener('input', function () { setError(n, ''); });
    });
    fld('consent').addEventListener('change', function () { setError('consent', ''); });

    function showFallback() {
      form.hidden = true; success.hidden = true; fallback.hidden = false; fallback.focus();
    }
    function showSuccess() {
      form.hidden = true; fallback.hidden = true; success.hidden = false; success.focus();
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors();
      if (!validate()) return;
      submitBtn.disabled = true;
      submitBtn.classList.add('is-loading');
      statusEl.textContent = 'Sending…';

      fetch(CONFIG.endpoint, { method: 'POST', body: new FormData(form), headers: { 'Accept': 'application/json' } })
        .then(function (r) {
          return r.text().then(function (t) {
            var data = null;
            try { data = JSON.parse(t); } catch (err) { /* not JSON */ }
            return { status: r.status, data: data };
          });
        })
        .then(function (res) {
          if (res.data && res.data.ok) { showSuccess(); return; }
          if (res.data && res.data.errors) {
            Object.keys(res.data.errors).forEach(function (k) { setError(k, res.data.errors[k]); });
            statusEl.textContent = res.data.message || 'Please check the highlighted fields.';
            statusEl.classList.add('is-error');
            return;
          }
          if (res.status === 429) {
            statusEl.textContent = 'Too many messages from this connection. Please try again in a little while.';
            statusEl.classList.add('is-error');
            return;
          }
          showFallback();
        })
        .catch(function () { showFallback(); })
        .then(function () {
          submitBtn.disabled = false;
          submitBtn.classList.remove('is-loading');
          if (!statusEl.classList.contains('is-error')) statusEl.textContent = '';
        });
    });

    if (/[?&]sent=1/.test(location.search)) showSuccess();
    else if (/[?&]error=1/.test(location.search)) showFallback();
  }
})();
