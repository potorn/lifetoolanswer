import { MAX_IMAGE_INPUT_BYTES, MAX_IMAGE_DIMENSION, MAX_IMAGE_PIXELS, validateImageBuffer } from './file-validation.js';

export const adjustmentDefaults = {
  brightness: 0, contrast: 0, exposure: 0, hue: 0, saturation: 0, vibrance: 0,
  black: 0, white: 255, gamma: 1, temperature: 0, tint: 0,
  red: 0, green: 0, blue: 0, posterize: 0, threshold: 128,
  grayscale: false, invert: false, sepia: false, thresholdOn: false
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Operate on RGB values only; preserve the input alpha channel.
export function adjustPixels(data, values) {
  const a = { ...adjustmentDefaults, ...values };
  const exposure = 2 ** a.exposure;
  const contrast = (100 + a.contrast) / Math.max(1, 100 - a.contrast);
  const range = Math.max(1, a.white - a.black);
  const angle = a.hue * Math.PI / 180, co = Math.cos(angle), si = Math.sin(angle);
  const hue = [
    .213 + co * .787 - si * .213, .715 - co * .715 - si * .715, .072 - co * .072 + si * .928,
    .213 - co * .213 + si * .143, .715 + co * .285 + si * .140, .072 - co * .072 - si * .283,
    .213 - co * .213 - si * .787, .715 - co * .715 + si * .715, .072 + co * .928 + si * .072
  ];
  const lut = new Float64Array(256);
  for (let i = 0; i < 256; i++) {
    const v = clamp((i - a.black) / range, 0, 1) ** (1 / a.gamma) * 255;
    lut[i] = ((v * exposure - 127.5) * contrast + 127.5) + a.brightness * 2.55;
  }
  for (let i = 0; i < data.length; i += 4) {
    let r = lut[data[i]], g = lut[data[i + 1]], b = lut[data[i + 2]];
    r += a.temperature * .8 + a.tint * .35 + a.red * 1.5;
    g += -a.tint * .5 + a.green * 1.5;
    b += -a.temperature * .8 + a.tint * .35 + a.blue * 1.5;
    if (a.hue) {
      const nr = r * hue[0] + g * hue[1] + b * hue[2];
      const ng = r * hue[3] + g * hue[4] + b * hue[5];
      b = r * hue[6] + g * hue[7] + b * hue[8]; r = nr; g = ng;
    }
    const luma = .2126 * r + .7152 * g + .0722 * b;
    const chroma = clamp((Math.max(r, g, b) - Math.min(r, g, b)) / 255, 0, 1);
    const saturation = Math.max(0, 1 + a.saturation / 100) * Math.max(0, 1 + a.vibrance / 100 * (1 - chroma));
    r = luma + (r - luma) * saturation; g = luma + (g - luma) * saturation; b = luma + (b - luma) * saturation;
    if (a.grayscale) r = g = b = .2126 * r + .7152 * g + .0722 * b;
    if (a.sepia) {
      const nr = .393 * r + .769 * g + .189 * b;
      const ng = .349 * r + .686 * g + .168 * b;
      b = .272 * r + .534 * g + .131 * b; r = nr; g = ng;
    }
    r = clamp(r, 0, 255); g = clamp(g, 0, 255); b = clamp(b, 0, 255);
    if (a.invert) { r = 255 - r; g = 255 - g; b = 255 - b; }
    if (a.posterize >= 2) {
      const steps = a.posterize - 1;
      r = Math.round(r / 255 * steps) / steps * 255;
      g = Math.round(g / 255 * steps) / steps * 255;
      b = Math.round(b / 255 * steps) / steps * 255;
    }
    if (a.thresholdOn) r = g = b = (.2126 * r + .7152 * g + .0722 * b >= a.threshold ? 255 : 0);
    data[i] = r; data[i + 1] = g; data[i + 2] = b;
  }
  return data;
}

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const canvas = $('editorCanvas'), surface = $('editorSurface'), overlay = $('cropOverlay');
  const fonts = {
    sans: '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif',
    serif: 'Batang, "AppleMyungjo", serif', mono: 'Consolas, monospace',
    arial: 'Arial, sans-serif', georgia: 'Georgia, serif'
  };
  let state = null, original = null, committed = null, past = [], future = [];
  let currentTab = 'crop', selectedText = '', crop = null, comparing = false;
  let sourceName = '', loadingId = 0, frame = 0, drag = null, nextTextId = 1;
  const downloadUrls = new Set();
  const snapshot = s => ({ base: s.base, adjustments: { ...s.adjustments }, texts: s.texts.map(t => ({ ...t })) });
  const same = (a, b) => a.base === b.base && JSON.stringify(a.adjustments) === JSON.stringify(b.adjustments) && JSON.stringify(a.texts) === JSON.stringify(b.texts);

  function status(message, error = false) {
    $('editorStatus').textContent = message;
    $('editorStatus').className = 'img-status ' + (error ? 'error' : 'success');
    $('editorStatus').hidden = !message;
  }
  function makeCanvas(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  function trimHistory() {
    // Count each shared immutable bitmap once, in addition to the original.
    function bytes() {
      const bases = new Set([original, state.base, ...past.map(s => s.base), ...future.map(s => s.base)]);
      return [...bases].reduce((sum, c) => sum + c.width * c.height * 4, 0);
    }
    while (past.length > 20 || (past.length && bytes() > 128 * 1024 * 1024)) past.shift();
  }
  function commit() {
    if (!state || same(state, committed)) return;
    past.push(committed); future = []; committed = snapshot(state);
    trimHistory(); updateHistory();
  }
  function updateHistory() {
    $('editorUndo').disabled = !past.length;
    $('editorRedo').disabled = !future.length;
  }
  function undo(redo = false) {
    if (!state) return;
    commit();
    const from = redo ? future : past, to = redo ? past : future;
    if (!from.length) return;
    to.push(snapshot(state)); state = snapshot(from.pop()); committed = snapshot(state);
    selectedText = state.texts.some(t => t.id === selectedText) ? selectedText : (state.texts.at(-1)?.id || '');
    comparing = false; resetCrop(); syncAll(); requestRender();
  }
  function syncAll() {
    document.querySelectorAll('[data-adjust]').forEach(input => {
      const value = state.adjustments[input.dataset.adjust];
      if (input.type === 'checkbox') input.checked = value;
      else { input.value = value; updateOutput(input); }
    });
    $('editorDimensions').textContent = `${state.base.width.toLocaleString()} × ${state.base.height.toLocaleString()} px`;
    $('exportWidth').value = state.base.width; $('exportHeight').value = state.base.height;
    $('editorCompare').setAttribute('aria-pressed', String(comparing));
    syncText(); updateHistory(); showOverlay();
  }
  function selectTab(tab) {
    commit(); currentTab = tab; comparing = false;
    document.querySelectorAll('[data-tab]').forEach(b => {
      const active = b.dataset.tab === tab;
      b.setAttribute('aria-selected', String(active)); b.tabIndex = active ? 0 : -1;
      $('panel-' + b.dataset.tab).hidden = !active;
    });
    $('editorHint').textContent = {
      crop: '드래그하거나 숫자를 입력해 자를 영역을 선택하세요.',
      adjust: '슬라이더를 움직이면 보정 결과를 바로 확인할 수 있습니다.',
      text: '텍스트를 선택하고 이미지 위에서 드래그해 위치를 옮기세요.',
      save: '크기와 품질을 정하고 다운로드하세요. 원본 파일은 바뀌지 않습니다.'
    }[tab];
    $('editorCompare').setAttribute('aria-pressed', 'false');
    showOverlay(); requestRender();
  }
  function leaveComparison() {
    comparing = false; $('editorCompare').setAttribute('aria-pressed', 'false'); showOverlay();
  }
  document.querySelectorAll('[data-tab]').forEach((button, index, buttons) => {
    button.addEventListener('click', () => selectTab(button.dataset.tab));
    button.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
      if (event.key === 'ArrowLeft') next = (index + buttons.length - 1) % buttons.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = buttons.length - 1;
      if (next === undefined) return;
      event.preventDefault(); buttons[next].focus(); selectTab(buttons[next].dataset.tab);
    });
  });
  $('openExport').addEventListener('click', () => { selectTab('save'); $('exportFormat').focus(); });

  const specs = [
    ['brightness', '밝기', -100, 100, 1, 'adjustmentControls'],
    ['contrast', '대비', -100, 100, 1, 'adjustmentControls'],
    ['exposure', '노출 (EV)', -3, 3, .1, 'adjustmentControls'],
    ['hue', '색조 (Hue)', -180, 180, 1, 'adjustmentControls'],
    ['saturation', '채도 (Saturation)', -100, 100, 1, 'adjustmentControls'],
    ['vibrance', '활기 (Vibrance)', -100, 100, 1, 'adjustmentControls'],
    ['black', '입력 검정점', 0, 254, 1, 'levelControls'],
    ['white', '입력 흰색점', 1, 255, 1, 'levelControls'],
    ['gamma', '중간톤 (Gamma)', .1, 3, .05, 'levelControls'],
    ['temperature', '색온도 · 차갑게 ↔ 따뜻하게', -100, 100, 1, 'effectControls'],
    ['tint', '색조 균형 · 초록 ↔ 자홍', -100, 100, 1, 'effectControls'],
    ['red', '빨강 균형', -100, 100, 1, 'effectControls'],
    ['green', '초록 균형', -100, 100, 1, 'effectControls'],
    ['blue', '파랑 균형', -100, 100, 1, 'effectControls'],
    ['posterize', '포스터화 · 채널별 단계', 0, 16, 1, 'effectControls'],
    ['threshold', '임계값', 0, 255, 1, 'effectControls']
  ];
  specs.forEach(([key, name, min, max, step, parent]) => {
    const label = document.createElement('label'); label.className = 'editor-range-label'; label.htmlFor = 'adjust-' + key;
    const title = document.createElement('span'); title.textContent = name;
    const output = document.createElement('output'); output.id = 'value-' + key; output.htmlFor = 'adjust-' + key;
    label.append(title, output);
    const input = document.createElement('input'); input.type = 'range'; input.id = 'adjust-' + key; input.dataset.adjust = key;
    input.min = min; input.max = max; input.step = step; input.value = adjustmentDefaults[key];
    $(parent).append(label, input); updateOutput(input);
  });
  function updateOutput(input) {
    const key = input.dataset.adjust;
    $('value-' + key).textContent = key === 'posterize' && +input.value < 2 ? '끄기' : input.value;
    updateRangeTrack(input);
  }
  function updateRangeTrack(input) {
    const progress = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100;
    input.style.setProperty('--range-progress', clamp(progress, 0, 100) + '%');
  }
  document.querySelectorAll('[data-adjust]').forEach(input => {
    input.addEventListener('input', () => {
      if (!state) return;
      const key = input.dataset.adjust;
      let value = input.type === 'checkbox' ? input.checked : Number(input.value);
      if (key === 'black') value = Math.min(value, state.adjustments.white - 1);
      if (key === 'white') value = Math.max(value, state.adjustments.black + 1);
      state.adjustments[key] = value;
      leaveComparison();
      if (input.type !== 'checkbox') { input.value = value; updateOutput(input); }
      requestRender();
    });
    input.addEventListener('change', commit);
  });
  $('resetAdjustments').addEventListener('click', () => {
    leaveComparison();
    state.adjustments = { ...adjustmentDefaults }; commit(); syncAll(); requestRender();
  });

  function paintText(ctx, t, scale) {
    ctx.font = `${t.bold ? '700' : '400'} ${t.size * scale}px ${fonts[t.font] || fonts.sans}`;
    ctx.textAlign = t.align; ctx.textBaseline = 'top'; ctx.lineJoin = 'round';
    ctx.fillStyle = t.color; ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(1, t.size / 16) * scale;
    t.content.split('\n').forEach((line, i) => {
      const x = t.x * scale, y = (t.y + i * t.size * 1.25) * scale;
      if (t.outline) ctx.strokeText(line, x, y);
      ctx.fillText(line, x, y);
    });
  }
  function renderImage(target, sourceState, maxSide = Infinity) {
    const scale = Math.min(1, maxSide / Math.max(sourceState.base.width, sourceState.base.height));
    target.width = Math.max(1, Math.round(sourceState.base.width * scale));
    target.height = Math.max(1, Math.round(sourceState.base.height * scale));
    const ctx = target.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(sourceState.base, 0, 0, target.width, target.height);
    if (JSON.stringify(sourceState.adjustments) !== JSON.stringify(adjustmentDefaults)) {
      const image = ctx.getImageData(0, 0, target.width, target.height);
      adjustPixels(image.data, sourceState.adjustments); ctx.putImageData(image, 0, 0);
    }
    sourceState.texts.forEach(t => paintText(ctx, t, scale));
    return target;
  }
  function textBounds(t) {
    const ctx = canvas.getContext('2d');
    ctx.font = `${t.bold ? '700' : '400'} ${t.size}px ${fonts[t.font]}`;
    const width = Math.max(1, ...t.content.split('\n').map(line => ctx.measureText(line).width));
    return { x: t.x - (t.align === 'center' ? width / 2 : t.align === 'right' ? width : 0), y: t.y, w: width, h: t.size * 1.25 * t.content.split('\n').length };
  }
  function requestRender() {
    if (!state || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (comparing) renderImage(canvas, { base: original, adjustments: adjustmentDefaults, texts: [] }, 1400);
      else {
        renderImage(canvas, state, 1400);
        const t = state.texts.find(t => t.id === selectedText);
        if (currentTab === 'text' && t) {
          const box = textBounds(t), scale = canvas.width / state.base.width;
          const ctx = canvas.getContext('2d'); ctx.save(); ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
          ctx.strokeRect(box.x * scale - 4, box.y * scale - 4, box.w * scale + 8, box.h * scale + 8); ctx.restore();
        }
      }
      $('previewLabel').textContent = comparing ? '원본 이미지' : '편집 미리보기';
      fitSurface();
    });
  }
  function fitSurface() {
    if (!state) return;
    const stage = $('editorStage'), padding = window.innerWidth <= 800 ? 24 : 36;
    const scale = Math.min((stage.clientWidth - padding) / canvas.width, (stage.clientHeight - padding) / canvas.height, 1);
    surface.style.width = Math.max(1, Math.floor(canvas.width * scale)) + 'px';
    surface.style.height = Math.max(1, Math.floor(canvas.height * scale)) + 'px';
  }
  new ResizeObserver(fitSurface).observe($('editorStage'));

  function ratio() {
    return $('cropRatio').value === 'original' ? state.base.width / state.base.height : Number($('cropRatio').value) || 0;
  }
  function resetCrop() {
    if (!state) return;
    const w = state.base.width, h = state.base.height, r = ratio();
    let cw = w, ch = h;
    if (r) { cw = Math.min(w, h * r); ch = cw / r; }
    crop = { x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch };
    document.querySelectorAll('[name="editorCropRatio"]').forEach(input => { input.checked = input.value === $('cropRatio').value; });
    syncCrop();
  }
  function syncCrop() {
    if (!crop) return;
    const w = state.base.width, h = state.base.height;
    $('cropBox').style.cssText = `left:${crop.x / w * 100}%;top:${crop.y / h * 100}%;width:${crop.w / w * 100}%;height:${crop.h / h * 100}%;`;
    ['x', 'y', 'w', 'h'].forEach(key => { $('crop' + key.toUpperCase()).value = Math.round(crop[key]); });
  }
  function showOverlay() { overlay.hidden = currentTab !== 'crop' || comparing; }
  $('cropRatio').addEventListener('change', resetCrop);
  document.querySelectorAll('[name="editorCropRatio"]').forEach(input => {
    input.addEventListener('change', () => { $('cropRatio').value = input.value; resetCrop(); });
  });
  $('resetCrop').addEventListener('click', resetCrop);
  ['x', 'y', 'w', 'h'].forEach(key => {
    $('crop' + key.toUpperCase()).addEventListener('change', event => {
      const value = Number(event.target.value), w = state.base.width, h = state.base.height, r = ratio();
      if (!Number.isFinite(value)) { syncCrop(); return; }
      crop[key] = clamp(Math.round(value), key === 'x' || key === 'y' ? 0 : 1, key === 'x' || key === 'w' ? w : h);
      if (r && key === 'w') crop.h = crop.w / r;
      if (r && key === 'h') crop.w = crop.h * r;
      const scale = Math.min(1, w / crop.w, h / crop.h);
      crop.w *= scale; crop.h *= scale;
      crop.x = clamp(crop.x, 0, w - crop.w); crop.y = clamp(crop.y, 0, h - crop.h); syncCrop();
    });
  });
  function point(event) {
    const rect = surface.getBoundingClientRect();
    return { x: clamp((event.clientX - rect.left) / rect.width * state.base.width, 0, state.base.width), y: clamp((event.clientY - rect.top) / rect.height * state.base.height, 0, state.base.height) };
  }
  overlay.addEventListener('pointerdown', event => {
    if (event.button !== 0 || drag) return;
    event.preventDefault(); overlay.setPointerCapture(event.pointerId);
    const p = point(event), handle = event.target.dataset.handle;
    drag = { type: 'crop', pointer: event.pointerId, p, start: { ...crop }, mode: handle || ($('cropBox').contains(event.target) ? 'move' : 'new') };
  });
  overlay.addEventListener('pointermove', event => {
    if (!drag || drag.type !== 'crop' || event.pointerId !== drag.pointer) return;
    const p = point(event), s = drag.start, mode = drag.mode;
    const w = state.base.width, h = state.base.height, r = ratio();
    if (mode === 'move') {
      crop.x = clamp(s.x + p.x - drag.p.x, 0, w - crop.w); crop.y = clamp(s.y + p.y - drag.p.y, 0, h - crop.h);
    } else {
      const sx = mode === 'new' ? (p.x >= drag.p.x ? 1 : -1) : mode.includes('w') ? -1 : 1;
      const sy = mode === 'new' ? (p.y >= drag.p.y ? 1 : -1) : mode.includes('n') ? -1 : 1;
      const ax = mode === 'new' ? drag.p.x : sx < 0 ? s.x + s.w : s.x;
      const ay = mode === 'new' ? drag.p.y : sy < 0 ? s.y + s.h : s.y;
      let cw = mode === 'n' || mode === 's' ? s.w : Math.max(1, sx * (p.x - ax));
      let ch = mode === 'e' || mode === 'w' ? s.h : Math.max(1, sy * (p.y - ay));
      if (r) {
        if (mode === 'n' || mode === 's') cw = ch * r;
        else if (mode === 'e' || mode === 'w') ch = cw / r;
        else if (cw / ch > r) ch = cw / r; else cw = ch * r;
      }
      const availableW = sx < 0 ? ax : w - ax, availableH = sy < 0 ? ay : h - ay;
      if (availableW <= 0 || availableH <= 0) return;
      if (r) { const fit = Math.min(1, availableW / cw, availableH / ch); cw *= fit; ch *= fit; }
      else { cw = Math.min(cw, availableW); ch = Math.min(ch, availableH); }
      crop = { x: sx < 0 ? ax - cw : ax, y: sy < 0 ? ay - ch : ay, w: cw, h: ch };
    }
    syncCrop();
  });
  function endDrag(event) {
    if (!drag || (event && event.pointerId !== drag.pointer)) return;
    const isText = drag.type === 'text'; drag = null;
    if (isText) { commit(); syncText(); requestRender(); }
  }
  [overlay, canvas].forEach(el => {
    el.addEventListener('pointerup', endDrag); el.addEventListener('pointercancel', endDrag); el.addEventListener('lostpointercapture', endDrag);
  });

  function geometry(transform) {
    commit(); comparing = false;
    try {
      const flat = renderImage(makeCanvas(1, 1), state);
      let next;
      if (transform === 'crop') {
        const x = clamp(Math.round(crop.x), 0, flat.width - 1), y = clamp(Math.round(crop.y), 0, flat.height - 1);
        const w = clamp(Math.round(crop.w), 1, flat.width - x), h = clamp(Math.round(crop.h), 1, flat.height - y);
        next = makeCanvas(w, h); next.getContext('2d').drawImage(flat, x, y, w, h, 0, 0, w, h);
      } else {
        const rotate = transform === 'left' || transform === 'right';
        next = makeCanvas(rotate ? flat.height : flat.width, rotate ? flat.width : flat.height);
        const ctx = next.getContext('2d'); ctx.translate(next.width / 2, next.height / 2);
        if (rotate) ctx.rotate((transform === 'left' ? -1 : 1) * Math.PI / 2);
        else ctx.scale(transform === 'horizontal' ? -1 : 1, transform === 'vertical' ? -1 : 1);
        ctx.drawImage(flat, -flat.width / 2, -flat.height / 2);
      }
      state = { base: next, adjustments: { ...adjustmentDefaults }, texts: [] }; selectedText = '';
      commit(); resetCrop(); syncAll(); requestRender(); status('적용했습니다. 보정과 텍스트를 이미지에 합쳤습니다. 실행 취소로 되돌릴 수 있습니다.');
    } catch { status('이미지 처리에 실패했습니다. 더 작은 이미지로 다시 시도해 주세요.', true); }
  }
  $('applyCrop').addEventListener('click', () => geometry('crop'));
  document.querySelectorAll('[data-transform]').forEach(b => b.addEventListener('click', () => geometry(b.dataset.transform)));

  function activeText() { return state?.texts.find(t => t.id === selectedText); }
  function syncText() {
    const select = $('textLayer'); select.replaceChildren();
    state.texts.forEach((t, i) => { const option = document.createElement('option'); option.value = t.id; option.textContent = `${i + 1}. ${t.content.slice(0, 24) || '(빈 텍스트)'}`; select.append(option); });
    if (!state.texts.length) { const option = document.createElement('option'); option.value = ''; option.textContent = '텍스트를 추가하세요'; select.append(option); }
    select.value = selectedText;
    const t = activeText(); $('textFields').disabled = !t;
    if (!t) return;
    $('textContent').value = t.content; $('textFont').value = t.font; $('textSize').value = t.size; $('textColor').value = t.color;
    $('textColorValue').textContent = t.color.toUpperCase();
    $('textAlign').value = t.align; $('textBold').checked = t.bold; $('textOutline').checked = t.outline;
    syncTextPosition(t);
  }
  function syncTextPosition(t) {
    $('textX').value = (t.x / state.base.width * 100).toFixed(1);
    $('textY').value = (t.y / state.base.height * 100).toFixed(1);
  }
  $('addText').addEventListener('click', () => {
    if (state.texts.length >= 20) return status('텍스트는 최대 20개까지 추가할 수 있습니다.', true);
    commit(); leaveComparison();
    const t = { id: 'text-' + nextTextId++, content: '텍스트를 입력하세요', font: 'sans', size: clamp(Math.round(state.base.width / 16), 8, 600), color: '#ffffff', align: 'left', bold: true, outline: true, x: state.base.width * .1, y: state.base.height * .2 };
    state.texts.push(t); selectedText = t.id; commit(); syncText(); requestRender(); $('textContent').focus(); $('textContent').select();
  });
  $('textLayer').addEventListener('change', () => { commit(); selectedText = $('textLayer').value; syncText(); requestRender(); });
  const textBindings = { textContent: 'content', textFont: 'font', textSize: 'size', textColor: 'color', textAlign: 'align', textBold: 'bold', textOutline: 'outline', textX: 'x', textY: 'y' };
  Object.entries(textBindings).forEach(([id, key]) => {
    const input = $(id);
    input.addEventListener('input', () => {
      const t = activeText(); if (!t) return;
      let value = input.type === 'checkbox' ? input.checked : input.value;
      if (key === 'size') value = clamp(Number(value) || 8, 8, 600);
      if (key === 'x' || key === 'y') value = clamp(Number(value) || 0, 0, 100) / 100 * (key === 'x' ? state.base.width : state.base.height);
      t[key] = value; requestRender();
      if (key === 'color') $('textColorValue').textContent = value.toUpperCase();
      leaveComparison();
    });
    input.addEventListener('change', () => { commit(); syncText(); });
  });
  $('deleteText').addEventListener('click', () => {
    commit(); leaveComparison(); state.texts = state.texts.filter(t => t.id !== selectedText); selectedText = state.texts.at(-1)?.id || '';
    commit(); syncText(); requestRender();
  });
  canvas.addEventListener('pointerdown', event => {
    if (!state || comparing || currentTab !== 'text' || event.button !== 0 || drag) return;
    const p = point(event), tolerance = state.base.width / surface.clientWidth * 8;
    const t = [...state.texts].reverse().find(t => {
      const b = textBounds(t); return p.x >= b.x - tolerance && p.x <= b.x + b.w + tolerance && p.y >= b.y - tolerance && p.y <= b.y + b.h + tolerance;
    });
    if (!t) return;
    event.preventDefault(); commit(); selectedText = t.id; syncText(); canvas.setPointerCapture(event.pointerId);
    drag = { type: 'text', pointer: event.pointerId, p, x: t.x, y: t.y }; requestRender();
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag || drag.type !== 'text' || event.pointerId !== drag.pointer) return;
    const p = point(event), t = activeText(); if (!t) return;
    t.x = clamp(drag.x + p.x - drag.p.x, 0, state.base.width); t.y = clamp(drag.y + p.y - drag.p.y, 0, state.base.height);
    syncTextPosition(t); requestRender();
  });

  async function loadFile(file) {
    const id = ++loadingId;
    if (file.size > MAX_IMAGE_INPUT_BYTES) return status('이미지 파일은 최대 25MB까지 지원합니다.', true);
    status('이미지를 브라우저에서 여는 중입니다…');
    let url;
    try {
      const bytes = await file.arrayBuffer(); if (id !== loadingId) return;
      const valid = validateImageBuffer(bytes, file.name, ['png', 'jpeg', 'webp', 'avif', 'bmp']);
      if (!valid.ok) throw new Error('PNG·JPEG·WebP·AVIF·BMP 파일을 선택해 주세요. GIF는 GIF 만들기를 이용하세요.');
      url = URL.createObjectURL(file);
      const img = new Image(); img.src = url; await img.decode(); if (id !== loadingId) return;
      if (img.naturalWidth > MAX_IMAGE_DIMENSION || img.naturalHeight > MAX_IMAGE_DIMENSION || img.naturalWidth * img.naturalHeight > MAX_IMAGE_PIXELS) throw new Error('이미지는 가로·세로 최대 4,096px, 1,600만 픽셀까지 지원합니다. 포맷 변환기에서 먼저 줄여 주세요.');
      original = makeCanvas(img.naturalWidth, img.naturalHeight); original.getContext('2d').drawImage(img, 0, 0);
      state = { base: original, adjustments: { ...adjustmentDefaults }, texts: [] };
      committed = snapshot(state); past = []; future = []; selectedText = ''; comparing = false; drag = null;
      sourceName = file.name; $('editorFilename').textContent = file.name;
      $('editorUpload').classList.add('has-file');
      $('editorWorkbench').hidden = false; $('cropRatio').value = 'free'; resetCrop(); syncAll(); selectTab('crop');
      status('이미지를 불러왔습니다. 애니메이션 이미지는 정지된 한 프레임으로 편집·저장합니다.');
    } catch (error) { if (id === loadingId) status(error.message || '이미지를 열 수 없습니다. 다른 파일을 선택해 주세요.', true); }
    finally { if (url) URL.revokeObjectURL(url); }
  }
  $('editorFile').addEventListener('change', event => { if (event.target.files[0]) loadFile(event.target.files[0]); event.target.value = ''; });
  $('changeImage').addEventListener('click', () => $('editorFile').click());
  $('editorDemo').addEventListener('click', async () => {
    const id = ++loadingId;
    $('editorDemo').disabled = true; status('샘플 이미지를 불러오는 중입니다…');
    try {
      const response = await fetch(new URL('../img/hero-tools.png', import.meta.url));
      if (!response.ok) throw new Error('샘플 이미지를 불러오지 못했습니다. 기기의 이미지를 선택해 주세요.');
      const blob = await response.blob();
      if (id === loadingId) await loadFile(new File([blob], '샘플 이미지.png', { type: 'image/png' }));
    } catch (error) { if (id === loadingId) status(error.message, true); }
    finally { $('editorDemo').disabled = false; }
  });
  $('editorUpload').addEventListener('dragover', event => { event.preventDefault(); $('editorUpload').classList.add('drag-over'); });
  $('editorUpload').addEventListener('dragleave', () => $('editorUpload').classList.remove('drag-over'));
  $('editorUpload').addEventListener('drop', event => { event.preventDefault(); $('editorUpload').classList.remove('drag-over'); if (event.dataTransfer.files[0]) loadFile(event.dataTransfer.files[0]); });
  $('editorUndo').addEventListener('click', () => undo()); $('editorRedo').addEventListener('click', () => undo(true));
  document.addEventListener('keydown', event => {
    if (!state || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(event.shiftKey); }
  });
  $('editorCompare').addEventListener('click', () => {
    commit(); comparing = !comparing; $('editorCompare').setAttribute('aria-pressed', String(comparing));
    showOverlay(); requestRender();
  });
  $('editorReset').addEventListener('click', () => {
    commit(); state = { base: original, adjustments: { ...adjustmentDefaults }, texts: [] }; selectedText = ''; comparing = false;
    commit(); resetCrop(); syncAll(); requestRender(); status('처음 이미지로 돌아왔습니다. 실행 취소로 이전 편집을 복원할 수 있습니다.');
  });

  $('exportFormat').addEventListener('change', () => {
    $('exportQualityGroup').hidden = $('exportFormat').value === 'png';
    $('exportBackgroundGroup').hidden = $('exportFormat').value !== 'jpeg';
  });
  updateRangeTrack($('exportQuality'));
  $('exportQuality').addEventListener('input', () => { $('exportQualityValue').value = $('exportQuality').value + '%'; updateRangeTrack($('exportQuality')); });
  ['Width', 'Height'].forEach(axis => $('export' + axis).addEventListener('input', () => {
    if (!$('exportAspect').checked || !$('export' + axis).value) return;
    const w = state.base.width, h = state.base.height;
    $('export' + (axis === 'Width' ? 'Height' : 'Width')).value = Math.max(1, Math.round(Number($('export' + axis).value) * (axis === 'Width' ? h / w : w / h)));
  }));
  $('exportAspect').addEventListener('change', () => { if ($('exportAspect').checked) $('exportHeight').value = Math.max(1, Math.round(Number($('exportWidth').value) * state.base.height / state.base.width)); });
  $('exportImage').addEventListener('click', async () => {
    const w = Number($('exportWidth').value), h = Number($('exportHeight').value), format = $('exportFormat').value;
    if (![w, h].every(n => Number.isInteger(n) && n > 0 && n <= MAX_IMAGE_DIMENSION) || w * h > MAX_IMAGE_PIXELS) return status('저장 크기는 가로·세로 1~4,096px, 1,600만 픽셀 이내의 정수로 입력해 주세요.', true);
    commit(); $('exportImage').disabled = true; status('저장할 이미지를 만드는 중입니다…');
    const filename = sourceName.replace(/\.[^.]+$/, '') + '-edited.' + (format === 'jpeg' ? 'jpg' : format);
    try {
      const flat = renderImage(makeCanvas(1, 1), state), output = makeCanvas(w, h), ctx = output.getContext('2d');
      if (format === 'jpeg') { ctx.fillStyle = $('exportBackground').value; ctx.fillRect(0, 0, w, h); }
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(flat, 0, 0, w, h);
      const mime = 'image/' + format;
      const blob = await new Promise(resolve => output.toBlob(resolve, mime, Number($('exportQuality').value) / 100));
      if (!blob || blob.type !== mime) throw new Error('이 브라우저에서 선택한 포맷으로 저장할 수 없습니다. PNG를 이용해 주세요.');
      const url = URL.createObjectURL(blob); downloadUrls.add(url);
      const link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
      setTimeout(() => { URL.revokeObjectURL(url); downloadUrls.delete(url); }, 60000);
      status(`${w} × ${h}px ${format.toUpperCase()} 이미지를 저장했습니다. (${(blob.size / 1024).toFixed(1)}KB)`);
    } catch (error) { status(error.message || '저장하지 못했습니다. 크기를 줄여 다시 시도해 주세요.', true); }
    finally { $('exportImage').disabled = false; }
  });
  window.addEventListener('beforeunload', () => { downloadUrls.forEach(url => URL.revokeObjectURL(url)); });
});
