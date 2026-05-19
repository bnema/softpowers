/*
 * CODE BLOCK HELPER
 *
 * Adds copy buttons and offline-safe code block shells for generated
 * documents. Keep this helper self-contained so file:// previews work.
 */
(function () {
  'use strict';

  var didStart = false;

  function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(value);
    }

    return new Promise(function (resolve, reject) {
      var textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-1000px';
      textarea.style.left = '-1000px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      try {
        var copied = document.execCommand('copy');
        document.body.removeChild(textarea);
        copied ? resolve() : reject(new Error('Copy command failed.'));
      } catch (error) {
        document.body.removeChild(textarea);
        reject(error);
      }
    });
  }

  function createCopyButton(source) {
    var button = document.createElement('button');
    var resetTimer;

    button.className = 'sp-code-copy';
    button.type = 'button';
    button.textContent = 'Copy';
    button.setAttribute('aria-label', 'Copy code');

    button.addEventListener('click', function () {
      copyText(source).then(function () {
        button.textContent = 'Copied';
        button.classList.remove('is-error');
        button.classList.add('is-copied');
      }).catch(function () {
        button.textContent = 'Failed';
        button.classList.remove('is-copied');
        button.classList.add('is-error');
      }).finally(function () {
        clearTimeout(resetTimer);
        resetTimer = setTimeout(function () {
          button.textContent = 'Copy';
          button.classList.remove('is-copied');
          button.classList.remove('is-error');
        }, 1600);
      });
    });

    return button;
  }

  function createCodeShell(source) {
    var shell = document.createElement('div');
    shell.className = 'sp-code-shell';
    shell.appendChild(createCopyButton(source));
    return shell;
  }

  function wrapExistingPre(pre, source) {
    var shell = createCodeShell(source);
    pre.replaceWith(shell);
    pre.classList.add('sp-code-fallback');
    shell.appendChild(pre);
    return shell;
  }

  function setupCodeBlocks() {
    if (didStart) {
      return;
    }
    didStart = true;

    var codeBlocks = Array.prototype.slice.call(document.querySelectorAll('.sp-doc pre > code'));
    if (!codeBlocks.length) {
      return;
    }

    codeBlocks.forEach(function (codeEl) {
      var pre = codeEl.parentElement;
      var source = codeEl.textContent || '';

      if (!pre.parentElement || !pre.parentElement.classList.contains('sp-code-shell')) {
        wrapExistingPre(pre, source);
      } else {
        pre.classList.add('sp-code-fallback');
      }
    });
  }

  setupCodeBlocks();
  document.addEventListener('DOMContentLoaded', setupCodeBlocks);
})();
