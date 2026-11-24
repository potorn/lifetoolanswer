# Third-party notices

This site includes the following browser-side WebAssembly dependencies. They are loaded locally from the `vendor/` directory and do not send selected files to a third party. The FFmpeg WASM is gzip-compressed for Cloudflare's per-asset limit and inflated inside the local worker.

- `@imagemagick/magick-wasm` 0.0.41 — Apache-2.0. The full license and notices are in `vendor/magick/LICENSE` and `vendor/magick/NOTICE`.
- `@ffmpeg/ffmpeg` 0.12.15 — MIT. `vendor/ffmpeg/814.ffmpeg.js` is a local-only derivative that removes the upstream CDN fallback. Upstream project: https://github.com/ffmpegwasm/ffmpeg.wasm
- `@ffmpeg/core` 0.12.10 — GPL-2.0-or-later FFmpeg browser core. The GPL-2.0 license text is included at `vendor/ffmpeg/GPL-2.0-or-later.txt`. Corresponding source and release obligations are documented in `GPL_SOURCE_RELEASE.md`.
- `qrcode-generator` — MIT. The browser-side QR encoder is loaded locally from `vendor/qrcode/qrcode.js`; its license is included at `vendor/qrcode/LICENSE`. Upstream project: https://github.com/kazuhikoarase/qrcode-generator

## FFmpeg asset hashes

The public corresponding-source release must include these exact deployed assets or their replacement hashes.

```text
vendor/ffmpeg/ffmpeg.js            0606B9FF08B52BBC4B616855C0D00E8B1751AE3DDAFDCDB1689653729B930656
vendor/ffmpeg/814.ffmpeg.js        2EE2E3D34D4926CD09B64C32E8E270CC52FDA3EF80AD7015C38404ECDBD32BE3
vendor/ffmpeg/ffmpeg-core.js       5B797173E07352D7D04C0F51AFED47D2E39962BBFF7F1CB07193B084AE55DC94
vendor/ffmpeg/ffmpeg-core.wasm     9F57947A5BD530D8F00C5B3F2CB2A3492FAA7E5D823315342D6A8656D0A6B7B7
vendor/ffmpeg/ffmpeg-core.wasm.gz  1767A2D0C6D6B14DE37876261443397CECD591F298B162EDED99018DE4F6355D
```

`vendor/ffmpeg/ffmpeg-core.wasm` is the corresponding uncompressed source asset and is excluded from Cloudflare uploads by `.assetsignore`. The deployed asset is `ffmpeg-core.wasm.gz`; `scripts/compress-ffmpeg-core.mjs` recreates it with deterministic gzip level 9 compression.

## Background removal

The image editor removes a photo background in the visitor's browser. These two pieces are not stored in the repository and are not uploaded as Cloudflare static assets. The page fetches them only after the visitor chooses background removal. The photograph is not part of either request. `GPL_SOURCE_RELEASE.md` does not change for this feature: neither dependency is GPL.

- **MODNet** portrait-matting weights, ONNX build `Xenova/modnet` revision `fa2fa546052fba4c08921230a26cc69a333fca12`, file `onnx/model_quantized.onnx`. Copyright (c) 2020-2022 Zhanghan Ke and the MODNet authors. The upstream project relicensed the code and models from CC BY-NC-SA 4.0 to Apache-2.0 on 28 January 2022; this site uses that Apache-2.0 release, which allows commercial use on an ad-supported site. ONNX conversion by Xenova (Joshua Lochner), also Apache-2.0. Upstream: https://github.com/ZHKKKe/MODNet and https://huggingface.co/Xenova/modnet — license: https://github.com/ZHKKKe/MODNet/blob/master/LICENSE
  - Download: Hugging Face CDN (`huggingface.co`, which redirects to `cdn.hf.co`).
  - Size: 6,632,188 bytes (about 6.6MB).
  - SHA-256: `92e49898c3e05a6d7a944fc67a8cb87c4aad754ffb6ebd949528c7d1105fee3a`.
- **ONNX Runtime Web** 1.22.0 (`onnxruntime-web`, MIT). Copyright (c) Microsoft Corporation. Loaded from jsDelivr (`cdn.jsdelivr.net`) as `ort.wasm.min.mjs` or `ort.webgpu.min.mjs` plus the matching WASM binary (`ort-wasm-simd-threaded.wasm`, 11,210,254 bytes, or `ort-wasm-simd-threaded.jsep.wasm`, 21,872,216 bytes when WebGPU is available). Upstream: https://github.com/microsoft/onnxruntime — license: https://github.com/microsoft/onnxruntime/blob/main/LICENSE

WebGPU is selected when the browser can create an ONNX Runtime WebGPU session. Otherwise the same weights run on the single-threaded WASM backend, so the page does not need cross-origin isolation and does not add headers that would block AdSense.
