# GPL corresponding-source release checklist

`@ffmpeg/core` 0.12.10 is distributed with this site under GPL-2.0-or-later. Before a public deployment that includes `vendor/ffmpeg/ffmpeg-core.*`, publish a public, versioned corresponding-source release. The deployed WASM is `vendor/ffmpeg/ffmpeg-core.wasm.gz`, which is locally inflated before execution; the uncompressed `ffmpeg-core.wasm` remains available in the public source repository and is excluded from Cloudflare static uploads.

The release must:

1. Be publicly accessible for the exact deployed site revision and remain linked from the deployed site or its source notice.
2. Include this website's complete source for the deployed revision, the local FFmpeg worker modification, the GPL license text, and the asset hashes recorded in `THIRD_PARTY_NOTICES.md`.
3. Identify the upstream `@ffmpeg/ffmpeg` 0.12.15 and `@ffmpeg/core` 0.12.10 sources at https://github.com/ffmpegwasm/ffmpeg.wasm.
4. Include the SHA-256 hashes of both the uncompressed source asset and the deployed gzip asset from `THIRD_PARTY_NOTICES.md`.
5. Be updated whenever the FFmpeg core or local worker asset changes.

This repository currently records the compliance requirements only. Publishing the public source release is a deployment-owner action and must be completed before enabling the video-to-GIF feature in production.
