// In-browser portrait matting. The photo never leaves the page.
// Runtime: onnxruntime-web 1.22.0 (MIT) from jsDelivr, loaded on first use.
// Model: Xenova/modnet onnx/model_quantized.onnx (Apache-2.0), revision
// fa2fa546052fba4c08921230a26cc69a333fca12, from the Hugging Face CDN.
// WebGPU is used when the browser can create a session; otherwise WASM.

export const MODEL_REVISION = 'fa2fa546052fba4c08921230a26cc69a333fca12';
export const MODEL_URL = `https://huggingface.co/Xenova/modnet/resolve/${MODEL_REVISION}/onnx/model_quantized.onnx`;
export const MODEL_BYTES = 6632188;
export const MODEL_SHA256 = '92e49898c3e05a6d7a944fc67a8cb87c4aad754ffb6ebd949528c7d1105fee3a';

const ORT_VERSION = '1.22.0';
const ORT_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
const WASM_FILE = 'ort-wasm-simd-threaded.wasm';
const WEBGPU_WASM_FILE = 'ort-wasm-simd-threaded.jsep.wasm';
const WASM_BYTES = 11210254;
const WEBGPU_WASM_BYTES = 21872216;
const CACHE_NAME = 'lifetoolanswer-bg-v1';

const runtimeLoads = new Map();
let modelBytesPromise = null;
let sessionEntry = null;

export class BackgroundRemovalError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BackgroundRemovalError';
    this.code = code;
  }
}

export function modnetDimensions(width, height, limit = 512) {
  const shortTarget = Math.min(512, limit);
  const snap = value => Math.max(32, Math.round(value / 32) * 32);
  let rw;
  let rh;
  if (width <= height) {
    rw = shortTarget;
    rh = Math.round(height / width * shortTarget);
  } else {
    rh = shortTarget;
    rw = Math.round(width / height * shortTarget);
  }
  rw = snap(rw);
  rh = snap(rh);
  const longSide = Math.max(rw, rh);
  if (longSide > limit) {
    const scale = limit / longSide;
    rw = snap(rw * scale);
    rh = snap(rh * scale);
  }
  return [rw, rh];
}

export function inferenceLimit() {
  const memory = typeof navigator === 'undefined' ? undefined : navigator.deviceMemory;
  if (memory && memory <= 2) return 384;
  if (memory && memory >= 8) return 768;
  return 512;
}

export function applyAlphaMatte(pixels, matte) {
  const count = Math.min(matte.length, pixels.length / 4);
  for (let i = 0; i < count; i++) {
    pixels[i * 4 + 3] = Math.round(pixels[i * 4 + 3] * matte[i] / 255);
  }
  return pixels;
}

function yieldToPaint() {
  return new Promise(resolve => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}

function withTimeout(promise, ms, error) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => { timer = setTimeout(() => reject(error), ms); })
  ]);
}

async function sha256(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function cacheGet(url) {
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(url);
    return hit ? await hit.arrayBuffer() : null;
  } catch {
    return null;
  }
}

async function cachePut(url, buffer) {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(url, new Response(buffer.slice(0), { headers: { 'content-type': 'application/octet-stream' } }));
  } catch { /* quota or private mode; the next visit can download again */ }
}

