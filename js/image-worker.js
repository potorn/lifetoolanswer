import { ConfigurationFiles, Gravity, ImageMagick, MagickColors, MagickFormat, MagickImage, MagickImageCollection, initializeImageMagick } from '../vendor/magick/index.js';
import { MAX_ANIMATION_FRAMES, MAX_ANIMATION_PIXELS, MAX_IMAGE_INPUT_BYTES, SUPPORTED_IMAGE_FORMATS, isSafeOutputSize, validateImageBuffer } from './file-validation.js';

var ready;
var formatMap = {
  png: MagickFormat.Png,
  jpeg: MagickFormat.Jpeg,
  webp: MagickFormat.WebP,
  tga: MagickFormat.Tga,
  gif: MagickFormat.Gif,
  bmp: MagickFormat.Bmp,
  ico: MagickFormat.Ico,
  avif: MagickFormat.Avif
};
var mimeMap = {
  png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', tga: 'image/x-tga',
  gif: 'image/gif', bmp: 'image/bmp', ico: 'image/x-icon', avif: 'image/avif'
};

function initialize() {
  if (!ready) ready = initializeImageMagick(new URL('../vendor/magick/magick.wasm', import.meta.url), createConfigurationFiles());
  return ready;
}

function createConfigurationFiles() {
  var configuration = new ConfigurationFiles();
  var policies = [
    '<policy domain="resource" name="memory" value="256MiB"/>',
    '<policy domain="resource" name="map" value="256MiB"/>',
    '<policy domain="resource" name="max-memory-request" value="128MiB"/>',
    '<policy domain="resource" name="width" value="4096"/>',
    '<policy domain="resource" name="height" value="4096"/>',
    '<policy domain="resource" name="area" value="16MP"/>',
    '<policy domain="resource" name="list-length" value="60"/>',
    '<policy domain="resource" name="time" value="30"/>',
    '<policy domain="resource" name="thread" value="1"/>'
  ].join('');
  configuration.policy.data = configuration.policy.data.replace('</policymap>', policies + '</policymap>');
  return configuration;
}

function resize(image, width, height, quality) {
  if (image.width !== width || image.height !== height) image.resize(width, height);
  image.quality = quality;
}

function readMetadata(bytes, fileName, allowedFormats) {
  var validation = validateImageBuffer(bytes, fileName, allowedFormats);
  if (!validation.ok) throw new Error(validation.error);
  var collection = MagickImageCollection.create();
  try {
    collection.ping(bytes);
    if (!collection.length || collection.length > MAX_ANIMATION_FRAMES) throw new Error('이미지 프레임 수가 제한을 초과했습니다.');
    var totalPixels = 0;
    collection.forEach(function (image) {
      if (!image.width || !image.height) throw new Error('이미지 크기를 확인할 수 없습니다.');
      totalPixels += image.width * image.height;
    });
    if (totalPixels > MAX_ANIMATION_PIXELS) throw new Error('이미지의 총 픽셀 수가 제한을 초과했습니다.');
    return { width: collection[0].width, height: collection[0].height, frames: collection.length };
  } finally {
    collection.dispose();
  }
}

self.onmessage = async function (event) {
  var message = event.data;
  try {
    await initialize();
    var bytes = new Uint8Array(message.bytes);
    if (message.action === 'inspect') {
      var info = readMetadata(bytes, message.fileName, null);
      self.postMessage({ id: message.id, action: 'inspect', ok: true, width: info.width, height: info.height, frames: info.frames });
      return;
    }
    if (message.action === 'convert') {
      var metadata = readMetadata(bytes, message.fileName, null);
      var outputFrames = message.preserveAnimation ? metadata.frames : 1;
      if (!isSafeOutputSize(message.width, message.height, outputFrames)) throw new Error('출력 이미지 크기 또는 프레임 수가 제한을 초과했습니다.');
      var result = ImageMagick.readCollection(bytes, function (images) {
        var sourceFrames = images.length;
        var animate = message.preserveAnimation && sourceFrames > 1;
        var output;
        if (animate) {
          images.coalesce();
          images.forEach(function (image) { resize(image, message.width, message.height, message.quality); });
          output = images.write(formatMap[message.format], function (data) { return new Uint8Array(data); });
        } else {
          var image = images[0];
          resize(image, message.width, message.height, message.quality);
          output = image.write(formatMap[message.format], function (data) { return new Uint8Array(data); });
        }
        return { bytes: output, sourceFrames: sourceFrames };
      });
      self.postMessage({
        id: message.id,
        action: 'convert',
        ok: true,
        bytes: result.bytes,
        sourceFrames: result.sourceFrames,
        preservedAnimation: message.preserveAnimation && result.sourceFrames > 1,
        width: message.width,
        height: message.height,
        mime: mimeMap[message.format]
      }, [result.bytes.buffer]);
    }
    if (message.action === 'makeGif') {
      var frames = message.files.map(function (buffer) { return new Uint8Array(buffer); });
      if (frames.length < 2 || frames.length > 30) throw new Error('GIF는 2~30장의 사진으로 만들 수 있습니다.');
      var totalBytes = frames.reduce(function (sum, frame) { return sum + frame.byteLength; }, 0);
      if (totalBytes > MAX_IMAGE_INPUT_BYTES) throw new Error('GIF 제작용 사진 전체 용량은 최대 25MB입니다.');
      var metadataList = frames.map(function (frame, index) {
        var metadata = readMetadata(frame, (message.fileNames || [])[index] || ('frame-' + index + '.png'), SUPPORTED_IMAGE_FORMATS);
        if (metadata.frames !== 1) throw new Error('GIF 제작에는 움직이지 않는 사진만 사용할 수 있습니다.');
        return metadata;
      });
      var targetHeight = Math.max(1, Math.round(message.width * metadataList[0].height / metadataList[0].width));
      if (!isSafeOutputSize(message.width, targetHeight, frames.length)) throw new Error('GIF 출력 크기 또는 프레임 수가 제한을 초과했습니다.');
      var collection = MagickImageCollection.create();
      try {
        frames.forEach(function (frame) {
          var image = MagickImage.create(frame);
          var scale = Math.min(message.width / image.width, targetHeight / image.height);
          image.resize(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
          image.backgroundColor = MagickColors.Transparent;
          image.extent(message.width, targetHeight, Gravity.Center);
          image.animationTicksPerSecond = 100;
          image.animationDelay = Math.max(1, Math.round(message.delay / 10));
          image.animationIterations = message.loop ? 0 : 1;
          collection.push(image);
        });
        collection.quantize();
        var gif = collection.write(MagickFormat.Gif, function (data) { return new Uint8Array(data); });
        self.postMessage({ id: message.id, action: 'makeGif', ok: true, bytes: gif, width: message.width, height: targetHeight, frames: frames.length }, [gif.buffer]);
      } finally {
        collection.dispose();
      }
    }
  } catch (error) {
    self.postMessage({ id: message.id, ok: false, error: '지원하지 않거나 손상된 이미지입니다. (' + (error.message || error) + ')' });
  }
};
