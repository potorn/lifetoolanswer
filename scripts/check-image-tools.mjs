// Run with Node.js 22+: node scripts/check-image-tools.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { adjustPixels } from '../js/image-editor.js';
import * as validation from '../js/file-validation.js';
import * as magick from '../vendor/magick/index.js';

const fixture = new Uint8Array(await readFile(new URL('../img/hero-tools.png', import.meta.url)));
const buffer = () => fixture.slice().buffer;
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

for (let n = 0; n < 256; n++) {
  const pixel = [n, 255 - n, n * 37 % 256, n];
  assert.deepEqual([...adjustPixels(new Uint8ClampedArray(pixel), {})], pixel);
}
for (const [pixel, values, expected] of [
  [[64, 32, 16, 77], { exposure: 1 }, [128, 64, 32, 77]],
  [[32, 128, 224, 91], { black: 32, white: 224 }, [0, 128, 255, 91]],
  [[255, 0, 0, 91], { grayscale: true }, [54, 54, 54, 91]],
  [[10, 80, 200, 37], { invert: true }, [245, 175, 55, 37]],
  [[10, 130, 240, 31], { posterize: 2 }, [0, 255, 255, 31]],
  [[0, 128, 255, 52], { contrast: -100 }, [128, 128, 128, 52]],
  [[255, 0, 0, 22], { thresholdOn: true }, [0, 0, 0, 22]]
]) assert.deepEqual([...adjustPixels(new Uint8ClampedArray(pixel), values)], expected);
console.log('PASS: 263 pixel checks, including alpha preservation');

class Element {
  constructor() {
    this.listeners = {}; this.style = {}; this.dataset = {}; this.value = ''; this.disabled = false;
    this.classList = { add() {}, remove() {}, toggle() {} };
  }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  fire(type, event = {}) { for (const listener of this.listeners[type] || []) listener(event); }
  querySelector(selector) { return this.children[selector]; }
  removeAttribute() {}
  scrollIntoView() {}
  remove() {}
}
const elements = new Map(), buttons = ['png', 'jpeg', 'webp', 'avif', 'bmp', 'ico', 'tga'].map(format => {
  const button = new Element(); button.dataset.fmt = format; return button;
});
const el = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
const downloads = [], messages = [];
let worker;
const document = {
  getElementById: el,
  querySelectorAll: () => buttons,
  addEventListener(type, listener) { if (type === 'DOMContentLoaded') listener(); },
  createElement() { const anchor = new Element(); anchor.click = () => downloads.push(anchor.download); return anchor; },
  body: { appendChild() {} }
};
el('dropZone').children = { '.img-drop-text': {}, '.img-drop-sub': {} };
el('qualitySlider').value = '85'; el('keepAspect').checked = true;
class Worker extends Element {
  constructor() { super(); worker = this; }
  postMessage(message) { messages.push(message); }
}
const converter = (await readFile(new URL('../js/image.js', import.meta.url), 'utf8')).replace(/^import .*;\r?\n/gm, '');
vm.runInNewContext(converter, {
  ...validation, document, Worker, Blob, URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
  window: { addEventListener() {} }, setTimeout() {}
});
const choose = async file => { el('fileInput').files = [file]; el('fileInput').fire('change'); await flush(); };
const inspect = () => {
  const message = messages.at(-1); assert.equal(message.action, 'inspect');
  worker.fire('message', { data: { id: message.id, action: 'inspect', ok: true, width: 1672, height: 941, frames: 1 } });
};
const format = name => buttons.find(b => b.dataset.fmt === name).fire('click');
let read = deferred(), reads = 0;
await choose({ name: 'sample.png', size: fixture.length, arrayBuffer: () => ++reads === 1 ? Promise.resolve(buffer()) : read.promise });
inspect(); format('jpeg'); el('convertBtn').fire('click'); format('webp');
read.resolve(buffer()); await flush();
assert.equal(messages.at(-1).format, 'jpeg', 'conversion must use the format selected at click time');
worker.fire('message', { data: { ...messages.at(-1), ok: true, bytes: fixture, mime: 'image/jpeg', sourceFrames: 1 } });
assert.equal(downloads.at(-1), 'sample.jpg');
format('png'); el('downloadBtn').fire('click'); assert.equal(downloads.at(-1), 'sample.jpg');

read = deferred(); el('convertBtn').fire('click'); const before = messages.length;
await choose({ name: 'new.png', size: fixture.length, arrayBuffer: () => Promise.resolve(buffer()) });
assert.equal(messages.length, before + 1);
assert.equal(el('convertBtn').disabled, true);
read.resolve(buffer()); await flush();
assert.equal(messages.length, before + 1, 'stale file reads must not post a conversion');
inspect(); assert.equal(el('convertBtn').disabled, false);
for (const width of ['0', '1.5', '-1', '4097']) {
  const count = messages.length; el('resizeW').value = width; el('convertBtn').fire('click'); await flush();
  assert.equal(messages.length, count, 'invalid width must be rejected: ' + width);
}
el('resizeW').value = ''; el('convertBtn').fire('click'); await flush();
worker.fire('message', { data: { id: messages.at(-1).id, ok: false, error: 'test conversion failure' } });
assert.equal(el('convertBtn').disabled, false);
assert.equal(el('convertBtn').textContent, '변환 & 다운로드');
console.log('PASS: converter request races, format/filename consistency, input validation and error recovery');

// Exercise the actual shared WASM worker to ensure removing GIF conversion
// does not remove the separate GIF Maker's makeGif action.
const wasm = new Uint8Array(await readFile(new URL('../vendor/magick/magick.wasm', import.meta.url)));
const replies = [];
const self = { postMessage: message => replies.push(message) };
const workerSource = (await readFile(new URL('../js/image-worker.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\r?\n/gm, '')
  .replaceAll('import.meta.url', JSON.stringify(new URL('../js/image-worker.js', import.meta.url).href));
vm.runInNewContext(workerSource, {
  ...magick, ...validation, self, URL, Uint8Array,
  initializeImageMagick: (_, configuration) => magick.initializeImageMagick(wasm, configuration)
});
const send = async message => {
  await self.onmessage({ data: { id: replies.length + 1, ...message } });
  return replies.at(-1);
};
for (const [format, mime] of [['png', 'image/png'], ['jpeg', 'image/jpeg'], ['webp', 'image/webp']]) {
  const result = await send({ action: 'convert', bytes: buffer(), fileName: 'sample.png', format, width: 32, height: 18, quality: 85, preserveAnimation: false });
  assert.equal(result.ok, true, result.error); assert.equal(result.mime, mime);
  assert.equal(validation.detectImageFormat(result.bytes, 'result.' + format), format);
}
const rejected = await send({ action: 'convert', bytes: buffer(), fileName: 'sample.png', format: 'gif', width: 32, height: 18 });
assert.equal(rejected.ok, false);
const gif = await send({ action: 'makeGif', files: [buffer(), buffer()], fileNames: ['one.png', 'two.png'], width: 32, delay: 100, loop: true });
assert.equal(gif.ok, true, gif.error); assert.equal(validation.detectImageFormat(gif.bytes, 'result.gif'), 'gif');
assert.equal(gif.frames, 2);
console.log('PASS: real WASM PNG/JPEG/WebP conversion, GIF output rejection and two-frame GIF Maker');
