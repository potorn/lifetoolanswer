document.addEventListener('DOMContentLoaded', function () {
  var qrText = document.getElementById('qrText');
  var resultCard = document.getElementById('resultCard');
  var canvas = document.getElementById('qrCanvas');
  var downloadLink = document.getElementById('downloadLink');
  var encoder = new TextEncoder();

  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

  qrText.addEventListener('input', function () {
    updateByteCount();
    resultCard.classList.remove('visible');
    downloadLink.removeAttribute('href');
  });
  document.getElementById('errorLevel').addEventListener('change', hideStaleResult);
  document.getElementById('qrSize').addEventListener('change', hideStaleResult);
  document.getElementById('generateBtn').addEventListener('click', generateQr);

  function updateByteCount() {
    document.getElementById('qrByteCount').textContent = encoder.encode(qrText.value).length.toLocaleString('ko-KR');
  }

  function hideStaleResult() {
    resultCard.classList.remove('visible');
    downloadLink.removeAttribute('href');
  }

  function generateQr() {
    var text = qrText.value.trim();
    var byteLength = encoder.encode(text).length;
    if (!text) {
      alert('QR 코드에 넣을 URL 또는 텍스트를 입력해주세요.');
      qrText.focus();
      return;
    }
    if (byteLength > 1800) {
      alert('내용이 너무 깁니다. UTF-8 기준 1,800바이트 이하로 줄여주세요.');
      return;
    }

    try {
      var level = document.getElementById('errorLevel').value;
      var outputSize = Number(document.getElementById('qrSize').value);
      var qr = qrcode(0, level);
      qr.addData(text);
      qr.make();
      drawQr(qr, outputSize);

      downloadLink.href = canvas.toDataURL('image/png');
      document.getElementById('qrInfo').textContent = byteLength.toLocaleString('ko-KR') + '바이트 · 오류 복원 ' + level + ' · ' + outputSize + 'px PNG';
      resultCard.classList.add('visible');
      setTimeout(function () {
        resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    } catch (error) {
      alert('내용이 현재 오류 복원 수준에 비해 너무 깁니다. 내용을 줄이거나 복원 수준을 낮춰주세요.');
    }
  }

  function drawQr(qr, outputSize) {
    var moduleCount = qr.getModuleCount();
    var quietModules = 4;
    var totalModules = moduleCount + quietModules * 2;
    var cellSize = Math.max(1, Math.floor(outputSize / totalModules));
    var qrPixelSize = totalModules * cellSize;
    var offset = Math.floor((outputSize - qrPixelSize) / 2);
    var context = canvas.getContext('2d', { alpha: false });

    canvas.width = outputSize;
    canvas.height = outputSize;
    context.imageSmoothingEnabled = false;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, outputSize, outputSize);
    context.fillStyle = '#111827';

    for (var row = 0; row < moduleCount; row += 1) {
      for (var col = 0; col < moduleCount; col += 1) {
        if (qr.isDark(row, col)) {
          context.fillRect(
            offset + (col + quietModules) * cellSize,
            offset + (row + quietModules) * cellSize,
            cellSize,
            cellSize
          );
        }
      }
    }
  }
});
