import { MAX_IMAGE_DIMENSION, MAX_IMAGE_INPUT_BYTES, MAX_IMAGE_PIXELS, validateImageBuffer } from './file-validation.js';

document.addEventListener('DOMContentLoaded', function () {
  var dropZone = document.getElementById('dropZone');
  var fileInput = document.getElementById('fileInput');
  var optionsGroup = document.getElementById('optionsGroup');
  var qualityGroup = document.getElementById('qualityGroup');
  var resizeGroup = document.getElementById('resizeGroup');
  var animationNote = document.getElementById('animationNote');
  var status = document.getElementById('imageStatus');
  var convertBtn = document.getElementById('convertBtn');
  var qualitySlider = document.getElementById('qualitySlider');
  var qualityVal = document.getElementById('qualityVal');
  var resizeW = document.getElementById('resizeW');
  var resizeH = document.getElementById('resizeH');
  var keepAspect = document.getElementById('keepAspect');
  var resultCard = document.getElementById('resultCard');
  var previewBefore = document.getElementById('previewBefore');
  var previewAfter = document.getElementById('previewAfter');
  var infoBefore = document.getElementById('infoBefore');
  var infoAfter = document.getElementById('infoAfter');
  var compressRate = document.getElementById('compressRate');
  var downloadBtn = document.getElementById('downloadBtn');
  var fmtBtns = document.querySelectorAll('.img-fmt-btn');
  var worker = new Worker('../js/image-worker.js', { type: 'module' });
  var currentFile = null;
  var currentBlob = null;
  var currentFmt = 'png';
  var origW = 0;
  var origH = 0;
  var sourceFrames = 1;
  var requestId = 0;
  var objectUrls = [];

  function setStatus(message, type) {
    status.textContent = message || '';
    status.className = 'img-status' + (type ? ' ' + type : '');
    status.style.display = message ? '' : 'none';
  }

  function addObjectUrl(blob) {
    var url = URL.createObjectURL(blob);
    objectUrls.push(url);
    return url;
  }

  function revokeObjectUrls() {
    objectUrls.forEach(function (url) { URL.revokeObjectURL(url); });
    objectUrls = [];
  }

  function updateAnimationNote() {
    if (!currentFile || sourceFrames < 2) {
      animationNote.style.display = 'none';
      return;
    }
    var preservesAnimation = currentFmt === 'gif' || currentFmt === 'webp';
    animationNote.textContent = preservesAnimation
      ? '움짤입니다. GIF와 WebP로 변환하면 모든 프레임과 재생 시간을 유지합니다.'
      : '움짤을 ' + currentFmt.toUpperCase() + '로 변환하면 첫 프레임만 정지 이미지로 저장됩니다.';
    animationNote.className = 'img-animation-note' + (preservesAnimation ? ' success' : '');
    animationNote.style.display = '';
  }

  function setFormat(format) {
    currentFmt = format;
    fmtBtns.forEach(function (btn) { btn.classList.toggle('active', btn.dataset.fmt === format); });
    qualityGroup.style.display = (format === 'jpeg' || format === 'webp' || format === 'avif') ? '' : 'none';
    updateAnimationNote();
  }

  dropZone.addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function () { if (fileInput.files[0]) loadFile(fileInput.files[0]); });
  dropZone.addEventListener('dragover', function (event) { event.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', function (event) {
    if (!dropZone.contains(event.relatedTarget)) dropZone.classList.remove('drag-over');
  });
  dropZone.addEventListener('drop', function (event) {
    event.preventDefault();
    dropZone.classList.remove('drag-over');
    if (event.dataTransfer.files[0]) loadFile(event.dataTransfer.files[0]);
  });

  fmtBtns.forEach(function (btn) {
    btn.addEventListener('click', function () { setFormat(btn.dataset.fmt); });
  });
  qualitySlider.addEventListener('input', function () { qualityVal.textContent = qualitySlider.value + '%'; });
  resizeW.addEventListener('input', function () {
    if (keepAspect.checked && origW && origH && resizeW.value) resizeH.value = Math.round(Number(resizeW.value) * origH / origW) || '';
  });
  resizeH.addEventListener('input', function () {
    if (keepAspect.checked && origW && origH && resizeH.value) resizeW.value = Math.round(Number(resizeH.value) * origW / origH) || '';
  });

  worker.addEventListener('message', function (event) {
    var data = event.data;
    if (data.id !== requestId) return;
    if (!data.ok) {
      setStatus(data.error || '이미지를 처리하지 못했습니다. 다른 파일을 선택해 주세요.', 'error');
      convertBtn.disabled = false;
      return;
    }
    if (data.action === 'inspect') {
      origW = data.width;
      origH = data.height;
      sourceFrames = data.frames;
      var previewUrl = addObjectUrl(currentFile);
      previewBefore.src = previewUrl;
      previewBefore.onerror = function () { previewBefore.removeAttribute('src'); };
      optionsGroup.style.display = '';
      resizeGroup.style.display = '';
      convertBtn.style.display = '';
      resizeW.value = '';
      resizeH.value = '';
      infoBefore.textContent = origW + ' × ' + origH + ' · ' + formatSize(currentFile.size) + (sourceFrames > 1 ? ' · ' + sourceFrames + '프레임' : '');
      dropZone.querySelector('.img-drop-sub').textContent = infoBefore.textContent;
      updateAnimationNote();
      setStatus(sourceFrames > 1 ? '움짤 파일을 불러왔습니다.' : '이미지를 불러왔습니다.', 'success');
      return;
    }
    if (data.action === 'convert') {
      currentBlob = new Blob([data.bytes], { type: data.mime });
      showResult(data);
      convertBtn.disabled = false;
      convertBtn.textContent = '변환 & 다운로드';
      setStatus('변환이 완료되었습니다.', 'success');
      triggerDownload(currentBlob, getFilename());
    }
  });

  function loadFile(file) {
    if (file.size > MAX_IMAGE_INPUT_BYTES) {
      setStatus('이미지 파일은 최대 25MB까지 지원합니다.', 'error');
      return;
    }
    // Reserve the request ID before asynchronously reading the file, so a slow
    // first selection cannot replace a newer one when it eventually completes.
    var selectionRequest = ++requestId;
    setStatus('파일 형식을 확인하는 중입니다.');
    file.arrayBuffer().then(function (buffer) {
      if (selectionRequest !== requestId) return;
      var validation = validateImageBuffer(buffer, file.name);
      if (!validation.ok) {
        setStatus(validation.error, 'error');
        return;
      }
      revokeObjectUrls();
      currentFile = file;
      currentBlob = null;
      sourceFrames = 1;
      resultCard.classList.remove('visible');
      optionsGroup.style.display = 'none';
      resizeGroup.style.display = 'none';
      convertBtn.style.display = 'none';
      animationNote.style.display = 'none';
      dropZone.classList.add('has-file');
      dropZone.querySelector('.img-drop-text').textContent = file.name;
      dropZone.querySelector('.img-drop-sub').textContent = '파일 정보를 확인하는 중…';
      previewBefore.removeAttribute('src');
      previewAfter.removeAttribute('src');
      worker.postMessage({ id: selectionRequest, action: 'inspect', bytes: buffer, fileName: file.name }, [buffer]);
    }).catch(function () { setStatus('파일을 읽지 못했습니다.', 'error'); });
  }

  convertBtn.addEventListener('click', function () {
    if (!currentFile) return;
    var targetW = Number(resizeW.value) || origW;
    var targetH = Number(resizeH.value) || origH;
    if (targetW < 1 || targetH < 1 || targetW > MAX_IMAGE_DIMENSION || targetH > MAX_IMAGE_DIMENSION || targetW * targetH > MAX_IMAGE_PIXELS) {
      setStatus('출력은 최대 4,096px, 1,600만 픽셀까지 지원합니다.', 'error');
      return;
    }
    convertBtn.disabled = true;
    convertBtn.textContent = '변환 중…';
    setStatus('브라우저에서 변환 중입니다. 파일은 서버로 전송되지 않습니다.');
    requestId += 1;
    currentFile.arrayBuffer().then(function (buffer) {
      worker.postMessage({
        id: requestId,
        action: 'convert',
        bytes: buffer,
        fileName: currentFile.name,
        format: currentFmt,
        width: targetW,
        height: targetH,
        quality: Number(qualitySlider.value),
        preserveAnimation: sourceFrames > 1 && (currentFmt === 'gif' || currentFmt === 'webp')
      }, [buffer]);
    }).catch(function () { setStatus('파일을 읽지 못했습니다.', 'error'); convertBtn.disabled = false; });
  });

  downloadBtn.addEventListener('click', function () { if (currentBlob) triggerDownload(currentBlob, getFilename()); });
  window.addEventListener('beforeunload', function () { revokeObjectUrls(); worker.terminate(); });

  function showResult(data) {
    var outputUrl = addObjectUrl(currentBlob);
    previewAfter.src = outputUrl;
    previewAfter.onerror = function () { previewAfter.removeAttribute('src'); };
    var animationText = data.sourceFrames > 1
      ? (data.preservedAnimation ? ' · 움짤 보존' : ' · 첫 프레임 저장')
      : '';
    infoAfter.textContent = data.width + ' × ' + data.height + ' · ' + formatSize(currentBlob.size) + animationText;
    var rate = Math.round((1 - currentBlob.size / currentFile.size) * 100);
    compressRate.textContent = rate > 0 ? '파일 크기 ' + rate + '% 감소' : rate < 0 ? '파일 크기 ' + Math.abs(rate) + '% 증가' : '파일 크기 동일';
    compressRate.style.color = rate > 0 ? '#16a34a' : rate < 0 ? '#dc2626' : '#6b7280';
    resultCard.classList.add('visible');
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function triggerDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function getFilename() {
    var base = currentFile ? currentFile.name.replace(/\.[^.]+$/, '') : 'image';
    return base + '.' + (currentFmt === 'jpeg' ? 'jpg' : currentFmt);
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
});
