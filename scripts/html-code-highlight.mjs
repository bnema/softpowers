function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function token(className, value) {
  return `<span class="${className}">${escapeHtml(value)}</span>`;
}

function normalizeLanguage(language) {
  return String(language || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)[0];
}

function findJsonStringEnd(source, start) {
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];
    if (char === '\\') {
      index += 1;
      continue;
    }
    if (char === '"') {
      return index + 1;
    }
  }
  return source.length;
}

function isJsonKey(source, end) {
  let index = end;
  while (index < source.length && /\s/.test(source[index])) {
    index += 1;
  }
  return source[index] === ':';
}

function highlightJson(source) {
  let html = '';
  let index = 0;

  while (index < source.length) {
    const rest = source.slice(index);
    const char = source[index];

    if (char === '"') {
      const end = findJsonStringEnd(source, index);
      const value = source.slice(index, end);
      html += token(isJsonKey(source, end) ? 'sp-token-key' : 'sp-token-string', value);
      index = end;
      continue;
    }

    const numberMatch = rest.match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (numberMatch) {
      html += token('sp-token-number', numberMatch[0]);
      index += numberMatch[0].length;
      continue;
    }

    const keywordMatch = rest.match(/^(true|false|null)\b/);
    if (keywordMatch) {
      html += token(keywordMatch[0] === 'null' ? 'sp-token-null' : 'sp-token-boolean', keywordMatch[0]);
      index += keywordMatch[0].length;
      continue;
    }

    if (/^[{}\[\]:,]$/.test(char)) {
      html += token('sp-token-punctuation', char);
      index += 1;
      continue;
    }

    html += escapeHtml(char);
    index += 1;
  }

  return html;
}

export function renderHighlightedCode(language, source) {
  const normalized = normalizeLanguage(language);
  if (normalized === 'json' || normalized === 'jsonc') {
    return {
      highlighted: true,
      html: highlightJson(String(source)),
    };
  }

  return {
    highlighted: false,
    html: escapeHtml(source),
  };
}
