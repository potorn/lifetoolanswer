// Small, local-only report helpers for the enhanced calculators.
export const byId = id => document.getElementById(id);
export const won = value => Math.round(value).toLocaleString('ko-KR') + '원';
export function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = node('a'); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function csv(rows, filename) {
  const safe = value => {
    let text = String(value);
    if (/^\s*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  download(new Blob(['\uFEFF' + rows.map(row => row.map(safe).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), filename);
}
export function table(headers, rows) {
  const wrap = node('div', undefined, 'upgrade-table-wrap');
  const result = node('table', undefined, 'ref-table upgrade-table');
  const head = node('thead'), tr = node('tr');
  headers.forEach(label => { const th = node('th', label); th.scope = 'col'; tr.append(th); });
  head.append(tr); result.append(head);
  const body = node('tbody');
  rows.forEach(row => { const tr = node('tr'); row.forEach(value => tr.append(value instanceof HTMLElement ? value : node('td', value))); body.append(tr); });
  result.append(body); wrap.append(result); return wrap;
}
const chartContents = new WeakMap();
const screenCharts = new Set();
if (typeof document !== 'undefined') document.addEventListener('themechange', () => {
  for (const canvas of Array.from(screenCharts)) {
    if (!canvas.isConnected) { screenCharts.delete(canvas); continue; }
    const data = chartContents.get(canvas);
    if (data) drawLines(canvas, data.labels, data.series, data.unit);
  }
});
export function drawLines(canvas, labels, series, unit = '') {
  chartContents.set(canvas, { labels, series, unit });
  for (const previous of screenCharts) if (!previous.isConnected) screenCharts.delete(previous);
  if (canvas.isConnected) screenCharts.add(canvas);
  const dark = canvas.isConnected && document.documentElement.dataset.theme === 'dark';
  const ink = dark ? '#a9b8cd' : '#64748b';
  const w = Math.max(canvas.clientWidth || 600, 260), h = Math.max(230, w * 0.45);
  canvas.width = Math.round(w * 2); canvas.height = Math.round(h * 2);
  const ctx = canvas.getContext('2d'); ctx.scale(2, 2);
  const values = series.flatMap(item => item.values);
  const max = Math.max(...values, 1), min = 0;
  const left = 66, right = w - 18, top = w < 480 && series.length > 1 ? 85 : 65, bottom = h - 35;
  ctx.fillStyle = dark ? '#182234' : '#fff'; ctx.fillRect(0, 0, w, h);
  ctx.font = '12px sans-serif'; ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.fillText(unit, left, 18);
  series.forEach((item, index) => {
    const x = left + (w < 480 ? 0 : index * 210), y = 36 + (w < 480 ? index * 19 : 0);
    ctx.fillStyle = item.color; ctx.fillRect(x, y - 5, 10, 3); ctx.fillText(item.name, x + 16, y);
  });
  for (let i = 0; i <= 4; i++) {
    const y = bottom - i / 4 * (bottom - top);
    ctx.beginPath(); ctx.strokeStyle = dark ? '#34435c' : '#e2e8f0'; ctx.lineWidth = 1; ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    const value = min + max * i / 4;
    const tick = value >= 100000 ? value.toLocaleString('ko-KR', { notation: 'compact', maximumFractionDigits: 1 }) : value.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
    ctx.fillStyle = ink; ctx.textAlign = 'right'; ctx.fillText(tick, left - 9, y + 4);
  }
  series.forEach(item => {
    ctx.strokeStyle = item.color; ctx.fillStyle = item.color; ctx.lineWidth = 2; ctx.beginPath();
    item.values.forEach((value, index) => {
      const x = labels.length === 1 ? (left + right) / 2 : left + index / (labels.length - 1) * (right - left);
      const y = bottom - value / max * (bottom - top);
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }); ctx.stroke();
    if (item.values.length === 1) { ctx.beginPath(); ctx.arc((left + right) / 2, bottom - item.values[0] / max * (bottom - top), 3, 0, Math.PI * 2); ctx.fill(); }
  });
  ctx.font = '11px sans-serif'; ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.fillText(labels[0], left, bottom + 24);
  if (labels.length > 1) { ctx.textAlign = 'right'; ctx.fillText(labels.at(-1), right, bottom + 24); }
}
export function reportPng(title, lines, canvas, filename) {
  const image = document.createElement('canvas'); image.width = 1400;
  const ctx = image.getContext('2d'); ctx.font = '24px sans-serif';
  const wrapped = [];
  lines.forEach(line => {
    let part = '';
    for (const letter of line) {
      if (part && ctx.measureText(part + letter).width > 1260) { wrapped.push(part); part = ''; }
      part += letter;
    }
    wrapped.push(part);
  });
  image.height = 230 + wrapped.length * 38 + (canvas ? 600 : 40);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, image.width, image.height);
  ctx.fillStyle = '#294462'; ctx.font = 'bold 35px sans-serif'; ctx.fillText(title, 65, 70);
  ctx.font = '24px sans-serif'; ctx.fillStyle = '#536d88';
  wrapped.forEach((line, index) => ctx.fillText(line, 65, 125 + index * 38));
  if (canvas) {
    const data = chartContents.get(canvas), exportCanvas = document.createElement('canvas');
    if (data) drawLines(exportCanvas, data.labels, data.series, data.unit);
    ctx.drawImage(data ? exportCanvas : canvas, 50, 155 + wrapped.length * 38, 1300, 585);
  }
  ctx.font = '19px sans-serif'; ctx.fillStyle = '#64748b'; ctx.fillText('lifetoolanswer.com · 참고용 계산 결과', 65, image.height - 35);
  image.toBlob(blob => { if (blob) download(blob, filename); }, 'image/png');
}
