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
