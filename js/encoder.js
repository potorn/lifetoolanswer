document.addEventListener('DOMContentLoaded', function () {
  var mode = 'base64';
  var input = document.getElementById('encoderInput');
  var output = document.getElementById('encoderOutput');
  var encodeBtn = document.getElementById('encodeBtn');
  var decodeBtn = document.getElementById('decodeBtn');
  var status = document.getElementById('encoderStatus');
  var encoder = new TextEncoder();
  var decoder = new TextDecoder('utf-8', { fatal: true });

  document.querySelectorAll('[data-mode]').forEach(function (button) {
    button.addEventListener('click', function () {
      mode = button.dataset.mode;
      document.querySelectorAll('[data-mode]').forEach(function (tab) {
        var active = tab === button;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
      });
      encodeBtn.textContent = mode === 'base64' ? 'Base64 인코딩' : 'URL 인코딩';
      decodeBtn.textContent = mode === 'base64' ? 'Base64 디코딩' : 'URL 디코딩';
      clearResult();
    });
  });

  input.addEventListener('input', clearResult);
  encodeBtn.addEventListener('click', function () { transform('encode'); });
  decodeBtn.addEventListener('click', function () { transform('decode'); });
  document.getElementById('copyEncoderBtn').addEventListener('click', function () {
    copyText(output, status);
  });

  function transform(direction) {
    if (!input.value) {
      showStatus('변환할 내용을 입력해주세요.', 'error');
      input.focus();
      return;
    }

    try {
      if (mode === 'base64') {
        output.value = direction === 'encode' ? encodeBase64(input.value) : decodeBase64(input.value);
      } else {
        output.value = direction === 'encode'
          ? encodeURIComponent(input.value)
          : decodeURIComponent(input.value.replace(/\+/g, '%20'));
      }
      showStatus((mode === 'base64' ? 'Base64 ' : 'URL ') + (direction === 'encode' ? '인코딩' : '디코딩') + '이 완료되었습니다.', 'success');
    } catch (error) {
      output.value = '';
      showStatus(mode === 'base64'
        ? '올바른 Base64 문자열인지 확인해주세요. UTF-8 텍스트로 디코딩할 수 없는 데이터일 수 있습니다.'
        : '올바른 URL 인코딩 문자열인지 확인해주세요. 불완전한 % 문자가 포함되어 있을 수 있습니다.', 'error');
    }
  }

  function encodeBase64(text) {
    var bytes = encoder.encode(text);
    var binary = '';
    var chunkSize = 8192;
    for (var i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  function decodeBase64(value) {
    var normalized = value.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 === 1) throw new Error('Invalid Base64');
    var binary = atob(normalized);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return decoder.decode(bytes);
  }

  function clearResult() {
    output.value = '';
    status.textContent = '';
    status.className = 'utility-status';
  }

  function showStatus(message, type) {
    status.textContent = message;
    status.className = 'utility-status ' + type;
  }

  function copyText(element, statusElement) {
    if (!element.value) {
      showStatus('복사할 결과가 없습니다.', 'error');
      return;
    }
    var promise = navigator.clipboard && window.isSecureContext
      ? navigator.clipboard.writeText(element.value)
      : Promise.reject(new Error('Clipboard unavailable'));
    promise.then(function () {
      showStatus('결과를 클립보드에 복사했습니다.', 'success');
    }).catch(function () {
      element.focus();
      element.select();
      document.execCommand('copy');
      showStatus('결과를 클립보드에 복사했습니다.', 'success');
    });
  }
});
