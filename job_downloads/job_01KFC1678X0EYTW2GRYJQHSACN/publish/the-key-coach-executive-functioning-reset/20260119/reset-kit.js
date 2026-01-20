/* CC360 Funnel Reset Kit
   - UTM capture + 7-day persistence (localStorage)
   - Hidden-field injection into forms
   - Lead form handler (no-backend): store email, redirect to thank-you.html with attribution params
*/

(function () {
  'use strict';

  var CANON = {
    project_slug: 'the-key-coach-executive-functioning-reset',
    utm_keys: [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'referrer',
      'landing_page'
    ],
    persistence_days: 7,
    storage_key: 'the-key-coach-executive-functioning-reset_attr_v1',
    lead_email_key: 'the-key-coach-executive-functioning-reset_lead_email_v1'
  };

  function nowMs() { return Date.now(); }
  function daysToMs(days) { return days * 24 * 60 * 60 * 1000; }

  function safeJsonParse(value) {
    try { return JSON.parse(value); } catch (e) { return null; }
  }

  function getUrlNoHash() {
    var href = String(window.location.href || '');
    var hashIndex = href.indexOf('#');
    if (hashIndex >= 0) return href.slice(0, hashIndex);
    return href;
  }

  function readStoredAttribution() {
    var raw = null;
    try { raw = window.localStorage.getItem(CANON.storage_key); } catch (e) { raw = null; }
    if (!raw) return null;

    var parsed = safeJsonParse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    var expiresAt = Number(parsed.expires_at_ms || 0);
    if (!expiresAt || expiresAt < nowMs()) {
      try { window.localStorage.removeItem(CANON.storage_key); } catch (e2) {}
      return null;
    }

    if (!parsed.data || typeof parsed.data !== 'object') return null;
    return parsed;
  }

  function writeStoredAttribution(dataObj) {
    var storedAt = nowMs();
    var payload = {
      data: dataObj,
      stored_at_ms: storedAt,
      expires_at_ms: storedAt + daysToMs(CANON.persistence_days)
    };

    try {
      window.localStorage.setItem(CANON.storage_key, JSON.stringify(payload));
    } catch (e) {
      /* If storage is blocked, fail silently. */
    }
    return payload;
  }

  function captureAttribution() {
    var params = new URLSearchParams(String(window.location.search || ''));
    var incoming = {};
    for (var i = 0; i < CANON.utm_keys.length; i++) {
      var key = CANON.utm_keys[i];
      var v = params.get(key);
      if (v !== null && String(v).trim() !== '') incoming[key] = String(v);
    }

    var existing = readStoredAttribution();
    var data = {};
    if (existing && existing.data) {
      for (var k in existing.data) {
        if (Object.prototype.hasOwnProperty.call(existing.data, k)) data[k] = existing.data[k];
      }
    }
    for (var k2 in incoming) {
      if (Object.prototype.hasOwnProperty.call(incoming, k2)) data[k2] = incoming[k2];
    }

    if (!data.referrer) {
      var ref = String(document.referrer || '').trim();
      if (ref) data.referrer = ref;
    }

    if (!data.landing_page) {
      data.landing_page = getUrlNoHash();
    }

    writeStoredAttribution(data);
    return data;
  }

  function buildQueryFromAttribution(attr) {
    var parts = [];
    for (var i = 0; i < CANON.utm_keys.length; i++) {
      var key = CANON.utm_keys[i];
      var v = attr[key];
      if (v === undefined || v === null) continue;
      var s = String(v).trim();
      if (!s) continue;
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(s));
    }
    return parts.join('&');
  }

  function appendAttributionToHref(href, attr) {
    if (!href) return href;
    var raw = String(href);

    if (raw.charAt(0) === '#') return raw;
    if (/^(mailto:|tel:|javascript:)/i.test(raw)) return raw;

    var hash = '';
    var hashIndex = raw.indexOf('#');
    if (hashIndex >= 0) {
      hash = raw.slice(hashIndex);
      raw = raw.slice(0, hashIndex);
    }

    var query = buildQueryFromAttribution(attr);
    if (!query) return raw + hash;

    if (raw.indexOf('?') >= 0) return raw + '&' + query + hash;
    return raw + '?' + query + hash;
  }

  function injectHiddenFields(attr) {
    var selector = 'form[data-cc360-capture="1"], form[data-cc360-lead-form="1"]';
    var forms = document.querySelectorAll(selector);
    for (var f = 0; f < forms.length; f++) {
      var form = forms[f];

      for (var i = 0; i < CANON.utm_keys.length; i++) {
        var key = CANON.utm_keys[i];
        var input = form.querySelector('input[name="' + key + '"]');
        if (!input) {
          input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          form.appendChild(input);
        }
        input.value = attr[key] ? String(attr[key]) : '';
      }
    }
  }

  function decorateLinks(attr) {
    var links = document.querySelectorAll('a[data-cc360-append-attribution="1"]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var href = a.getAttribute('href');
      if (!href) continue;
      a.setAttribute('href', appendAttributionToHref(href, attr));
    }
  }

  function setupLeadForm(attr) {
    var form = document.querySelector('form[data-cc360-lead-form="1"]');
    if (!form) return;

    form.addEventListener('submit', function (evt) {
      evt.preventDefault();

      var emailInput = form.querySelector('input[type="email"][name="email"], input[name="email"]');
      var email = emailInput ? String(emailInput.value || '').trim() : '';

      if (!email) {
        if (emailInput) emailInput.focus();
        return;
      }

      try { window.localStorage.setItem(CANON.lead_email_key, email); } catch (e) {}

      var destination = 'thank-you.html';
      var redirectUrl = appendAttributionToHref(destination, attr);
      window.location.assign(redirectUrl);
    });
  }

  function populateLeadEmail() {
    var wrap = document.getElementById('cc360-email-wrap');
    var slot = document.getElementById('cc360-lead-email');
    if (!wrap || !slot) return;

    var email = '';
    try { email = String(window.localStorage.getItem(CANON.lead_email_key) || '').trim(); } catch (e) { email = ''; }

    if (email) {
      slot.textContent = email;
      wrap.removeAttribute('hidden');
    } else {
      wrap.setAttribute('hidden', '');
    }
  }

  function init() {
    var attr = captureAttribution();
    injectHiddenFields(attr);
    decorateLinks(attr);
    setupLeadForm(attr);
    populateLeadEmail();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();