/*
 * DOCUMENT THEME HELPER
 *
 * Provides theme persistence and switching for document templates.
 * Dark mode is the default on first load.
 * Do not edit generated templates directly — run scripts/sync-html-templates.mjs.
 */
(function () {
  'use strict';

  var storageKey = 'softpowers-doc-theme';
  var root = document.documentElement;
  var saved = localStorage.getItem(storageKey) || 'dark';
  root.setAttribute('data-theme', saved);

  var toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      var current = root.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem(storageKey, next);
    });
  }

  var codeBlocks = document.querySelectorAll('.sp-doc pre code');
  for (var i = 0; i < codeBlocks.length; i += 1) {
    codeBlocks[i].classList.add('microlight');
  }

})();