async function fetchBytes(url, { onProgress, expectedSize, signal } = {}) {
  let response;
  try {
    response = await fetch(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', signal });
  } catch (error) {
    if (error && error.name === 'AbortError') throw error;
    throw new BackgroundRemovalError('network', '배경 제거에 필요한 파일을 받지 못했습니다. 인터넷 연결을 확인한 뒤 다시 눌러 주세요. 사진은 전송되지 않았습니다.');
  }
  if (!response.ok || !response.body) {
    throw new BackgroundRemovalError('network', '배경 제거에 필요한 파일을 받지 못했습니다. 인터넷 연결을 확인한 뒤 다시 눌러 주세요. 사진은 전송되지 않았습니다.');
  }
  const total = Number(response.headers.get('content-length')) || expectedSize || 0;
  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress?.({ loaded, total: total || loaded });
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

async function cachedBytes(url, expectedSize, onProgress, signal) {
  const cached = await cacheGet(url);
  if (cached && (!expectedSize || cached.byteLength === expectedSize)) {
    onProgress?.({ loaded: cached.byteLength, total: cached.byteLength });
    return cached;
  }
  const bytes = await fetchBytes(url, { onProgress, expectedSize, signal });
  await cachePut(url, bytes);
  return bytes;
}

async function canUseWebGPU() {
  if (typeof navigator === 'undefined' || !navigator.gpu || typeof navigator.gpu.requestAdapter !== 'function') return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    // A fallback adapter (software WebGPU) is slower and less reliable than WASM here.
    return !!adapter && !adapter.isFallbackAdapter;
  } catch {
    return false;
  }
}

async function loadRuntime(webgpu, onProgress, signal) {
  const key = webgpu ? 'webgpu' : 'wasm';
  if (!runtimeLoads.has(key)) {
    runtimeLoads.set(key, (async () => {
      let ort;
      try {
        ort = await import(/* webpackIgnore: true */ ORT_BASE + (webgpu ? 'ort.webgpu.min.mjs' : 'ort.wasm.min.mjs'));
      } catch {
        throw new BackgroundRemovalError('network', '배경 제거 실행 엔진을 받지 못했습니다. 인터넷 연결을 확인한 뒤 다시 눌러 주세요. 사진은 전송되지 않았습니다.');
      }
      const wasmName = webgpu ? WEBGPU_WASM_FILE : WASM_FILE;
      const wasmBytes = await cachedBytes(ORT_BASE + wasmName, webgpu ? WEBGPU_WASM_BYTES : WASM_BYTES, progress => {
        onProgress?.({ phase: 'runtime', ...progress });
      }, signal);
      return { ort, wasmBytes };
    })().catch(error => {
      runtimeLoads.delete(key);
      throw error;
    }));
  }
  return runtimeLoads.get(key);
}

function configureRuntime(ort, wasmBytes) {
  ort.env.wasm.wasmPaths = ORT_BASE;
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.logLevel = 'error';
  ort.env.wasm.wasmBinary = wasmBytes.slice(0);
}

async function loadModel(onProgress, signal) {
  if (!modelBytesPromise) {
    modelBytesPromise = (async () => {
      const cached = await cacheGet(MODEL_URL);
      if (cached && await sha256(cached) === MODEL_SHA256) {
        onProgress?.({ phase: 'model', loaded: cached.byteLength, total: cached.byteLength });
        return cached;
      }
      const bytes = await fetchBytes(MODEL_URL, {
        expectedSize: MODEL_BYTES,
        signal,
        onProgress: progress => onProgress?.({ phase: 'model', ...progress })
      });
      if (await sha256(bytes) !== MODEL_SHA256) {
        throw new BackgroundRemovalError('integrity', '배경 분리 모델 파일이 예상과 달라 실행을 멈췄습니다. 새로고침한 뒤 다시 시도해 주세요. 사진은 전송되지 않았습니다.');
      }
      await cachePut(MODEL_URL, bytes);
      return bytes;
    })().catch(error => {
      modelBytesPromise = null;
      throw error;
    });
  }
  return modelBytesPromise;
}

async function createSession(ort, wasmBytes, modelBytes, providers) {
  configureRuntime(ort, wasmBytes);
  const session = await ort.InferenceSession.create(modelBytes.slice(0), { executionProviders: providers });
  return session;
}

function toNchw(imageData) {
  const plane = imageData.width * imageData.height;
  const out = new Float32Array(3 * plane);
  const data = imageData.data;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    out[p] = data[i] / 127.5 - 1;
    out[plane + p] = data[i + 1] / 127.5 - 1;
    out[plane * 2 + p] = data[i + 2] / 127.5 - 1;
  }
  return out;
}

function drawResized(source, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

function matteBytes(data, length) {
  const values = data instanceof Float32Array || data instanceof Float64Array ? data : Float32Array.from(data);
  if (values.length !== length) {
    throw new BackgroundRemovalError('engine', '배경 분리 결과의 크기가 사진과 맞지 않습니다. 다른 이미지로 다시 시도해 주세요.');
  }
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    const value = values[i];
    bytes[i] = value <= 0 ? 0 : value >= 1 ? 255 : Math.round(value * 255);
  }
  return bytes;
}

