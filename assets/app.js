(function () {
  'use strict';

  var EN = window.I18N_EN || {};
  var STORE = 'gs-lang';

  // Русский — то, что лежит в разметке. Снимаем его один раз,
  // чтобы возврат на RU не требовал второго словаря.
  var nodes = [].slice.call(document.querySelectorAll('[data-i18n]'));
  var arias = [].slice.call(document.querySelectorAll('[data-i18n-aria]'));
  var ru = { 'doc.title': document.title };

  nodes.forEach(function (el) {
    var key = el.getAttribute('data-i18n');
    if (!(key in ru)) { ru[key] = el.textContent; }
  });
  arias.forEach(function (el) {
    var key = el.getAttribute('data-i18n-aria');
    if (!(key in ru)) { ru[key] = el.getAttribute('aria-label') || ''; }
  });

  function apply(lang) {
    var dict = lang === 'en' ? EN : ru;

    nodes.forEach(function (el) {
      var v = dict[el.getAttribute('data-i18n')];
      if (typeof v === 'string') { el.textContent = v; }
    });
    arias.forEach(function (el) {
      var v = dict[el.getAttribute('data-i18n-aria')];
      if (typeof v === 'string' && v) { el.setAttribute('aria-label', v); }
    });

    if (dict['doc.title']) { document.title = dict['doc.title']; }
    document.documentElement.lang = lang;

    [].forEach.call(document.querySelectorAll('.seg__btn'), function (b) {
      var on = b.getAttribute('data-lang') === lang;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    try { localStorage.setItem(STORE, lang); } catch (e) { /* приватный режим */ }

    // Ссылку с ?lang=en можно отправить сразу на английской версии
    if (window.history && history.replaceState) {
      var url = new URL(window.location.href);
      if (lang === 'en') { url.searchParams.set('lang', 'en'); }
      else { url.searchParams.delete('lang'); }
      history.replaceState(null, '', url.toString() );
    }
  }

  function initialLang() {
    var q = new URLSearchParams(window.location.search).get('lang');
    if (q === 'en' || q === 'ru') { return q; }
    var saved = null;
    try { saved = localStorage.getItem(STORE); } catch (e) { /* ignore */ }
    if (saved === 'en' || saved === 'ru') { return saved; }
    return (navigator.language || '').toLowerCase().indexOf('ru') === 0 ? 'ru' : 'en';
  }

  [].forEach.call(document.querySelectorAll('.seg__btn'), function (b) {
    b.addEventListener('click', function () { apply(b.getAttribute('data-lang')); });
  });

  apply(initialLang());

  // ---- мобильное меню ----
  var sheet = document.getElementById('menu');
  var open = document.getElementById('menuOpen');
  var close = document.getElementById('menuClose');

  if (sheet && open) {
    var show = function () {
      if (typeof sheet.showModal === 'function') { sheet.showModal(); }
      else { sheet.setAttribute('open', ''); }
    };
    var hide = function () {
      if (typeof sheet.close === 'function') { sheet.close(); }
      else { sheet.removeAttribute('open'); }
    };

    open.addEventListener('click', show);
    if (close) { close.addEventListener('click', hide); }

    // клик по подложке закрывает лист
    sheet.addEventListener('click', function (e) {
      if (e.target === sheet) { hide(); }
    });
    [].forEach.call(sheet.querySelectorAll('a'), function (a) {
      a.addEventListener('click', hide);
    });
  }
})();
