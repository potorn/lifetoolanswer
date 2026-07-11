# Third-party notices

This site includes the following browser-side WebAssembly dependencies. They are loaded locally from the `vendor/` directory and do not send selected files to a third party.

- `@imagemagick/magick-wasm` 0.0.41 — Apache-2.0. The full license and notices are in `vendor/magick/LICENSE` and `vendor/magick/NOTICE`.
- `@ffmpeg/ffmpeg` 0.12.15 — MIT. `vendor/ffmpeg/814.ffmpeg.js` is a local-only derivative that removes the upstream CDN fallback. Upstream project: https://github.com/ffmpegwasm/ffmpeg.wasm
- `@ffmpeg/core` 0.12.10 — GPL-2.0-or-later FFmpeg browser core. The GPL-2.0 license text is included at `vendor/ffmpeg/GPL-2.0-or-later.txt`. Corresponding source and release obligations are documented in `GPL_SOURCE_RELEASE.md`.

## FFmpeg asset hashes

The public corresponding-source release must include these exact deployed assets or their replacement hashes.

```text
vendor/ffmpeg/ffmpeg.js            AD4CFE957589995DEA03FC8DE1FD5E9F5CB4558A7282913172203082A65BBFAA
vendor/ffmpeg/814.ffmpeg.js        0FC0075C7FCE92875BE864D189F9C3E1CD0838BA63886EFD3A1A0E3EF012F005
vendor/ffmpeg/ffmpeg-core.js       B266AB5B952555881DD6310663986994A182ACB2B7FF25CF10A25F7A37AC2B21
vendor/ffmpeg/ffmpeg-core.wasm     9F57947A5BD530D8F00C5B3F2CB2A3492FAA7E5D823315342D6A8656D0A6B7B7
```
