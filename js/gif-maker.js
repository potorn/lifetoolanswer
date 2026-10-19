import { MAX_IMAGE_DIMENSION, MAX_IMAGE_INPUT_BYTES, MAX_IMAGE_PIXELS, SUPPORTED_IMAGE_FORMATS, validateImageBuffer, validateVideoBuffer } from './file-validation.js';
import { gifCandidates, sampleGifFrames } from './gif-options.js?v=20261019-media1';

document.addEventListener('DOMContentLoaded', function () {
  var MAX_IMAGES = 30;
  var MAX_IMAGE_BYTES = MAX_IMAGE_INPUT_BYTES;
  var MAX_VIDEO_BYTES = 100 * 1024 * 1024;
  var MAX_VIDEO_SECONDS = 5 * 60;
  var MAX_GIF_BYTES = 15 * 1024 * 1024;
  var VIDEO_PROBE_TIMEOUT_MS = 20 * 1000;
  var VIDEO_CONVERT_TIMEOUT_MS = 2 * 60 * 1000;
  var tabs = document.querySelectorAll('.gif-mode-tab');
  var imagesMode = document.getElementById('imagesMode');
  var videoMode = document.getElementById('videoMode');
  var status = document.getElementById('gifStatus');
  var framesInput = document.getElementById('framesInput');
  var framesDropZone = document.getElementById('framesDropZone');
  var frameList = document.getElementById('frameList');
  var createImagesBtn = document.getElementById('createImagesGif');
  var videoInput = document.getElementById('videoInput');
  var videoDropZone = document.getElementById('videoDropZone');
  var videoInfo = document.getElementById('videoInfo');
  var createVideoBtn = document.getElementById('createVideoGif');
  var cancelVideoBtn = document.getElementById('cancelVideoGif');
  var gifResultCard = document.getElementById('gifResultCard');
  var gifPreview = document.getElementById('gifPreview');
  var gifResultInfo = document.getElementById('gifResultInfo');
  var gifDownloadBtn = document.getElementById('gifDownloadBtn');
  var imageWorker = new Worker('../js/image-worker.js?v=20261019-media1', { type: 'module' });
  var pendingImage = null, encoding = false, variantUrls = [];
  function lockEncoding(value) {
    encoding = value;
    document.querySelectorAll('.gif-maker-card input, .gif-maker-card select, .gif-maker-card button').forEach(function (el) { if (el !== cancelVideoBtn) el.disabled = value; });
    if (!value) { createImagesBtn.disabled = imageFrames.length < 2; createVideoBtn.disabled = !videoFile; }
  }
  function clearVariants() {
    variantUrls.forEach(function (url) { URL.revokeObjectURL(url); }); variantUrls = [];
    document.getElementById('gifVariants').replaceChildren();
    gifResultCard.classList.remove('visible'); resultBlob = null;
  }
  function addVariant(blob, detail, target, filename) {
    var item = document.createElement('div'); item.className = 'media-variant';
    var title = document.createElement('p'); title.textContent = detail + ' · ' + formatSize(blob.size) + (target ? (blob.size <= target ? ' · 목표 이내' : ' · 목표 초과') : ''); item.appendChild(title);
    if (blob.size <= MAX_GIF_BYTES) {
      var url = URL.createObjectURL(blob); variantUrls.push(url);
      var img = document.createElement('img'); img.src = url; img.alt = detail + ' GIF 화질 비교'; item.appendChild(img);
      var button = document.createElement('button'); button.type = 'button'; button.textContent = '이 결과 선택';
      button.addEventListener('click', function () { showResult(blob, filename, detail); }); item.appendChild(button);
    } else { var note = document.createElement('p'); note.textContent = '15MB 초과: 미리보기·저장 제외'; item.appendChild(note); }
    document.getElementById('gifVariants').appendChild(item);
  }
  var imageFrames = [];
  var videoFile = null;
  var videoLength = 0;
  var videoWidth = 0;
  var videoHeight = 0;
  var resultBlob = null;
  var resultName = 'my-gif.gif';
  var resultUrl = null;
  var imageRequest = 0;
  var videoRequest = 0;
  var ffmpeg = null;
  var videoCancelled = false;
  var dragIndex = null;

  function setStatus(message, type) {
    status.textContent = message || '';
    status.className = 'img-status' + (type ? ' ' + type : '');
    status.style.display = message ? '' : 'none';
  }

  function setMode(mode) {
    tabs.forEach(function (tab) {
      var active = tab.dataset.mode === mode;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    imagesMode.style.display = mode === 'images' ? '' : 'none';
    videoMode.style.display = mode === 'video' ? '' : 'none';
    setStatus('');
  }

  tabs.forEach(function (tab) { tab.addEventListener('click', function () { setMode(tab.dataset.mode); }); });
  framesDropZone.addEventListener('click', function () { framesInput.click(); });
  videoDropZone.addEventListener('click', function () { videoInput.click(); });
  framesInput.addEventListener('change', function () { addFrames(Array.prototype.slice.call(framesInput.files)); framesInput.value = ''; });
  videoInput.addEventListener('change', function () { if (videoInput.files[0]) loadVideo(videoInput.files[0]); });
  bindDropZone(framesDropZone, function (files) { addFrames(files); });
  bindDropZone(videoDropZone, function (files) { if (files[0]) loadVideo(files[0]); });

  function bindDropZone(zone, callback) {
    zone.addEventListener('dragover', function (event) { event.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', function (event) { if (!zone.contains(event.relatedTarget)) zone.classList.remove('drag-over'); });
    zone.addEventListener('drop', function (event) { event.preventDefault(); zone.classList.remove('drag-over'); callback(Array.prototype.slice.call(event.dataTransfer.files)); });
  }

  async function addFrames(files) {
    if (encoding) return;
    var valid = [];
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      try {
        // The worker re-checks the complete file before decoding. Looking at
        // only the signature here avoids duplicating every selected image in
        // page memory while the user is arranging frames.
        var validation = validateImageBuffer(await file.slice(0, 64).arrayBuffer(), file.name, SUPPORTED_IMAGE_FORMATS);
        if (validation.ok) valid.push(file);
      } catch (error) {
        // Invalid files are reported below and never receive a Blob URL.
      }
    }
    if (!valid.length) return setStatus('PNG, JPG, WebP, BMP, ICO, AVIF 정지 이미지만 추가할 수 있습니다.', 'error');
    if (encoding) return;
    var bytes = imageFrames.reduce(function (sum, frame) { return sum + frame.file.size; }, 0) + valid.reduce(function (sum, file) { return sum + file.size; }, 0);
    if (imageFrames.length + valid.length > MAX_IMAGES) return setStatus('사진은 최대 ' + MAX_IMAGES + '장까지 넣을 수 있습니다.', 'error');
    if (bytes > MAX_IMAGE_BYTES) return setStatus('사진 전체 용량은 최대 25MB입니다.', 'error');
    imageFrames = imageFrames.concat(valid.map(function (file) { return { file: file, url: URL.createObjectURL(file) }; }));
    renderFrames();
    setStatus(imageFrames.length + '장의 사진을 추가했습니다. 드래그해서 순서를 바꿀 수 있습니다.', 'success');
  }

  function renderFrames() {
    frameList.innerHTML = '';
    imageFrames.forEach(function (frame, index) {
      var item = document.createElement('div');
      item.className = 'gif-frame-item';
      item.draggable = true;
      item.dataset.index = index;
      var thumb = document.createElement('img'); thumb.src = frame.url; thumb.alt = (index + 1) + '번째 사진';
      var text = document.createElement('span'); text.className = 'gif-frame-name'; text.textContent = (index + 1) + '. ' + frame.file.name;
      var remove = document.createElement('button'); remove.type = 'button'; remove.className = 'gif-frame-remove'; remove.textContent = '삭제';
      remove.addEventListener('click', function () { URL.revokeObjectURL(frame.url); imageFrames.splice(index, 1); renderFrames(); });
      item.appendChild(thumb); item.appendChild(text); item.appendChild(remove);
      item.addEventListener('dragstart', function (event) { if (encoding) { event.preventDefault(); return; } dragIndex = index; item.classList.add('dragging'); });
      item.addEventListener('dragend', function () { dragIndex = null; item.classList.remove('dragging'); });
      item.addEventListener('dragover', function (event) { event.preventDefault(); });
      item.addEventListener('drop', function (event) {
        event.preventDefault();
        if (encoding) return;
        if (dragIndex === null || dragIndex === index) return;
        var moved = imageFrames.splice(dragIndex, 1)[0];
        imageFrames.splice(index, 0, moved);
        renderFrames();
      });
      frameList.appendChild(item);
    });
    createImagesBtn.disabled = encoding || imageFrames.length < 2;
  }

  function imageResponse(event) {
    var data = event.data;
    if (data.id !== imageRequest) return;
    if (!pendingImage) return;
    var pending = pendingImage; pendingImage = null; clearTimeout(pending.timer);
    if (!data.ok) pending.reject(new Error(data.error || 'GIF를 만들지 못했습니다.'));
    else pending.resolve(data);
  }
  imageWorker.addEventListener('message', imageResponse);

  createImagesBtn.addEventListener('click', async function () {
    if (encoding || imageFrames.length < 2) return;
    var width = Number(document.getElementById('imageWidth').value), delay = Number(document.getElementById('imageDelay').value), loop = document.getElementById('imageLoop').checked;
    var target = Number(document.getElementById('gifTarget').value), candidates = gifCandidates(width, 10, target), best = null, bestDetail = '';
    lockEncoding(true); clearVariants();
    try {
      for (var i = 0; i < candidates.length; i++) {
        setStatus('사진 GIF 용량 확인 중… ' + (i + 1) + '/' + candidates.length + '단계');
        var sampled = sampleGifFrames(imageFrames.slice(), candidates[i].frameScale, delay);
        var buffers = await Promise.all(sampled.selected.map(function (f) { return f.file.arrayBuffer(); }));
        imageRequest++;
        var data;
        try {
          data = await new Promise(function (resolve, reject) {
            pendingImage = { resolve: resolve, reject: reject, timer: setTimeout(function () {
              imageWorker.terminate(); imageWorker = new Worker('../js/image-worker.js?v=20261019-media1', { type: 'module' });
              // Reattach the registered response handler after a timed-out engine.
              imageWorker.addEventListener('message', imageResponse); pendingImage = null; reject(new Error('GIF 처리 시간이 초과되었습니다. 크기를 줄여 주세요.'));
            }, 90000) };
            imageWorker.postMessage({ id: imageRequest, action: 'makeGif', files: buffers, fileNames: sampled.selected.map(function (f) { return f.file.name; }), width: candidates[i].width, delay: delay, delays: sampled.delays, loop: loop }, buffers);
          });
        } catch (error) { if (i === candidates.length - 1 && !best) throw error; continue; }
        var blob = new Blob([data.bytes], { type: 'image/gif' }), detail = data.frames + '프레임 · ' + data.width + ' × ' + data.height + ' · ' + (imageFrames.length * delay / 1000).toFixed(2) + '초';
        addVariant(blob, detail, target, 'photos-gif.gif');
        if (!best || blob.size < best.size) { best = blob; bestDetail = detail; }
        if (target && blob.size <= target) break;
      }
      if (!best || best.size > MAX_GIF_BYTES) throw new Error('15MB 이하 결과를 만들지 못했습니다. 사진 수·크기를 줄여 주세요.');
      showResult(best, 'photos-gif.gif', bestDetail);
      setStatus(target ? (best.size <= target ? '목표 용량 이내로 만들었습니다. 아래에서 화질을 비교하고 저장하세요.' : '목표 용량을 초과했습니다. 가장 작은 결과를 선택했습니다. 사진 수나 크기를 더 줄여 주세요.') : 'GIF를 만들었습니다.', target && best.size > target ? 'error' : 'success');
    } catch (error) { setStatus(error.message || '사진 GIF 생성에 실패했습니다.', 'error'); }
    finally { lockEncoding(false); }
  });

  async function loadVideo(file) {
    if (encoding) return;
    if (file.size > MAX_VIDEO_BYTES) return setStatus('동영상은 최대 100MB까지 넣을 수 있습니다.', 'error');
    var currentVideoRequest = ++videoRequest;
    try {
      // ffprobe reads the full local file below. Do not keep a second 100 MB
      // ArrayBuffer in the page merely to identify the container.
      var validation = validateVideoBuffer(await file.slice(0, 64).arrayBuffer(), file.name);
      if (currentVideoRequest !== videoRequest || encoding) return;
      if (!validation.ok) return setStatus(validation.error, 'error');
    } catch (error) {
      return setStatus('동영상 파일을 읽지 못했습니다.', 'error');
    }
    lockEncoding(true);
    videoFile = null;
    videoLength = 0;
    videoWidth = 0;
    videoHeight = 0;
    videoCancelled = false;
    createVideoBtn.disabled = true;
    cancelVideoBtn.style.display = '';
    videoDropZone.classList.add('has-file');
    videoDropZone.querySelector('.img-drop-text').textContent = file.name;
    videoDropZone.querySelector('.img-drop-sub').textContent = '동영상 길이를 확인하는 중…';
    setStatus('브라우저 안에서 동영상 정보를 확인하는 중입니다.');
    try {
      var metadata = await probeVideo(file);
      if (currentVideoRequest !== videoRequest || videoCancelled) return;
      var durationSeconds = metadata.duration;
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > MAX_VIDEO_SECONDS) {
        return setStatus('원본 동영상은 5분 이하만 지원합니다.', 'error');
      }
      if (!Number.isInteger(metadata.width) || !Number.isInteger(metadata.height) ||
          metadata.width < 1 || metadata.height < 1 ||
          metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION ||
          metadata.width * metadata.height > MAX_IMAGE_PIXELS) {
        return setStatus('원본 동영상은 최대 4,096px, 1,600만 픽셀까지 지원합니다.', 'error');
      }
      videoFile = file;
      videoLength = durationSeconds;
      videoWidth = metadata.width;
      videoHeight = metadata.height;
      var duration = Math.min(15, Math.max(0.1, videoLength));
      document.getElementById('videoStart').max = Math.max(0, videoLength - 0.1);
      document.getElementById('videoDuration').value = duration.toFixed(1);
      document.getElementById('videoDuration').max = duration;
      videoDropZone.querySelector('.img-drop-sub').textContent = formatSize(file.size) + ' · ' + videoWidth + ' × ' + videoHeight + ' · ' + videoLength.toFixed(1) + '초';
      videoInfo.textContent = '원본 ' + videoWidth + ' × ' + videoHeight + ' · ' + videoLength.toFixed(1) + '초 · 최대 15초 구간을 GIF로 만들 수 있습니다.';
      videoInfo.style.display = '';
      createVideoBtn.disabled = false;
      setStatus('동영상을 불러왔습니다.', 'success');
    } catch (error) {
      if (currentVideoRequest !== videoRequest) return;
      videoFile = null;
      console.warn('GIF video metadata:', error);
      setStatus(videoCancelled ? '동영상 처리를 취소했습니다.' : '동영상 정보를 읽지 못했습니다. 지원되는 코덱의 짧은 MP4·WebM·MOV 파일인지 확인해 주세요.', videoCancelled ? '' : 'error');
    } finally {
      cancelVideoBtn.style.display = 'none'; lockEncoding(false);
    }
  }

  async function probeVideo(file) {
    var instance = await getFfmpeg();
    var inputName = makeVideoInputName(file, 'probe');
    var output = [];
    function onLog(event) {
      output.push(event.message.trim());
    }
    instance.on('log', onLog);
    try {
      await instance.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));
      var exitCode = await instance.ffprobe([
        '-v', 'error',
        '-probesize', '10000000',
        '-analyzeduration', '5000000',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height:format=duration',
        '-of', 'default=noprint_wrappers=1',
        inputName
      ], VIDEO_PROBE_TIMEOUT_MS);
      // The bundled core's ffprobe wrapper ignores _ffprobe's normal return
      // and can leave ret at its -1 sentinel even with complete metadata.
      // Accept that sentinel only when all required output values validate below.
      if (exitCode !== 0 && exitCode !== -1) throw new Error('probe failed or timed out');
      var metadata = {};
      output.join('\n').split(/\r?\n/).forEach(function (line) {
        var separator = line.indexOf('=');
        if (separator > 0) metadata[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
      });
      var result = {
        duration: Number(metadata.duration),
        width: Number(metadata.width),
        height: Number(metadata.height)
      };
      if (!Number.isFinite(result.duration) || !Number.isInteger(result.width) || !Number.isInteger(result.height)) {
        throw new Error('video metadata not found');
      }
      return result;
    } finally {
      instance.off('log', onLog);
      try { await instance.deleteFile(inputName); } catch (error) { /* The file may not have been created. */ }
    }
  }

  function makeVideoInputName(file, prefix) {
    var extension = (file.name.split('.').pop() || 'mp4').replace(/[^a-z0-9]/gi, '').toLowerCase();
    return prefix + '-input.' + extension;
  }

  createVideoBtn.addEventListener('click', async function () {
    if (encoding || !videoFile) return;
    var start = Math.max(0, Number(document.getElementById('videoStart').value) || 0);
    var duration = Math.min(15, Number(document.getElementById('videoDuration').value) || 15, videoLength - start);
    if (duration <= 0) return setStatus('시작 지점과 GIF 길이를 확인해 주세요.', 'error');
    var requestedWidth = Number(document.getElementById('videoWidth').value), target = Number(document.getElementById('gifTarget').value);
    var candidates = gifCandidates(requestedWidth, 10, target), best = null, bestDetail = '', currentJob = ++videoRequest;
    lockEncoding(true); clearVariants();
    createVideoBtn.disabled = true;
    cancelVideoBtn.style.display = '';
    videoCancelled = false;
    setStatus('동영상 변환 엔진을 준비하는 중입니다. 처음 한 번은 시간이 걸릴 수 있습니다.');
    var instance;
    var inputName;
    try {
      instance = await getFfmpeg();
      if (videoCancelled) return;
      inputName = makeVideoInputName(videoFile, 'convert');
      await instance.writeFile(inputName, new Uint8Array(await videoFile.arrayBuffer()));
      if (requestedWidth !== 480 && requestedWidth !== 720) throw new Error('invalid output width');
      for (var pass = 0; pass < candidates.length; pass++) {
        var width = candidates[pass].width, fps = candidates[pass].fps;
        var filter = 'fps=' + fps + ',scale=' + width + ':' + width + ':force_original_aspect_ratio=decrease:flags=lanczos';
        setStatus('GIF 색상표를 만드는 중… ' + (pass + 1) + '/' + candidates.length + '단계');
        var paletteExit = await instance.exec(['-ss', String(start), '-t', String(duration), '-i', inputName, '-vf', filter + ',palettegen=stats_mode=diff', '-y', 'palette.png'], VIDEO_CONVERT_TIMEOUT_MS);
        if (paletteExit !== 0) throw new Error('palette generation failed or timed out');
        if (videoCancelled || currentJob !== videoRequest) return;
        setStatus('GIF를 생성하는 중…');
        var gifExit = await instance.exec(['-ss', String(start), '-t', String(duration), '-i', inputName, '-i', 'palette.png', '-lavfi', filter + '[x];[x][1:v]paletteuse', '-loop', '0', '-an', '-y', 'output.gif'], VIDEO_CONVERT_TIMEOUT_MS);
        if (gifExit !== 0) throw new Error('GIF generation failed or timed out');
        if (videoCancelled || currentJob !== videoRequest) return;
        var data = await instance.readFile('output.gif');
        var blob = new Blob([data], { type: 'image/gif' });
        var detail = duration.toFixed(1) + '초 · 최대 ' + width + 'px · ' + fps + 'fps';
        addVariant(blob, detail, target, videoFile.name.replace(/\.[^.]+$/, '') + '.gif');
        if (!best || blob.size < best.size) { best = blob; bestDetail = detail; }
        if (target && blob.size <= target) break;
      }
      if (!best || best.size > MAX_GIF_BYTES) return setStatus('15MB 이하 결과를 만들지 못했습니다. GIF 길이를 줄여 주세요.', 'error');
      showResult(best, videoFile.name.replace(/\.[^.]+$/, '') + '.gif', bestDetail);
      setStatus(target ? (best.size <= target ? '목표 용량 이내로 만들었습니다. 화질을 비교하고 저장하세요.' : '목표 용량을 초과했습니다. 가장 작은 결과를 선택했습니다. 길이를 더 줄여 주세요.') : '동영상 GIF를 만들었습니다.', target && best.size > target ? 'error' : 'success');
    } catch (error) {
      console.warn('GIF video conversion:', error);
      if (!videoCancelled) setStatus('동영상 변환에 실패했습니다. 지원되는 코덱의 짧은 MP4·WebM·MOV 파일인지 확인해 주세요.', 'error');
    } finally {
      if (instance && ffmpeg === instance) {
        var temporaryFiles = [inputName, 'palette.png', 'output.gif'].filter(Boolean);
        for (var i = 0; i < temporaryFiles.length; i++) {
          try { await instance.deleteFile(temporaryFiles[i]); } catch (error) { /* The file may not have been created. */ }
        }
      }
      createVideoBtn.disabled = !videoFile;
      cancelVideoBtn.style.display = 'none';
      lockEncoding(false);
    }
  });

  cancelVideoBtn.addEventListener('click', function () {
    videoCancelled = true;
    videoRequest += 1;
    if (ffmpeg) { ffmpeg.terminate(); ffmpeg = null; }
    setStatus('동영상 처리를 취소했습니다.');
    createVideoBtn.disabled = !videoFile;
    cancelVideoBtn.style.display = 'none';
  });

  async function getFfmpeg() {
    if (ffmpeg && ffmpeg.loaded) return ffmpeg;
    if (!window.FFmpegWASM) await loadScript('../vendor/ffmpeg/ffmpeg.js');
    ffmpeg = new window.FFmpegWASM.FFmpeg();
    ffmpeg.on('progress', function (event) {
      if (!videoCancelled && event.progress) setStatus('동영상 GIF를 만드는 중… ' + Math.min(99, Math.round(event.progress * 100)) + '%');
    });
    await ffmpeg.load({
      coreURL: new URL('../vendor/ffmpeg/ffmpeg-core.js', window.location.href).href,
      wasmURL: new URL('../vendor/ffmpeg/ffmpeg-core.wasm.gz', window.location.href).href
    });
    return ffmpeg;
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src; script.onload = resolve; script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function showResult(blob, filename, detail) {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultBlob = blob;
    resultName = filename;
    resultUrl = URL.createObjectURL(blob);
    gifPreview.src = resultUrl;
    gifResultInfo.textContent = detail + ' · ' + formatSize(blob.size);
    gifResultCard.classList.add('visible');
    gifResultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  gifDownloadBtn.addEventListener('click', function () {
    if (!resultBlob) return;
    var url = URL.createObjectURL(resultBlob);
    var anchor = document.createElement('a'); anchor.href = url; anchor.download = resultName; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  window.addEventListener('beforeunload', function () {
    variantUrls.forEach(function (url) { URL.revokeObjectURL(url); });
    imageWorker.terminate();
    imageFrames.forEach(function (frame) { URL.revokeObjectURL(frame.url); });
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    if (ffmpeg) ffmpeg.terminate();
  });

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
});
