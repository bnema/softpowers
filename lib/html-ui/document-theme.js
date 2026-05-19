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

  function readSavedTheme() {
    try {
      return localStorage.getItem(storageKey);
    } catch (_) {
      return null;
    }
  }

  function saveTheme(value) {
    try {
      localStorage.setItem(storageKey, value);
    } catch (_) {
      /* Theme switching should still work for local file previews. */
    }
  }

  var saved = readSavedTheme() || 'dark';
  root.setAttribute('data-theme', saved);

  var toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      var current = root.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      saveTheme(next);
    });
  }

  document.addEventListener('click', function (event) {
    var activeSection = event.target.closest(
      '.sp-phase, .sp-document[data-doc-kind="spec"] > #overview > section'
    );

    if (!activeSection) {
      return;
    }

    var currentActive = document.querySelector('.is-active-section');
    if (currentActive && currentActive !== activeSection) {
      currentActive.classList.remove('is-active-section');
    }
    activeSection.classList.add('is-active-section');
  });

})();
