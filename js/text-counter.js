document.addEventListener('DOMContentLoaded', function () {
  var textInput = document.getElementById('textInput');
  var segmenter = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('ko', { granularity: 'grapheme' })
    : null;
  var encoder = new TextEncoder();

  textInput.addEventListener('input', updateCounts);
  document.getElementById('clearBtn').addEventListener('click', function () {
    textInput.value = '';
    updateCounts();
    textInput.focus();
  });

  function updateCounts() {
    var text = textInput.value;
    var compactText = text.replace(/\s/gu, '');
    var trimmedText = text.trim();

    document.getElementById('withSpaces').textContent = formatNumber(countGraphemes(text));
    document.getElementById('withoutSpaces').textContent = formatNumber(countGraphemes(compactText));
    document.getElementById('byteCount').textContent = formatNumber(encoder.encode(text).length);
    document.getElementById('wordCount').textContent = formatNumber(trimmedText ? trimmedText.split(/\s+/u).length : 0);
    document.getElementById('lineCount').textContent = formatNumber(text ? text.split(/\r\n|\r|\n/).length : 0);
  }

  function countGraphemes(text) {
    if (!text) return 0;
    if (segmenter) return Array.from(segmenter.segment(text)).length;
    return Array.from(text).length;
  }

  function formatNumber(value) {
    return value.toLocaleString('ko-KR');
  }
});
