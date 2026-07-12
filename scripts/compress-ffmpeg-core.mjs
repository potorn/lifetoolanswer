import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const source = 'vendor/ffmpeg/ffmpeg-core.wasm';
const target = 'vendor/ffmpeg/ffmpeg-core.wasm.gz';
const bytes = await readFile(source);
await writeFile(target, gzipSync(bytes, { level: 9 }));
console.log(`${source} -> ${target}`);
