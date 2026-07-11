export var MAX_IMAGE_INPUT_BYTES = 25 * 1024 * 1024;
export var MAX_IMAGE_DIMENSION = 4096;
export var MAX_IMAGE_PIXELS = 16 * 1024 * 1024;
export var MAX_ANIMATION_FRAMES = 60;
export var MAX_ANIMATION_PIXELS = 32 * 1024 * 1024;
export var SUPPORTED_IMAGE_FORMATS = ['png', 'jpeg', 'webp', 'gif', 'bmp', 'ico', 'avif', 'tga'];

function ascii(bytes, start, length) {
  var value = '';
  for (var i = start; i < start + length && i < bytes.length; i++) value += String.fromCharCode(bytes[i]);
  return value;
}

function extension(fileName) {
  var match = /\.([a-z0-9]+)$/i.exec(fileName || '');
  return match ? match[1].toLowerCase() : '';
}

function isTga(bytes) {
  if (bytes.length < 18) return false;
  var imageType = bytes[2];
  var width = bytes[12] | (bytes[13] << 8);
  var height = bytes[14] | (bytes[15] << 8);
  return bytes[1] <= 1 && [1, 2, 3, 9, 10, 11].indexOf(imageType) !== -1 && width > 0 && height > 0 && [8, 16, 24, 32].indexOf(bytes[16]) !== -1;
}

function hasAvifBrand(bytes) {
  if (bytes.length < 16 || ascii(bytes, 4, 4) !== 'ftyp') return false;
  for (var offset = 8; offset + 4 <= bytes.length && offset < 64; offset += 4) {
    var brand = ascii(bytes, offset, 4);
    if (brand === 'avif' || brand === 'avis') return true;
  }
  return false;
}

export function detectImageFormat(buffer, fileName) {
  var bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG') return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'jpeg';
  if (bytes.length >= 6 && (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a')) return 'gif';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'webp';
  if (bytes.length >= 2 && ascii(bytes, 0, 2) === 'BM') return 'bmp';
  if (bytes.length >= 4 && bytes[0] === 0 && bytes[1] === 0 && (bytes[2] === 1 || bytes[2] === 2) && bytes[3] === 0) return 'ico';
  if (hasAvifBrand(bytes)) return 'avif';
  if (extension(fileName) === 'tga' && isTga(bytes)) return 'tga';
  return null;
}

export function validateImageBuffer(buffer, fileName, allowedFormats) {
  var bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (!bytes.length || bytes.byteLength > MAX_IMAGE_INPUT_BYTES) return { ok: false, error: '이미지 파일은 최대 25MB까지 지원합니다.' };
  var format = detectImageFormat(bytes, fileName);
  if (!format || (allowedFormats && allowedFormats.indexOf(format) === -1)) return { ok: false, error: '지원하지 않는 이미지 파일입니다. SVG와 문서 파일은 업로드할 수 없습니다.' };
  return { ok: true, format: format };
}

export function validateVideoBuffer(buffer, fileName) {
  var bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  var ext = extension(fileName);
  if (ext === 'webm' && bytes.length >= 4 && bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) return { ok: true, format: 'webm' };
  if ((ext === 'mp4' || ext === 'mov') && bytes.length >= 12 && ascii(bytes, 4, 4) === 'ftyp') return { ok: true, format: ext };
  return { ok: false, error: 'MP4, WebM, MOV 형식의 동영상만 지원합니다.' };
}

export function isSafeOutputSize(width, height, frames) {
  return Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION && width * height <= MAX_IMAGE_PIXELS && frames > 0 && frames <= MAX_ANIMATION_FRAMES && width * height * frames <= MAX_ANIMATION_PIXELS;
}
