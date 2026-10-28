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
    email: 'digitaltakhleeq@gmail.com',
    currency: 'PKR',
    // Email-by-backend button on the package builder:
    //   'auto' = show it only when the backend answers a health check (recommended)
    //   'on'   = always show   |   'off' = never show (WhatsApp only)
    backend: 'auto',
    defaultSelection: { website: 'starter' } // what is ticked when the page opens
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

  /* ---- Shared helpers: money, message links, form posting -------------------------- */
  function money(n) { return CONFIG.currency + ' ' + Math.round(n).toLocaleString('en-US'); }
  function clip(t, n) { return t.length > n ? t.slice(0, n - 3) + '...' : t; }
  function waLink(text) { return 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(clip(text, 1500)); }
  function mailLink(subject, body) {
    return 'mailto:' + CONFIG.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(String(body).replace(/\n/g, '\r\n'));
  }
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var PHONE_RE = /^[+0-9()\-\s]{7,20}$/;

  /* POST a form to the backend; resolves to {kind: 'ok' | 'errors' | 'limit' | 'fail', ...} */
  function postForm(formEl, extra) {
    var fd = new FormData(formEl);
    Object.keys(extra || {}).forEach(function (k) { fd.set(k, extra[k]); });
    return fetch(CONFIG.endpoint, { method: 'POST', body: fd, headers: { 'Accept': 'application/json' } })
      .then(function (r) {
        return r.text().then(function (t) {
          var data = null;
          try { data = JSON.parse(t); } catch (err) { /* not JSON */ }
          if (data && data.ok) return { kind: 'ok' };
          if (data && data.errors) return { kind: 'errors', errors: data.errors, message: data.message };
          if (r.status === 429) return { kind: 'limit' };
          return { kind: 'fail' };
        });
      })
      .catch(function () { return { kind: 'fail' }; });
  }

  /* Inline field errors for a form */
  function errorTools(formEl, statusEl) {
    function set(name, msg) {
      var p = formEl.querySelector('[data-err="' + name + '"]');
      if (!p) return;
      p.textContent = msg || '';
      var field = p.closest('.field');
      if (field) field.classList.toggle('has-error', !!msg);
      var input = field && field.querySelector('input, textarea');
      if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    }
    return {
      set: set,
      clear: function () {
        $$('[data-err]', formEl).forEach(function (p) { set(p.dataset.err, ''); });
        statusEl.textContent = ''; statusEl.classList.remove('is-error');
      },
      status: function (msg, isError) { statusEl.textContent = msg; statusEl.classList.toggle('is-error', !!isError); }
    };
  }

  /* ---- Backend detection: is api/contact.php (or the Python API) live and configured? ---- */
  var backend = { live: false };
  var onBackend = [];
  function detectBackend() {
    if (CONFIG.backend === 'on') return Promise.resolve(true);
    if (CONFIG.backend === 'off' || !window.fetch) return Promise.resolve(false);
    return fetch(CONFIG.endpoint + '?ping=1', { headers: { 'Accept': 'application/json' }, cache: 'no-store' })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        var j = null;
        try { j = JSON.parse(t); } catch (e) { /* static host: HTML or 404 */ }
        return !!(j && j.service === 'dt-contact' && j.ready === true);
      })
      .catch(function () { return false; });
  }
  function refreshBackend() {
    return detectBackend().then(function (live) {
      backend.live = live;
      onBackend.forEach(function (fn) { fn(live); });
    });
  }
  document.addEventListener('dt:recheck-backend', refreshBackend);

  /* ---- Package builder ------------------------------------------------------------------ */
  var capsEl = $('#caps');
  var quoteEl = $('#quote');
  if (capsEl && quoteEl) {
    var pricing = null;
    var sel = {};                         // item id -> chosen tier id
    var capsMsg = $('#capsMsg');
    var onceBox = $('#quoteOnceBox'), onceEl = $('#quoteOnce');
    var monthlyBox = $('#quoteMonthlyBox'), monthlyEl = $('#quoteMonthly');
    var linesEl = $('#quoteLines'), noteEl = $('#quoteNote');
    var waBtn = $('#quoteWa'), mailBtn = $('#quoteMail');
    var viewEl = $('#quoteView'), qForm = $('#quoteForm');
    var okEl = $('#quoteSuccess'), fbEl = $('#quoteFallback');
    var qStatus = $('#quoteStatus'), qSend = $('#quoteSend');
    var qErr = errorTools(qForm, qStatus);
    var qTs = $('#q-ts');

    function show(which) {
      viewEl.hidden = which !== 'view';
      qForm.hidden = which !== 'form';
      okEl.hidden = which !== 'success';
      fbEl.hidden = which !== 'fallback';
      quoteEl.classList.toggle('is-form', which === 'form');
      var focusEl = which === 'form' ? $('#q-name') : which === 'success' ? okEl : which === 'fallback' ? fbEl : null;
      if (focusEl) focusEl.focus({ preventScroll: false });
    }

    function itemOf(id) { return pricing.items.filter(function (i) { return i.id === id; })[0]; }
    function tierOf(item) { return item.tiers.filter(function (t) { return t.id === sel[item.id]; })[0]; }
    function selection() {
      if (!pricing) return [];
      return pricing.items.filter(function (i) { return sel[i.id] && tierOf(i); })
        .map(function (i) { return { item: i, tier: tierOf(i) }; });
    }
    function totals(list) {
      var t = { once: 0, monthly: 0 };
      list.forEach(function (x) { t[x.item.billing === 'monthly' ? 'monthly' : 'once'] += x.tier.price; });
      return t;
    }
    function unit(item) { return item.billing === 'monthly' ? ' / month' : ''; }

    /* Message text used for WhatsApp, the email fallback and the backend template preview */
    function packageText(detail) {
      var list = selection(), t = totals(list);
      if (!list.length) return 'Hello Digital Takhleeq, I would like a quote for a project.';
      var L = ['Hello Digital Takhleeq,', 'I would like a quote for this package:', ''];
      list.forEach(function (x, i) {
        L.push((i + 1) + '. ' + x.item.name + ' (' + x.tier.name + '): ' + money(x.tier.price) + unit(x.item));
        if (detail) L.push('   ' + x.tier.detail);
      });
      L.push('');
      if (t.once) L.push('One-time total, starting from: ' + money(t.once));
      if (t.monthly) L.push('Monthly total, starting from: ' + money(t.monthly) + ' / month');
      L.push('', 'Please contact me to discuss the scope.');
      return L.join('\n');
    }

    /* ---- animated totals ---- */
    var anim = {};
    function animateTotal(key, node, target, render) {
      var st = anim[key] || (anim[key] = { v: null, raf: 0 });
      cancelAnimationFrame(st.raf);
      if (st.v === null || reduce || st.v === target) { st.v = target; st.shown = target; render(node, target); return; }
      var from = (typeof st.shown === 'number' && st.shown !== undefined) ? st.shown : st.v, t0 = null, dur = 550;
      st.v = target;                       // st.v always holds the latest target; the displayed value is tracked per frame
      (function tick(t) {
        if (t0 === null) t0 = t;
        var k = Math.max(0, Math.min(1, (t - t0) / dur)), e = 1 - Math.pow(1 - k, 3);
        var v = from + (target - from) * e;
        st.shown = v;
        render(node, v);
        if (k < 1) st.raf = requestAnimationFrame(tick);
      })(performance.now());
    }
    function renderOnce(node, v) { node.textContent = money(v) + (v > 0 ? '+' : ''); }
    function renderMonthly(node, v) { node.innerHTML = ''; node.appendChild(document.createTextNode(money(v) + '+ ')); var s = document.createElement('small'); s.textContent = '/ month'; node.appendChild(s); }

    function lineItem(x, small) {
      var li = document.createElement('li');
      var n = document.createElement('span'); n.className = 'ql-name';
      var b = document.createElement('b'); b.textContent = x.item.name;
      var em = document.createElement('em'); em.textContent = ' ' + x.tier.name;
      n.appendChild(b); n.appendChild(em);
      var p = document.createElement('span'); p.className = 'ql-price';
      p.textContent = money(x.tier.price) + (x.item.billing === 'monthly' ? ' / mo' : '');
      li.appendChild(n); li.appendChild(p);
      return li;
    }
    function fillLines(ul, list) {
      ul.innerHTML = '';
      if (!list.length) {
        var li = document.createElement('li'); li.className = 'ql-empty'; li.textContent = 'Select a capability to build your package.'; ul.appendChild(li); return;
      }
      list.forEach(function (x) { ul.appendChild(lineItem(x)); });
    }

    function updateQuote() {
      var list = selection(), t = totals(list);
      animateTotal('once', onceEl, t.once, renderOnce);
      animateTotal('monthly', monthlyEl, t.monthly, renderMonthly);
      onceBox.hidden = list.length > 0 && t.once === 0;
      monthlyBox.hidden = t.monthly === 0;
      fillLines(linesEl, list);
      fillLines($('#quoteFormLines'), list);
      var note = [];
      if (pricing) {
        if (t.once) note.push('One-time work is paid in milestones: ' + pricing.milestones + '.');
        note.push('A fixed quote follows a short discovery call. ' + pricing.exclusions);
      }
      noteEl.textContent = list.length ? note.join(' ') : '';
      waBtn.href = waLink(packageText(false));
      waBtn.setAttribute('aria-disabled', pricing && !list.length ? 'true' : 'false');
      if (mailBtn) mailBtn.disabled = !list.length;
    }

    /* ---- capability cards ---- */
    function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
    function refreshCard(card, item) {
      var on = !!sel[item.id], tier = tierOf(item);
      card.classList.toggle('is-on', on);
      $('.cap-head', card).setAttribute('aria-pressed', on ? 'true' : 'false');
      var from = $('.cap-from', card);
      from.innerHTML = '';
      var lbl = el('span', null, on ? tier.name : 'From');
      var price = el('b', null, money(on ? tier.price : item.tiers[0].price) + (item.billing === 'monthly' ? ' / mo' : ''));
      from.appendChild(lbl); from.appendChild(price);
      $$('.tier', card).forEach(function (b) {
        var cur = on && b.dataset.tier === sel[item.id];
        b.setAttribute('aria-checked', cur ? 'true' : 'false');
        b.tabIndex = cur ? 0 : -1;
      });
    }
    function renderCaps() {
      capsEl.innerHTML = '';
      pricing.items.forEach(function (item) {
        var card = el('div', 'cap'); card.dataset.id = item.id;
        var head = el('button', 'cap-head'); head.type = 'button'; head.setAttribute('aria-pressed', 'false');
        head.innerHTML = '<span class="box"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg></span>';
        var t = el('span', 'cap-t'); t.appendChild(el('b', null, item.name)); t.appendChild(el('em', null, item.blurb));
        head.appendChild(t); head.appendChild(el('span', 'cap-from'));
        card.appendChild(head);
        var wrap = el('div', 'tiers-wrap'), inner = el('div'), tiers = el('div', 'tiers');
        tiers.setAttribute('role', 'radiogroup'); tiers.setAttribute('aria-label', item.name + ' scope');
        item.tiers.forEach(function (tr) {
          var b = el('button', 'tier'); b.type = 'button'; b.dataset.tier = tr.id; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false');
          b.appendChild(el('b', null, tr.name));
          b.appendChild(el('span', 'tp', money(tr.price) + (item.billing === 'monthly' ? ' / mo' : '')));
          b.appendChild(el('small', null, tr.detail));
          b.addEventListener('click', function () { sel[item.id] = tr.id; refreshCard(card, item); updateQuote(); });
          b.addEventListener('keydown', function (e) {
            var k = e.key, dir = (k === 'ArrowRight' || k === 'ArrowDown') ? 1 : (k === 'ArrowLeft' || k === 'ArrowUp') ? -1 : 0;
            if (!dir) return;
            e.preventDefault();
            var idx = item.tiers.map(function (x) { return x.id; }).indexOf(sel[item.id]);
            var next = item.tiers[(idx + dir + item.tiers.length) % item.tiers.length];
            sel[item.id] = next.id; refreshCard(card, item); updateQuote();
            var nb = $('.tier[data-tier="' + next.id + '"]', card); if (nb) nb.focus();
          });
          tiers.appendChild(b);
        });
        inner.appendChild(tiers); wrap.appendChild(inner); card.appendChild(wrap);
        head.addEventListener('click', function () {
          if (sel[item.id]) delete sel[item.id]; else sel[item.id] = item.tiers[0].id;
          refreshCard(card, item); updateQuote();
        });
        capsEl.appendChild(card);
        refreshCard(card, item);
      });
    }

    function applyBackend(live) { if (mailBtn) mailBtn.hidden = !live; }
    onBackend.push(applyBackend);

    /* ---- actions ---- */
    if (mailBtn) mailBtn.addEventListener('click', function () {
      if (!selection().length) return;
      if (qTs) qTs.value = String(Date.now());
      qErr.clear();
      show('form');
    });
    $('#quoteBack').addEventListener('click', function () { show('view'); });
    $('#quoteAgain').addEventListener('click', function () { show('view'); });
    $('#quoteFbBack').addEventListener('click', function () { show('view'); });
    ['name', 'email', 'phone'].forEach(function (n) {
      qForm.elements.namedItem(n).addEventListener('input', function () { qErr.set(n, ''); });
    });
    qForm.elements.namedItem('consent').addEventListener('change', function () { qErr.set('consent', ''); });

    function quoteFallback() {
      var f = function (n) { return qForm.elements.namedItem(n).value.trim(); };
      var who = ['', 'My details:', 'Name: ' + f('name'), 'Email: ' + f('email')];
      if (f('phone')) who.push('Phone: ' + f('phone'));
      if (f('message')) who.push('', 'Note: ' + f('message'));
      var text = packageText(true) + '\n' + who.join('\n');
      $('#qfbWa').href = waLink(text);
      $('#qfbMail').href = mailLink('Package quote request from ' + f('name'), text);
      show('fallback');
    }

    qForm.addEventListener('submit', function (e) {
      e.preventDefault();
      qErr.clear();
      var f = function (n) { return qForm.elements.namedItem(n); };
      var bad = null;
      function flag(n, m) { qErr.set(n, m); if (!bad) bad = f(n); }
      if (f('name').value.trim().length < 2) flag('name', 'Please enter your name.');
      if (!EMAIL_RE.test(f('email').value.trim())) flag('email', 'Please enter a valid email address.');
      if (f('phone').value && !PHONE_RE.test(f('phone').value.trim())) flag('phone', 'Use digits, spaces, + or - only.');
      if (!f('consent').checked) flag('consent', 'Please agree so we can reply to you.');
      if (bad) { bad.focus(); return; }
      var list = selection();
      if (!list.length) { show('view'); return; }
      qSend.disabled = true; qSend.classList.add('is-loading'); qErr.status('Sending...', false);
      postForm(qForm, {
        type: 'package',
        package: JSON.stringify(list.map(function (x) { return { id: x.item.id, tier: x.tier.id }; }))
      }).then(function (res) {
        qSend.disabled = false; qSend.classList.remove('is-loading');
        if (res.kind === 'ok') { qErr.status('', false); qForm.reset(); show('success'); return; }
        if (res.kind === 'errors') {
          Object.keys(res.errors).forEach(function (k) { qErr.set(k, res.errors[k]); });
          qErr.status(res.message || 'Please check the highlighted fields.', true); return;
        }
        if (res.kind === 'limit') { qErr.status('Too many messages from this connection. Please try again in a little while.', true); return; }
        quoteFallback();
      });
    });

    /* ---- load prices ---- */
    function start(data) {
      pricing = data;
      sel = {};
      Object.keys(CONFIG.defaultSelection).forEach(function (id) {
        var item = itemOf(id), tier = item && item.tiers.filter(function (t) { return t.id === CONFIG.defaultSelection[id]; })[0];
        if (item && tier) sel[id] = tier.id;
      });
      renderCaps();
      updateQuote();
    }
    updateQuote();
    if (window.DT_PRICING && window.DT_PRICING.items) {
      start(window.DT_PRICING);     // prices come from assets/data/pricing.js
    } else {
      capsMsg.innerHTML = '';
      capsMsg.appendChild(document.createTextNode('The package prices could not load. '));
      var a = document.createElement('a'); a.href = waLink('Hello Digital Takhleeq, I would like a quote for a project.'); a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Message us on WhatsApp';
      capsMsg.appendChild(a); capsMsg.appendChild(document.createTextNode(' and we will send a quote.'));
    }
  }

  /* ---- Service links: pre-fill the contact form ---------------------------------------- */
  function setServices(list) {
    $$('#svcChips input[type="checkbox"]').forEach(function (cb) { cb.checked = list.indexOf(cb.value) !== -1; });
  }
  $$('[data-service]').forEach(function (a) {
    a.addEventListener('click', function () { setServices([a.dataset.service]); });
  });

  /* ---- Project screenshot fallback ------------------------------------------------------ */
  $$('.shot img').forEach(function (img) {
    function drop() { img.remove(); }
    img.addEventListener('error', drop);
    if (img.complete && img.naturalWidth === 0) drop();
  });

  /* ---- Contact form (formal enquiry) ---------------------------------------------------- */
  var form = $('#contactForm');
  if (form) {
    var tsField = $('#f-ts');
    if (tsField) tsField.value = String(Date.now());
    var statusEl = $('#formStatus');
    var submitBtn = $('#submitBtn');
    var success = $('#formSuccess');
    var fallback = $('#formFallback');
    var errs = errorTools(form, statusEl);
    // Note: form.name would return the form's own name attribute, so fields are looked up explicitly.
    function fld(n) { return form.elements.namedItem(n); }

    function validate() {
      var ok = true, first = null;
      var name = fld('name').value.trim();
      var email = fld('email').value.trim();
      var message = fld('message').value.trim();
      function bad(n, m, el) { errs.set(n, m); ok = false; if (!first) first = el; }
      if (name.length < 2) bad('name', 'Please enter your name.', fld('name'));
      if (!EMAIL_RE.test(email)) bad('email', 'Please enter a valid email address.', fld('email'));
      if (fld('phone').value && !PHONE_RE.test(fld('phone').value.trim())) bad('phone', 'Use digits, spaces, + or - only.', fld('phone'));
      if (message.length < 10) bad('message', 'Tell us a little more, at least a sentence.', fld('message'));
      if (!fld('consent').checked) bad('consent', 'Please agree so we can reply to you.', fld('consent'));
      if (first) first.focus();
      return ok;
    }
    ['name', 'email', 'phone', 'message'].forEach(function (n) {
      fld(n).addEventListener('input', function () { errs.set(n, ''); });
    });
    fld('consent').addEventListener('change', function () { errs.set('consent', ''); });

    /* The same details as a ready-to-send message, for WhatsApp or the visitor's email app */
    function contactText() {
      var v = function (n) { return fld(n).value.trim(); };
      var checked = function (n) { var c = form.querySelector('input[name="' + n + '"]:checked'); return c ? c.value : ''; };
      var services = $$('#svcChips input:checked').map(function (c) { return c.value; });
      var L = ['Hello Digital Takhleeq,', 'My name is ' + v('name') + (v('company') ? ' (' + v('company') + ')' : '') + '. I would like to discuss a project.', ''];
      if (services.length) L.push('Services: ' + services.join(', '));
      if (checked('budget')) L.push('Budget: ' + checked('budget'));
      if (checked('timeline')) L.push('Timeline: ' + checked('timeline'));
      L.push('', 'Details:', v('message'), '', 'Reach me at: ' + v('email') + (v('phone') ? ' | ' + v('phone') : ''));
      return L.join('\n');
    }
    function showFallback() {
      var text = contactText();
      var wa = $('#fbWa'), ml = $('#fbMail');
      if (wa) wa.href = waLink(text);
      if (ml) ml.href = mailLink('Project inquiry from ' + fld('name').value.trim(), text);
      form.hidden = true; success.hidden = true; fallback.hidden = false; fallback.focus();
    }
    function showSuccess() {
      form.hidden = true; fallback.hidden = true; success.hidden = false; success.focus();
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errs.clear();
      if (!validate()) return;
      submitBtn.disabled = true;
      submitBtn.classList.add('is-loading');
      errs.status('Sending...', false);
      postForm(form).then(function (res) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('is-loading');
        if (res.kind === 'ok') { errs.status('', false); showSuccess(); return; }
        if (res.kind === 'errors') {
          Object.keys(res.errors).forEach(function (k) { errs.set(k, res.errors[k]); });
          errs.status(res.message || 'Please check the highlighted fields.', true); return;
        }
        if (res.kind === 'limit') { errs.status('Too many messages from this connection. Please try again in a little while.', true); return; }
        errs.status('', false);
        showFallback();
      });
    });

    if (/[?&]sent=1/.test(location.search)) showSuccess();
    else if (/[?&]error=1/.test(location.search)) showFallback();
  }

  refreshBackend();
})();
