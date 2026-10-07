/* Aubury — behaviour for the aubury-* sections.
   Without JavaScript the buy form still works: it posts the chosen variant to
   /cart/add and Shopify redirects to checkout. */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    initGallery();
    initBuy();
  });

  /* ---- Gallery: thumbnails scroll the snap track ---- */
  function initGallery() {
    var track = document.querySelector('[data-aub-track]');
    if (!track) return;
    var thumbs = Array.prototype.slice.call(document.querySelectorAll('[data-aub-thumb]'));
    var slides = Array.prototype.slice.call(track.children);
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function mark(index) {
      thumbs.forEach(function (thumb, i) {
        thumb.setAttribute('aria-current', i === index ? 'true' : 'false');
      });
    }

    thumbs.forEach(function (thumb, index) {
      thumb.addEventListener('click', function () {
        var slide = slides[index];
        if (!slide) return;
        track.scrollTo({ left: slide.offsetLeft - track.offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
        mark(index);
      });
    });

    var ticking = false;
    track.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        ticking = false;
        var index = Math.round(track.scrollLeft / Math.max(track.clientWidth, 1));
        mark(Math.min(index, slides.length - 1));
      });
    });
  }

  /* ---- Buy box: tier selection, sticky bar, straight-to-checkout ---- */
  function initBuy() {
    var form = document.querySelector('[data-aub-buy]');
    if (!form) return;

    var radios = Array.prototype.slice.call(form.querySelectorAll('input[name="id"]'));
    var button = form.querySelector('[data-aub-submit]');
    var sticky = document.querySelector('[data-aub-sticky]');
    var errorBox = form.querySelector('[data-aub-error]');
    var singles = form.querySelector('[data-aub-singles]');

    function current() {
      return radios.filter(function (radio) { return radio.checked; })[0];
    }

    function sync() {
      var radio = current();
      if (!radio) return;
      var price = radio.getAttribute('data-price') || '';
      var name = radio.getAttribute('data-name') || '';
      var ship = radio.getAttribute('data-ship') || '';

      Array.prototype.forEach.call(document.querySelectorAll('[data-aub-price]'), function (el) { el.textContent = price; });
      Array.prototype.forEach.call(document.querySelectorAll('[data-aub-name]'), function (el) { el.textContent = name; });
      Array.prototype.forEach.call(document.querySelectorAll('[data-aub-ship]'), function (el) { el.textContent = ship; });
      Array.prototype.forEach.call(document.querySelectorAll('[data-aub-saving]'), function (el) {
        el.hidden = el.getAttribute('data-aub-saving') !== radio.getAttribute('data-tier');
      });
      if (singles && radio.closest('[data-aub-singles]')) singles.open = true;
    }

    radios.forEach(function (radio) { radio.addEventListener('change', sync); });
    sync();

    if (sticky && button && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        var entry = entries[0];
        var passed = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        sticky.setAttribute('data-visible', passed ? 'true' : 'false');
      }).observe(button);

      var stickyButton = sticky.querySelector('[data-aub-sticky-submit]');
      if (stickyButton) {
        stickyButton.addEventListener('click', function () {
          if (form.requestSubmit) form.requestSubmit();
          else form.submit();
        });
      }
    }

    /* Coming back from checkout with the back button restores a disabled button. */
    window.addEventListener('pageshow', function () {
      Array.prototype.forEach.call(document.querySelectorAll('[data-aub-submit], [data-aub-sticky-submit]'), function (el) {
        el.disabled = false;
      });
    });

    /* One routine per order: empty the cart, add the chosen tier, go to checkout. */
    form.addEventListener('submit', function (event) {
      var radio = current();
      if (!radio || !window.fetch) return;
      event.preventDefault();

      var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-aub-submit], [data-aub-sticky-submit]'));
      buttons.forEach(function (el) { el.disabled = true; });
      if (errorBox) errorBox.hidden = true;

      var root = form.getAttribute('data-root') || '/';
      var json = { 'Content-Type': 'application/json', Accept: 'application/json' };

      fetch(root + 'cart/clear.js', { method: 'POST', headers: json })
        .then(function () {
          return fetch(root + 'cart/add.js', {
            method: 'POST',
            headers: json,
            body: JSON.stringify({ items: [{ id: Number(radio.value), quantity: 1 }] }),
          });
        })
        .then(function (response) {
          if (!response.ok) throw new Error('add failed');
          window.location.href = root + 'checkout';
        })
        .catch(function () {
          buttons.forEach(function (el) { el.disabled = false; });
          if (errorBox) errorBox.hidden = false;
        });
    });
  }
})();
