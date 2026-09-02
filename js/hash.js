document.addEventListener('DOMContentLoaded', function () {
  var input = document.getElementById('hashInput');
  var status = document.getElementById('hashStatus');
  var resultCard = document.getElementById('hashResultCard');
  var generateBtn = document.getElementById('generateHashBtn');
  var encoder = new TextEncoder();

  input.addEventListener('input', function () {
    resultCard.classList.remove('visible');
    showStatus('', '');
  });
  generateBtn.addEventListener('click', generateHashes);
  document.querySelectorAll('.hash-copy').forEach(function (button) {
    button.addEventListener('click', function () {
      copyResult(document.getElementById(button.dataset.target));
    });
  });

  async function generateHashes() {
    if (!input.value) {
      showStatus('해시로 변환할 텍스트를 입력해주세요.', 'error');
      input.focus();
      return;
    }
    if (!window.crypto || !window.crypto.subtle) {
      showStatus('현재 브라우저에서는 보안 해시 기능을 사용할 수 없습니다. 최신 브라우저에서 다시 시도해주세요.', 'error');
      return;
    }

    generateBtn.disabled = true;
    generateBtn.textContent = '해시 생성 중...';
    try {
      var data = encoder.encode(input.value);
      var results = await Promise.all([
        window.crypto.subtle.digest('SHA-256', data),
        window.crypto.subtle.digest('SHA-512', data)
      ]);
      document.getElementById('sha256Output').value = toHex(results[0]);
      document.getElementById('sha512Output').value = toHex(results[1]);
      resultCard.classList.add('visible');
      showStatus('SHA-256과 SHA-512 해시를 생성했습니다.', 'success');
    } catch (error) {
      resultCard.classList.remove('visible');
      showStatus('해시를 생성하지 못했습니다. 잠시 후 다시 시도해주세요.', 'error');
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = 'SHA 해시 2종 생성';
    }
  }

  function toHex(buffer) {
    return Array.from(new Uint8Array(buffer)).map(function (byte) {
      return byte.toString(16).padStart(2, '0');
    }).join('');
  }

  function copyResult(element) {
    if (!element.value) return;
    var promise = navigator.clipboard && window.isSecureContext
      ? navigator.clipboard.writeText(element.value)
      : Promise.reject(new Error('Clipboard unavailable'));
    promise.then(function () {
      showStatus(element.id === 'sha256Output' ? 'SHA-256 값을 복사했습니다.' : 'SHA-512 값을 복사했습니다.', 'success');
    }).catch(function () {
      element.focus();
      element.select();
      document.execCommand('copy');
      showStatus('해시값을 복사했습니다.', 'success');
    });
  }

  function showStatus(message, type) {
    status.textContent = message;
    status.className = 'utility-status' + (type ? ' ' + type : '');
  }
});
