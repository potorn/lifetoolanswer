export const sizePresets = {
  id: { label: '증명사진 비율', width: 413, height: 531 },
  profile: { label: '프로필', width: 512, height: 512 },
  thumbnail: { label: '가로 썸네일', width: 1280, height: 720 },
  portrait: { label: '세로 게시물', width: 1080, height: 1350 }
};
export function validEditorSettings(value, defaults, specs) {
  if (!value || value.version !== 1 || !value.adjustments || !value.output) return false;
  for (const [key, initial] of Object.entries(defaults)) {
    const n = value.adjustments[key];
    if (typeof initial === 'boolean') { if (typeof n !== 'boolean') return false; }
    else {
      const spec = specs.find(s => s[0] === key);
      if (!spec || !Number.isFinite(n) || n < spec[2] || n > spec[3]) return false;
    }
  }
  const o = value.output;
  return value.adjustments.black < value.adjustments.white && ['png', 'jpeg', 'webp'].includes(o.format) &&
    Number.isInteger(o.width) && o.width > 0 && o.width <= 4096 && Number.isInteger(o.height) && o.height > 0 && o.height <= 4096 && o.width * o.height <= 16 * 1024 * 1024 &&
    Number.isFinite(o.quality) && o.quality >= 10 && o.quality <= 100 && typeof o.aspect === 'boolean' && /^#[0-9a-f]{6}$/i.test(o.background);
}
