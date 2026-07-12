/*
 * Local-only FFmpeg worker, derived from @ffmpeg/ffmpeg 0.12.15 (MIT).
 * This project intentionally removes the package's CDN fallback.
 */
(function () {
  'use strict';

  var TYPE = {
    LOAD: 'LOAD', EXEC: 'EXEC', FFPROBE: 'FFPROBE', WRITE_FILE: 'WRITE_FILE',
    READ_FILE: 'READ_FILE', DELETE_FILE: 'DELETE_FILE', RENAME: 'RENAME',
    CREATE_DIR: 'CREATE_DIR', LIST_DIR: 'LIST_DIR', DELETE_DIR: 'DELETE_DIR',
    ERROR: 'ERROR', PROGRESS: 'PROGRESS', LOG: 'LOG'
  };
  var core = null;

  function localUrl(path) {
    return new URL(path, self.location.href).href;
  }

  function requireLocal(url) {
    var target = new URL(url, self.location.href);
    if (target.origin !== self.location.origin) throw new Error('FFmpeg resources must be loaded from this site.');
    return target.href;
  }

  async function inflateWasm(wasmURL) {
    if (!wasmURL.endsWith('.gz')) return { url: wasmURL, temporary: false };
    if (typeof DecompressionStream !== 'function') {
      throw new Error('이 브라우저는 압축된 FFmpeg 엔진을 지원하지 않습니다. 최신 Chrome, Firefox 또는 Safari를 사용해 주세요.');
    }
    var response = await fetch(wasmURL, { credentials: 'same-origin' });
    if (!response.ok || !response.body) throw new Error('압축된 FFmpeg 엔진을 불러오지 못했습니다.');
    var stream = response.body.pipeThrough(new DecompressionStream('gzip'));
    var bytes = await new Response(stream).arrayBuffer();
    return { url: URL.createObjectURL(new Blob([bytes], { type: 'application/wasm' })), temporary: true };
  }

  async function loadCore(options) {
    var coreURL = requireLocal(options.coreURL || localUrl('./ffmpeg-core.js'));
    var wasmURL = requireLocal(options.wasmURL || localUrl('./ffmpeg-core.wasm.gz'));
    var workerURL = requireLocal(options.workerURL || localUrl('./ffmpeg-core.worker.js'));
    importScripts(coreURL);
    if (typeof self.createFFmpegCore !== 'function') throw new Error('Local FFmpeg core could not be loaded.');
    var wasm = await inflateWasm(wasmURL);
    try {
      core = await self.createFFmpegCore({
        mainScriptUrlOrBlob: coreURL + '#' + btoa(JSON.stringify({ wasmURL: wasm.url, workerURL: workerURL }))
      });
    } finally {
      if (wasm.temporary) URL.revokeObjectURL(wasm.url);
    }
    core.setLogger(function (entry) { self.postMessage({ type: TYPE.LOG, data: entry }); });
    core.setProgress(function (entry) { self.postMessage({ type: TYPE.PROGRESS, data: entry }); });
    return true;
  }

  function execute(args, timeout) {
    core.setTimeout(timeout === undefined ? -1 : timeout);
    core.exec.apply(core, args);
    var result = core.ret;
    core.reset();
    return result;
  }

  function probe(args, timeout) {
    core.setTimeout(timeout === undefined ? -1 : timeout);
    core.ffprobe.apply(core, args);
    var result = core.ret;
    core.reset();
    return result;
  }

  self.onmessage = async function (event) {
    var message = event.data;
    var id = message.id;
    try {
      if (message.type !== TYPE.LOAD && !core) throw new Error('FFmpeg is not loaded.');
      var result;
      switch (message.type) {
        case TYPE.LOAD:
          result = await loadCore(message.data || {});
          break;
        case TYPE.EXEC:
          result = execute(message.data.args || [], message.data.timeout);
          break;
        case TYPE.FFPROBE:
          result = probe(message.data.args || [], message.data.timeout);
          break;
        case TYPE.WRITE_FILE:
          core.FS.writeFile(message.data.path, message.data.data);
          result = true;
          break;
        case TYPE.READ_FILE:
          result = core.FS.readFile(message.data.path, { encoding: message.data.encoding || 'binary' });
          break;
        case TYPE.DELETE_FILE:
          core.FS.unlink(message.data.path);
          result = true;
          break;
        case TYPE.RENAME:
          core.FS.rename(message.data.oldPath, message.data.newPath);
          result = true;
          break;
        case TYPE.CREATE_DIR:
          core.FS.mkdir(message.data.path);
          result = true;
          break;
        case TYPE.DELETE_DIR:
          core.FS.rmdir(message.data.path);
          result = true;
          break;
        case TYPE.LIST_DIR:
          result = core.FS.readdir(message.data.path).map(function (name) {
            var stat = core.FS.stat(message.data.path + '/' + name);
            return { name: name, isDir: core.FS.isDir(stat.mode) };
          });
          break;
        default:
          throw new Error('Unsupported FFmpeg worker request.');
      }
      var transfers = result instanceof Uint8Array ? [result.buffer] : [];
      self.postMessage({ id: id, type: message.type, data: result }, transfers);
    } catch (error) {
      self.postMessage({ id: id, type: TYPE.ERROR, data: String(error && error.message ? error.message : error) });
    }
  };
}());
