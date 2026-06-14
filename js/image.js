'use strict';

document.addEventListener('DOMContentLoaded', function () {

  var dropZone      = document.getElementById('dropZone');
  var fileInput     = document.getElementById('fileInput');
  var sizeWarn      = document.getElementById('sizeWarn');
  var optionsGroup  = document.getElementById('optionsGroup');
  var qualityGroup  = document.getElementById('qualityGroup');
  var resizeGroup   = document.getElementById('resizeGroup');
  var convertBtn    = document.getElementById('convertBtn');
  var qualitySlider = document.getElementById('qualitySlider');
  var qualityVal    = document.getElementById('qualityVal');
  var resizeW       = document.getElementById('resizeW');
  var resizeH       = document.getElementById('resizeH');
  var keepAspect    = document.getElementById('keepAspect');
  var resultCard    = document.getElementById('resultCard');
  var previewBefore = document.getElementById('previewBefore');
  var previewAfter  = document.getElementById('previewAfter');
  var infoBefore    = document.getElementById('infoBefore');
  var infoAfter     = document.getElementById('infoAfter');
  var compressRate  = document.getElementById('compressRate');
  var downloadBtn   = document.getElementById('downloadBtn');
  var fmtBtns       = document.querySelectorAll('.img-fmt-btn');

  var currentFile = null;
  var currentImg  = null;
  var currentBlob = null;
  var currentFmt  = 'png';
  var origW = 0, origH = 0;

  // ── 클릭하여 파일 선택 ──
  dropZone.addEventListener('click', function () {
    fileInput.click();
  });

  fileInput.addEventListener('change', function () {
    if (fileInput.files[0]) loadFile(fileInput.files[0]);
  });

  // ── 드래그앤드롭 ──
  dropZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', function (e) {
    if (!dropZone.contains(e.relatedTarget)) {
      dropZone.classList.remove('drag-over');
    }
  });

  dropZone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    var file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      loadFile(file);
    }
  });

  // ── 포맷 버튼 ──
  fmtBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      fmtBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentFmt = btn.dataset.fmt;
      qualityGroup.style.display = (currentFmt === 'jpeg' || currentFmt === 'webp') ? '' : 'none';
    });
  });

  // ── 품질 슬라이더 ──
  qualitySlider.addEventListener('input', function () {
    qualityVal.textContent = qualitySlider.value + '%';
  });

  // ── 비율 유지 리사이즈 ──
  resizeW.addEventListener('input', function () {
    if (keepAspect.checked && origW && origH && resizeW.value) {
      resizeH.value = Math.round(parseInt(resizeW.value) * origH / origW) || '';
    }
  });

  resizeH.addEventListener('input', function () {
    if (keepAspect.checked && origW && origH && resizeH.value) {
      resizeW.value = Math.round(parseInt(resizeH.value) * origW / origH) || '';
    }
  });

  // ── 변환 버튼 ──
  convertBtn.addEventListener('click', function () {
    if (currentImg) doConvert();
  });

  downloadBtn.addEventListener('click', function () {
    if (currentBlob) triggerDownload(currentBlob, getFilename());
  });

  // ── 파일 로드 ──
  function loadFile(file) {
    currentFile = file;
    sizeWarn.style.display = file.size > 15 * 1024 * 1024 ? '' : 'none';

    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        currentImg = img;
        origW = img.naturalWidth;
        origH = img.naturalHeight;

        dropZone.classList.add('has-file');
        dropZone.querySelector('.img-drop-text').textContent = file.name;
        dropZone.querySelector('.img-drop-sub').textContent =
          origW + ' × ' + origH + ' · ' + formatSize(file.size);

        previewBefore.src = e.target.result;
        infoBefore.textContent = origW + ' × ' + origH + ' · ' + formatSize(file.size);

        optionsGroup.style.display = '';
        resizeGroup.style.display = '';
        convertBtn.style.display = '';
        resizeW.value = '';
        resizeH.value = '';

        resultCard.classList.remove('visible');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ── 변환 처리 ──
  function doConvert() {
    var targetW = parseInt(resizeW.value) || origW;
    var targetH = parseInt(resizeH.value) || origH;

    var canvas = document.createElement('canvas');
    canvas.width  = targetW;
    canvas.height = targetH;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(currentImg, 0, 0, targetW, targetH);

    if (currentFmt === 'tga') {
      var blob = encodeTGA(ctx.getImageData(0, 0, targetW, targetH));
      currentBlob = blob;
      showResult(blob, targetW, targetH);
      triggerDownload(blob, getFilename());
    } else {
      var mimeMap = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };
      var quality = parseInt(qualitySlider.value) / 100;
      canvas.toBlob(function (blob) {
        currentBlob = blob;
        showResult(blob, targetW, targetH);
        triggerDownload(blob, getFilename());
      }, mimeMap[currentFmt], quality);
    }
  }

  // ── 결과 표시 ──
  function showResult(blob, w, h) {
    if (previewAfter.src && previewAfter.src.startsWith('blob:')) {
      URL.revokeObjectURL(previewAfter.src);
    }

    if (currentFmt === 'tga') {
      previewAfter.src = previewBefore.src;
      infoAfter.innerHTML = w + ' × ' + h + ' · ' + formatSize(blob.size) +
        '<br><span style="font-size:0.75rem;color:#94a3b8;">TGA는 미리보기 불가</span>';
    } else {
      previewAfter.src = URL.createObjectURL(blob);
      infoAfter.textContent = w + ' × ' + h + ' · ' + formatSize(blob.size);
    }

    var rate = Math.round((1 - blob.size / currentFile.size) * 100);
    if (rate > 0) {
      compressRate.textContent = '파일 크기 ' + rate + '% 감소';
      compressRate.style.color = '#16a34a';
    } else if (rate < 0) {
      compressRate.textContent = '파일 크기 ' + Math.abs(rate) + '% 증가';
      compressRate.style.color = '#dc2626';
    } else {
      compressRate.textContent = '파일 크기 동일';
      compressRate.style.color = '#6b7280';
    }

    resultCard.classList.add('visible');
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ── TGA 인코더 (비압축 Type 2, BGRA) ──
  function encodeTGA(imageData) {
    var w = imageData.width, h = imageData.height, data = imageData.data;
    var header = new Uint8Array(18);
    header[2]  = 2;                      // 비압축 트루컬러
    header[12] = w & 0xFF; header[13] = (w >> 8) & 0xFF;
    header[14] = h & 0xFF; header[15] = (h >> 8) & 0xFF;
    header[16] = 32;                     // bits per pixel
    header[17] = 0x28;                   // origin: top-left (상하 반전 플래그)

    var pixels = new Uint8Array(w * h * 4);
    for (var i = 0; i < w * h; i++) {
      pixels[i * 4]     = data[i * 4 + 2]; // B
      pixels[i * 4 + 1] = data[i * 4 + 1]; // G
      pixels[i * 4 + 2] = data[i * 4];     // R
      pixels[i * 4 + 3] = data[i * 4 + 3]; // A
    }
    return new Blob([header, pixels], { type: 'application/octet-stream' });
  }

  // ── 헬퍼 ──
  function triggerDownload(blob, filename) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 100);
  }

  function getFilename() {
    var base = currentFile ? currentFile.name.replace(/\.[^.]+$/, '') : 'image';
    var ext = currentFmt === 'jpeg' ? 'jpg' : currentFmt;
    return base + '.' + ext;
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
});
