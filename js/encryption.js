document.addEventListener('DOMContentLoaded', function () {
  var textEncoder = new TextEncoder();
  var textDecoder = new TextDecoder('utf-8', { fatal: true });
  var aesIterations = 250000;

  document.querySelectorAll('[data-crypto-tab]').forEach(function (button) {
    button.addEventListener('click', function () {
      var selected = button.dataset.cryptoTab;
      document.querySelectorAll('[data-crypto-tab]').forEach(function (tab) {
        var active = tab === button;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
      });
      document.querySelectorAll('[data-crypto-panel]').forEach(function (panel) {
        var active = panel.dataset.cryptoPanel === selected;
        panel.classList.toggle('active', active);
        panel.hidden = !active;
      });
    });
  });

  document.getElementById('togglePassword').addEventListener('click', function () {
    var password = document.getElementById('aesPassword');
    var show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    this.textContent = show ? '숨기기' : '표시';
    this.setAttribute('aria-pressed', String(show));
  });
  document.getElementById('aesEncryptBtn').addEventListener('click', function () { processAes('encrypt'); });
  document.getElementById('aesDecryptBtn').addEventListener('click', function () { processAes('decrypt'); });
  document.getElementById('copyAesBtn').addEventListener('click', function () { copyOutput('aesOutput', 'aesStatus'); });
  document.getElementById('moveAesBtn').addEventListener('click', function () {
    var output = document.getElementById('aesOutput');
    if (!output.value) {
      showStatus('aesStatus', '입력으로 옮길 결과가 없습니다.', 'error');
      return;
    }
    document.getElementById('aesInput').value = output.value;
    output.value = '';
    showStatus('aesStatus', '결과를 입력란으로 옮겼습니다.', 'success');
  });

  document.getElementById('keywordEncryptBtn').addEventListener('click', function () { processKeyword(false); });
  document.getElementById('keywordDecryptBtn').addEventListener('click', function () { processKeyword(true); });
  document.getElementById('substitutionEncryptBtn').addEventListener('click', function () { processSubstitution(false); });
  document.getElementById('substitutionDecryptBtn').addEventListener('click', function () { processSubstitution(true); });
  document.querySelectorAll('.crypto-copy').forEach(function (button) {
    button.addEventListener('click', function () {
      copyOutput(button.dataset.target, button.dataset.target === 'keywordOutput' ? 'keywordStatus' : 'substitutionStatus');
    });
  });

  async function processAes(direction) {
    var input = document.getElementById('aesInput');
    var password = document.getElementById('aesPassword');
    var output = document.getElementById('aesOutput');
    var encryptButton = document.getElementById('aesEncryptBtn');
    var decryptButton = document.getElementById('aesDecryptBtn');

    if (!input.value) {
      showStatus('aesStatus', direction === 'encrypt' ? '암호화할 내용을 입력해주세요.' : '복호화할 암호문을 입력해주세요.', 'error');
      input.focus();
      return;
    }
    if (!password.value) {
      showStatus('aesStatus', '비밀번호를 입력해주세요.', 'error');
      password.focus();
      return;
    }
    if (!window.crypto || !window.crypto.subtle) {
      showStatus('aesStatus', '현재 브라우저에서는 AES 암호화 기능을 사용할 수 없습니다. 최신 브라우저에서 다시 시도해주세요.', 'error');
      return;
    }

    encryptButton.disabled = true;
    decryptButton.disabled = true;
    showStatus('aesStatus', direction === 'encrypt' ? '암호화하고 있습니다...' : '복호화하고 있습니다...', 'working');
    try {
      output.value = direction === 'encrypt'
        ? await encryptAes(input.value, password.value)
        : await decryptAes(input.value.trim(), password.value);
      showStatus('aesStatus', direction === 'encrypt'
        ? 'AES-GCM 암호화가 완료되었습니다. 암호문과 비밀번호를 따로 보관하세요.'
        : 'AES-GCM 복호화가 완료되었습니다.', 'success');
    } catch (error) {
      output.value = '';
      showStatus('aesStatus', direction === 'encrypt'
        ? '암호화하지 못했습니다. 브라우저 환경을 확인해주세요.'
        : '복호화하지 못했습니다. 암호문 형식과 비밀번호가 정확한지 확인해주세요.', 'error');
    } finally {
      encryptButton.disabled = false;
      decryptButton.disabled = false;
    }
  }

  async function encryptAes(plainText, password) {
    var salt = window.crypto.getRandomValues(new Uint8Array(16));
    var iv = window.crypto.getRandomValues(new Uint8Array(12));
    var key = await deriveAesKey(password, salt, aesIterations);
    var cipherBuffer = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, textEncoder.encode(plainText));
    return ['LTAES1', aesIterations, toBase64Url(salt), toBase64Url(iv), toBase64Url(new Uint8Array(cipherBuffer))].join('.');
  }

  async function decryptAes(payload, password) {
    var parts = payload.split('.');
    if (parts.length !== 5 || parts[0] !== 'LTAES1') throw new Error('Invalid format');
    var iterations = Number(parts[1]);
    if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000) throw new Error('Invalid iterations');
    var salt = fromBase64Url(parts[2]);
    var iv = fromBase64Url(parts[3]);
    var cipherBytes = fromBase64Url(parts[4]);
    if (salt.length !== 16 || iv.length !== 12 || cipherBytes.length < 16) throw new Error('Invalid payload');
    var key = await deriveAesKey(password, salt, iterations);
    var plainBuffer = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, cipherBytes);
    return textDecoder.decode(plainBuffer);
  }

  async function deriveAesKey(password, salt, iterations) {
    var keyMaterial = await window.crypto.subtle.importKey('raw', textEncoder.encode(password), 'PBKDF2', false, ['deriveKey']);
    return window.crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  function processKeyword(decrypt) {
    var input = document.getElementById('keywordInput');
    var keyInput = document.getElementById('keywordKey');
    var key = keyInput.value.toUpperCase().replace(/[^A-Z]/g, '');
    if (!input.value) {
      showStatus('keywordStatus', decrypt ? '복호화할 내용을 입력해주세요.' : '암호화할 내용을 입력해주세요.', 'error');
      input.focus();
      return;
    }
    if (!key) {
      showStatus('keywordStatus', 'A부터 Z까지의 영문 키워드를 입력해주세요.', 'error');
      keyInput.focus();
      return;
    }

    var keyIndex = 0;
    var result = Array.from(input.value).map(function (character) {
      if (!/[A-Za-z]/.test(character)) return character;
      var base = character >= 'a' && character <= 'z' ? 97 : 65;
      var shift = key.charCodeAt(keyIndex % key.length) - 65;
      keyIndex += 1;
      if (decrypt) shift = -shift;
      return String.fromCharCode(((character.charCodeAt(0) - base + shift + 26) % 26) + base);
    }).join('');
    document.getElementById('keywordOutput').value = result;
    showStatus('keywordStatus', decrypt ? '키워드 복호화가 완료되었습니다.' : '키워드 암호화가 완료되었습니다.', 'success');
  }

  function processSubstitution(decrypt) {
    var input = document.getElementById('substitutionInput');
    if (!input.value) {
      showStatus('substitutionStatus', decrypt ? '복호화할 내용을 입력해주세요.' : '암호화할 내용을 입력해주세요.', 'error');
      input.focus();
      return;
    }
    try {
      var maps = parseSubstitutionMap(document.getElementById('substitutionMap').value, document.getElementById('applyLowercase').checked);
      var selectedMap = decrypt ? maps.reverse : maps.forward;
      document.getElementById('substitutionOutput').value = Array.from(input.value).map(function (character) {
        return selectedMap.has(character) ? selectedMap.get(character) : character;
      }).join('');
      showStatus('substitutionStatus', decrypt ? '대응표를 반대로 적용해 복호화했습니다.' : '대응표로 문자를 치환했습니다.', 'success');
    } catch (error) {
      document.getElementById('substitutionOutput').value = '';
      showStatus('substitutionStatus', error.message, 'error');
    }
  }

  function parseSubstitutionMap(value, applyLowercase) {
    var lines = value.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
    if (!lines.length) throw new Error('A=T 또는 G→H 형식으로 문자 대응표를 입력해주세요.');
    var forward = new Map();
    var reverse = new Map();

    lines.forEach(function (line, index) {
      var match = line.match(/^(.+?)\s*(?:=|→|>|:)\s*(.+)$/u);
      if (!match) throw new Error((index + 1) + '번째 줄의 형식을 확인해주세요. 예: A=T');
      var fromChars = Array.from(match[1].trim());
      var toChars = Array.from(match[2].trim());
      if (fromChars.length !== 1 || toChars.length !== 1) throw new Error((index + 1) + '번째 줄은 양쪽에 문자 하나씩만 입력해주세요.');
      addMapping(forward, reverse, fromChars[0], toChars[0], index + 1);
      if (applyLowercase && /^[A-Z]$/.test(fromChars[0]) && /^[A-Z]$/.test(toChars[0])) {
        addMapping(forward, reverse, fromChars[0].toLowerCase(), toChars[0].toLowerCase(), index + 1);
      }
    });
    return { forward: forward, reverse: reverse };
  }

  function addMapping(forward, reverse, from, to, lineNumber) {
    if (forward.has(from)) throw new Error(lineNumber + '번째 줄: 원본 문자 ' + from + '가 이미 사용되었습니다.');
    if (reverse.has(to)) throw new Error(lineNumber + '번째 줄: 결과 문자 ' + to + '가 이미 사용되었습니다.');
    forward.set(from, to);
    reverse.set(to, from);
  }

  function toBase64Url(bytes) {
    var binary = '';
    var chunkSize = 8192;
    for (var i = 0; i < bytes.length; i += chunkSize) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function fromBase64Url(value) {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid Base64URL');
    var base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    base64 += '='.repeat((4 - base64.length % 4) % 4);
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function copyOutput(outputId, statusId) {
    var output = document.getElementById(outputId);
    if (!output.value) {
      showStatus(statusId, '복사할 결과가 없습니다.', 'error');
      return;
    }
    var promise = navigator.clipboard && window.isSecureContext
      ? navigator.clipboard.writeText(output.value)
      : Promise.reject(new Error('Clipboard unavailable'));
    promise.then(function () {
      showStatus(statusId, '결과를 클립보드에 복사했습니다.', 'success');
    }).catch(function () {
      output.focus();
      output.select();
      document.execCommand('copy');
      showStatus(statusId, '결과를 클립보드에 복사했습니다.', 'success');
    });
  }

  function showStatus(id, message, type) {
    var element = document.getElementById(id);
    element.textContent = message;
    element.className = 'utility-status' + (type ? ' ' + type : '');
  }
});
