/*
 * SHIKI HIGHLIGHT HELPER
 *
 * Highlights generated document code blocks in the browser using Shiki's CDN
 * build. The import is version-pinned so generated documents are deterministic
 * about the highlighter API they load.
 */
(function () {
  'use strict';

  var shikiUrl = 'https://esm.sh/shiki@4.0.2';
  var didStart = false;
  var languageAliases = {
    bash: 'bash',
    shell: 'bash',
    sh: 'bash',
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    md: 'markdown',
    markdown: 'markdown',
    txt: 'text',
    text: 'text',
    html: 'html',
    css: 'css',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
  };

  function detectLanguage(codeEl) {
    var className = codeEl.getAttribute('class') || '';
    var match = className.match(/(?:^|\s)language-([^\s]+)/);
    var lang = match ? match[1].toLowerCase() : 'text';
    return languageAliases[lang] || lang;
  }

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
    shell.appendChild(pre);
    return shell;
  }

  function replaceWithHighlightedBlock(originalPre, source, highlightedHtml, lang) {
    var container = document.createElement('div');
    container.innerHTML = highlightedHtml;
    var highlightedPre = container.querySelector('pre');

    if (!highlightedPre) {
      throw new Error('Shiki did not return a pre element.');
    }

    highlightedPre.classList.add('sp-shiki');
    highlightedPre.setAttribute('data-language', lang);
    if (originalPre.parentElement && originalPre.parentElement.classList.contains('sp-code-shell')) {
      originalPre.replaceWith(highlightedPre);
      return;
    }

    var shell = createCodeShell(source);
    originalPre.replaceWith(shell);
    shell.appendChild(highlightedPre);
  }

  function markFallback(pre, source) {
    pre.classList.add('sp-code-fallback');
    if (!pre.parentElement || pre.parentElement.classList.contains('sp-code-shell')) {
      return;
    }
    wrapExistingPre(pre, source);
  }

  function highlightBlock(codeToHtml, block) {
    return codeToHtml(block.source, {
      lang: block.lang,
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      defaultColor: 'light',
    }).then(function (html) {
      replaceWithHighlightedBlock(block.pre, block.source, html, block.lang);
    }).catch(function () {
      if (block.lang === 'text') {
        markFallback(block.pre, block.source);
        return;
      }

      return codeToHtml(block.source, {
        lang: 'text',
        themes: {
          light: 'github-light',
          dark: 'github-dark',
        },
        defaultColor: 'light',
      }).then(function (html) {
        replaceWithHighlightedBlock(block.pre, block.source, html, 'text');
      }).catch(function () {
        markFallback(block.pre, block.source);
      });
    });
  }

  function highlightDocument() {
    if (didStart) {
      return;
    }
    didStart = true;

    var codeBlocks = Array.prototype.slice.call(document.querySelectorAll('.sp-doc pre > code'));
    if (!codeBlocks.length) {
      return;
    }

    var blocks = codeBlocks.map(function (codeEl) {
      var pre = codeEl.parentElement;
      var source = codeEl.textContent || '';

      if (!pre.parentElement || !pre.parentElement.classList.contains('sp-code-shell')) {
        wrapExistingPre(pre, source);
      }

      return {
        pre: pre,
        source: source,
        lang: detectLanguage(codeEl),
      };
    });

    import(shikiUrl).then(function (shiki) {
      return Promise.all(blocks.map(function (block) {
        return highlightBlock(shiki.codeToHtml, block);
      }));
    }).catch(function () {
      blocks.forEach(function (block) {
        markFallback(block.pre, block.source);
      });
    });
  }

  highlightDocument();
  document.addEventListener('DOMContentLoaded', highlightDocument);
})();