function upsampleAndApply(source, matte, matteWidth, matteHeight) {
  const small = document.createElement('canvas');
  small.width = matteWidth;
  small.height = matteHeight;
  const smallCtx = small.getContext('2d', { willReadFrequently: true });
  const mask = smallCtx.createImageData(matteWidth, matteHeight);
  const bytes = matteBytes(matte, matteWidth * matteHeight);
  for (let i = 0; i < bytes.length; i++) {
    const value = bytes[i];
    mask.data[i * 4] = value;
    mask.data[i * 4 + 1] = value;
    mask.data[i * 4 + 2] = value;
    mask.data[i * 4 + 3] = 255;
  }
  smallCtx.putImageData(mask, 0, 0);
  const full = document.createElement('canvas');
  full.width = source.width;
  full.height = source.height;
  const fullCtx = full.getContext('2d', { willReadFrequently: true });
  fullCtx.imageSmoothingEnabled = true;
  fullCtx.imageSmoothingQuality = 'high';
  fullCtx.drawImage(small, 0, 0, source.width, source.height);
  const scaled = fullCtx.getImageData(0, 0, source.width, source.height);
  const alpha = new Uint8Array(source.width * source.height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = scaled.data[i * 4];
  const srcCtx = source.getContext('2d', { willReadFrequently: true });
  const image = srcCtx.getImageData(0, 0, source.width, source.height);
  applyAlphaMatte(image.data, alpha);
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  out.getContext('2d').putImageData(image, 0, 0);
  return out;
}

function describe(error) {
  if (error instanceof BackgroundRemovalError) return error;
  const text = String(error && (error.message || error) || '');
  if (/out of memory|oom|allocation failed|Array buffer allocation/i.test(text)) {
    return new BackgroundRemovalError('memory', '메모리 부족으로 배경을 분리하지 못했습니다. 더 작은 이미지로 다시 시도해 주세요.');
  }
  if (/failed to fetch|network|load failed|NetworkError/i.test(text)) {
    return new BackgroundRemovalError('network', '배경 제거에 필요한 파일을 받지 못했습니다. 인터넷 연결을 확인한 뒤 다시 눌러 주세요. 사진은 전송되지 않았습니다.');
  }
  return new BackgroundRemovalError('engine', '이 브라우저에서 배경을 분리하지 못했습니다. 최신 Chrome, Edge, Firefox, Safari에서 다시 시도하거나 더 작은 이미지를 사용해 주세요.');
}

async function ensureSession(onProgress, signal) {
  if (sessionEntry) return sessionEntry;
  const preferWebGPU = await canUseWebGPU();
  onProgress?.({ phase: 'runtime', loaded: 0, total: preferWebGPU ? WEBGPU_WASM_BYTES : WASM_BYTES });
  const { ort, wasmBytes } = await loadRuntime(preferWebGPU, onProgress, signal);
  onProgress?.({ phase: 'model', loaded: 0, total: MODEL_BYTES });
  const modelBytes = await loadModel(onProgress, signal);
  onProgress?.({ phase: 'prepare' });
  await yieldToPaint();
  const timeout = new BackgroundRemovalError('timeout', '모델을 준비하는 데 너무 오래 걸려 배경 제거를 멈췄습니다. 잠시 후 다시 시도해 주세요.');
  if (preferWebGPU) {
    try {
      const session = await withTimeout(createSession(ort, wasmBytes, modelBytes, ['webgpu']), 25000, timeout);
      sessionEntry = { ort, session, wasmBytes, modelBytes, provider: 'webgpu' };
      return sessionEntry;
    } catch {
      onProgress?.({ phase: 'fallback' });
    }
  }
  try {
    const session = await withTimeout(createSession(ort, wasmBytes, modelBytes, ['wasm']), 45000, timeout);
    sessionEntry = { ort, session, wasmBytes, modelBytes, provider: 'wasm' };
    return sessionEntry;
  } catch (error) {
    sessionEntry = null;
    throw describe(error);
  }
}

export async function removeBackground(source, { onProgress, signal } = {}) {
  if (typeof document === 'undefined') {
    throw new BackgroundRemovalError('unsupported', '배경 제거는 브라우저에서만 실행할 수 있습니다.');
  }
  if (!source || !source.width || !source.height) {
    throw new BackgroundRemovalError('unsupported', '배경을 제거할 사진이 없습니다.');
  }
  try {
    const entry = await ensureSession(onProgress, signal);
    const limit = inferenceLimit();
    const [rw, rh] = modnetDimensions(source.width, source.height, limit);
    onProgress?.({ phase: 'run', provider: entry.provider });
    await yieldToPaint();
    const image = drawResized(source, rw, rh);
    const feed = () => ({ input: new entry.ort.Tensor('float32', toNchw(image), [1, 3, rh, rw]) });
    let active = entry;
    let outputMap;
    try {
      outputMap = await withTimeout(
        active.session.run(feed()),
        90000,
        new BackgroundRemovalError('timeout', '배경을 분리하는 데 너무 오래 걸려 멈췄습니다. 더 작은 이미지로 다시 시도해 주세요.')
      );
    } catch (error) {
      const timedOut = error instanceof BackgroundRemovalError && error.code === 'timeout';
      if (active.provider === 'webgpu' && !timedOut) {
        onProgress?.({ phase: 'fallback' });
        try { await active.session.release?.(); } catch { /* already released */ }
        sessionEntry = null;
        const wasmSession = await createSession(active.ort, active.wasmBytes, active.modelBytes, ['wasm']);
        active = sessionEntry = { ...active, session: wasmSession, provider: 'wasm' };
        onProgress?.({ phase: 'run', provider: 'wasm' });
        await yieldToPaint();
        outputMap = await wasmSession.run(feed());
      } else {
        throw error;
      }
    }
    const output = outputMap.output || outputMap[active.session.outputNames[0]];
    let data = output && output.data;
    if (data && typeof data.then === 'function') data = await data;
    const canvas = upsampleAndApply(source, data, rw, rh);
    return { canvas, provider: active.provider };
  } catch (error) {
    throw describe(error);
  }
}
