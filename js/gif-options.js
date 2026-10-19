export function gifCandidates(width, fps, target) {
  return (target ? [1, .75, .5, .33] : [1]).map((scale, i) => ({
    width: Math.max(64, Math.round(width * scale)), fps: Math.max(2, Math.round(fps * [1, .8, .6, .4][i])), frameScale: [1, .75, .5, .33][i]
  }));
}
export function sampleGifFrames(frames, scale, delay) {
  const count = Math.max(2, Math.ceil(frames.length * scale)), selected = [], delays = [];
  for (let i = 0; i < count; i++) {
    const start = Math.floor(i * frames.length / count), end = Math.floor((i + 1) * frames.length / count);
    selected.push(frames[start]); delays.push((end - start) * delay);
  }
  return { selected, delays };
}
