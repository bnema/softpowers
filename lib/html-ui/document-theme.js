/*
 * DOCUMENT THEME HELPER
 *
 * Provides theme detection and switching for document templates.
 * Do not edit generated templates directly — run scripts/sync-html-templates.mjs.
 */
(function () {
  'use strict';

  // Detect OS theme preference
  var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  function updateTheme() {
    document.documentElement.setAttribute('data-theme', darkQuery.matches ? 'dark' : 'light');
  }
  updateTheme();
  darkQuery.addEventListener('change', updateTheme);
})();
