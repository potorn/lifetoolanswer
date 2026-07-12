import { MAX_IMAGE_INPUT_BYTES, SUPPORTED_IMAGE_FORMATS, validateImageBuffer, validateVideoBuffer } from './file-validation.js';

document.addEventListener('DOMContentLoaded', function () {
  var MAX_IMAGES = 30;
  var MAX_IMAGE_BYTES = MAX_IMAGE_INPUT_BYTES;
  var MAX_VIDEO_BYTES = 100 * 1024 * 1024;
  var MAX_VIDEO_SECONDS = 5 * 60;
  var MAX_GIF_BYTES = 15 * 1024 * 1024;
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
  var imageWorker = new Worker('../js/image-worker.js', { type: 'module' });
  var imageFrames = [];
  var videoFile = null;
  var videoLength = 0;
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
      item.addEventListener('dragstart', function () { dragIndex = index; item.classList.add('dragging'); });
      item.addEventListener('dragend', function () { dragIndex = null; item.classList.remove('dragging'); });
      item.addEventListener('dragover', function (event) { event.preventDefault(); });
      item.addEventListener('drop', function (event) {
        event.preventDefault();
        if (dragIndex === null || dragIndex === index) return;
        var moved = imageFrames.splice(dragIndex, 1)[0];
        imageFrames.splice(index, 0, moved);
        renderFrames();
      });
      frameList.appendChild(item);
    });
    createImagesBtn.disabled = imageFrames.length < 2;
  }

  imageWorker.addEventListener('message', function (event) {
    var data = event.data;
    if (data.id !== imageRequest) return;
    createImagesBtn.disabled = imageFrames.length < 2;
    if (!data.ok) return setStatus(data.error || 'GIF를 만들지 못했습니다.', 'error');
    var blob = new Blob([data.bytes], { type: 'image/gif' });
    if (blob.size > MAX_GIF_BYTES) return setStatus('결과 GIF가 15MB를 넘었습니다. 사진 수나 출력 크기를 줄여 주세요.', 'error');
    showResult(blob, 'photos-gif.gif', data.frames + '프레임 · ' + data.width + ' × ' + data.height);
    setStatus('GIF를 만들었습니다.', 'success');
  });

  createImagesBtn.addEventListener('click', function () {
    if (imageFrames.length < 2) return;
    createImagesBtn.disabled = true;
    setStatus('사진을 GIF로 만드는 중입니다. 파일은 서버로 전송되지 않습니다.');
    var width = Number(document.getElementById('imageWidth').value);
    Promise.all(imageFrames.map(function (frame) { return frame.file.arrayBuffer(); })).then(function (buffers) {
      imageRequest += 1;
      imageWorker.postMessage({ id: imageRequest, action: 'makeGif', files: buffers, fileNames: imageFrames.map(function (frame) { return frame.file.name; }), width: width, delay: Number(document.getElementById('imageDelay').value), loop: document.getElementById('imageLoop').checked }, buffers);
    }).catch(function () { createImagesBtn.disabled = false; setStatus('사진을 읽지 못했습니다.', 'error'); });
  });

  async function loadVideo(file) {
    if (file.size > MAX_VIDEO_BYTES) return setStatus('동영상은 최대 100MB까지 넣을 수 있습니다.', 'error');
    try {
      // ffprobe reads the full local file below. Do not keep a second 100 MB
      // ArrayBuffer in the page merely to identify the container.
      var validation = validateVideoBuffer(await file.slice(0, 64).arrayBuffer(), file.name);
      if (!validation.ok) return setStatus(validation.error, 'error');
    } catch (error) {
      return setStatus('동영상 파일을 읽지 못했습니다.', 'error');
    }
    var currentVideoRequest = ++videoRequest;
    videoFile = null;
    videoLength = 0;
    createVideoBtn.disabled = true;
    videoDropZone.classList.add('has-file');
    videoDropZone.querySelector('.img-drop-text').textContent = file.name;
    videoDropZone.querySelector('.img-drop-sub').textContent = '동영상 길이를 확인하는 중…';
    setStatus('브라우저 안에서 동영상 정보를 확인하는 중입니다.');
    try {
      var durationSeconds = await probeVideo(file);
      if (currentVideoRequest !== videoRequest) return;
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > MAX_VIDEO_SECONDS) {
        return setStatus('원본 동영상은 5분 이하만 지원합니다.', 'error');
      }
      videoFile = file;
      videoLength = durationSeconds;
      var duration = Math.min(15, Math.max(0.1, videoLength));
      document.getElementById('videoStart').max = Math.max(0, videoLength - 0.1);
      document.getElementById('videoDuration').value = duration.toFixed(1);
      document.getElementById('videoDuration').max = duration;
      videoDropZone.querySelector('.img-drop-sub').textContent = formatSize(file.size) + ' · ' + videoLength.toFixed(1) + '초';
      videoInfo.textContent = '원본 ' + videoLength.toFixed(1) + '초 · 최대 15초 구간을 GIF로 만들 수 있습니다.';
      videoInfo.style.display = '';
      createVideoBtn.disabled = false;
      setStatus('동영상을 불러왔습니다.', 'success');
    } catch (error) {
      if (currentVideoRequest !== videoRequest) return;
      videoFile = null;
      setStatus('동영상 정보를 읽지 못했습니다. 지원되는 코덱의 짧은 MP4·WebM·MOV 파일인지 확인해 주세요.', 'error');
    }
  }

  async function probeVideo(file) {
    var instance = await getFfmpeg();
    var inputName = makeVideoInputName(file, 'probe');
    var output = [];
    function onLog(event) {
      if (event.type === 'stdout') output.push(event.message.trim());
    }
    instance.on('log', onLog);
    try {
      await instance.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));
      await instance.ffprobe(['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', inputName]);
      for (var i = output.length - 1; i >= 0; i--) {
        var value = Number(output[i]);
        if (Number.isFinite(value)) return value;
      }
      throw new Error('duration not found');
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
    if (!videoFile) return;
    var start = Math.max(0, Number(document.getElementById('videoStart').value) || 0);
    var duration = Math.min(15, Number(document.getElementById('videoDuration').value) || 15, videoLength - start);
    if (duration <= 0) return setStatus('시작 지점과 GIF 길이를 확인해 주세요.', 'error');
    createVideoBtn.disabled = true;
    cancelVideoBtn.style.display = '';
    videoCancelled = false;
    setStatus('동영상 변환 엔진을 준비하는 중입니다. 처음 한 번은 시간이 걸릴 수 있습니다.');
    try {
      var instance = await getFfmpeg();
      if (videoCancelled) return;
      var inputName = makeVideoInputName(videoFile, 'convert');
      await instance.writeFile(inputName, new Uint8Array(await videoFile.arrayBuffer()));
      var width = Number(document.getElementById('videoWidth').value);
      var filter = 'fps=10,scale=' + width + ':-1:flags=lanczos';
      setStatus('GIF 색상표를 만드는 중…');
      await instance.exec(['-ss', String(start), '-t', String(duration), '-i', inputName, '-vf', filter + ',palettegen=stats_mode=diff', 'palette.png']);
      if (videoCancelled) return;
      setStatus('GIF를 생성하는 중…');
      await instance.exec(['-ss', String(start), '-t', String(duration), '-i', inputName, '-i', 'palette.png', '-lavfi', filter + '[x];[x][1:v]paletteuse', '-loop', '0', '-an', '-y', 'output.gif']);
      if (videoCancelled) return;
      var data = await instance.readFile('output.gif');
      var blob = new Blob([data.buffer], { type: 'image/gif' });
      if (blob.size > MAX_GIF_BYTES) return setStatus('결과 GIF가 15MB를 넘었습니다. 길이를 줄이거나 480px을 선택해 주세요.', 'error');
      showResult(blob, videoFile.name.replace(/\.[^.]+$/, '') + '.gif', duration.toFixed(1) + '초 · ' + width + 'px · 10fps');
      setStatus('동영상 GIF를 만들었습니다.', 'success');
    } catch (error) {
      if (!videoCancelled) setStatus('동영상 변환에 실패했습니다. 지원되는 코덱의 짧은 MP4·WebM·MOV 파일인지 확인해 주세요.', 'error');
    } finally {
      createVideoBtn.disabled = !videoFile;
      cancelVideoBtn.style.display = 'none';
    }
  });

  cancelVideoBtn.addEventListener('click', function () {
    videoCancelled = true;
    if (ffmpeg) { ffmpeg.terminate(); ffmpeg = null; }
    setStatus('동영상 변환을 취소했습니다.');
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
