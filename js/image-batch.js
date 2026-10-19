import { validateImageBuffer, MAX_IMAGE_INPUT_BYTES, isSafeOutputSize } from './file-validation.js';
import { makeZip } from './zip-store.js';

export function batchSize(width, height, w, h, keep) {
  if (!w && !h) return [width, height];
  if (keep) {
    const scale = Math.min(w ? w / width : Infinity, h ? h / height : Infinity);
    return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
  }
  return [w || width, h || height];
}
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  let files = [], results = [], worker = null, pending = null, busy = false, generation = 0, sequence = 0;
  const size = n => (n / 1024).toFixed(1) + ' KB';
  const status = message => { $('batchStatus').textContent = message; };
  function download(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function stop(message = '작업이 취소되었습니다.') {
    if (worker) worker.terminate(); worker = null;
    if (pending) { clearTimeout(pending.timer); pending.reject(new Error(message)); pending = null; }
  }
  function ask(options, transfer) {
    if (!worker) {
      worker = new Worker('../js/image-worker.js?v=20261019-media1', { type: 'module' });
      worker.onmessage = ({ data }) => { if (!pending || data.id !== pending.id) return; const p = pending; pending = null; clearTimeout(p.timer); data.ok ? p.resolve(data) : p.reject(new Error(data.error)); };
      worker.onerror = () => stop('변환 엔진을 실행하지 못했습니다. 다시 시도해 주세요.');
    }
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      pending = { id, resolve, reject, timer: setTimeout(() => stop('처리 시간이 초과되었습니다. 크기를 줄여 다시 시도하세요.'), 90000) };
      worker.postMessage({ ...options, id }, transfer);
    });
  }
  function lock(value) {
    busy = value; $('batchSettings').disabled = value; $('batchFiles').disabled = value;
    $('batchConvert').disabled = value || !files.length; $('batchCancel').hidden = !value;
    $('batchZip').disabled = value || !results.length;
  }
  $('batchFiles').addEventListener('change', () => {
    const selected = Array.from($('batchFiles').files); $('batchFiles').value = '';
    if (selected.length > 20 || selected.reduce((sum, f) => sum + f.size, 0) > 100 * 1024 * 1024 || selected.some(f => f.size > MAX_IMAGE_INPUT_BYTES)) return status('최대 20장, 파일당 25MB, 전체 100MB까지 선택하세요.');
    files = selected; results = []; $('batchRows').replaceChildren(); $('batchSummary').textContent = ''; lock(false);
    status(files.length + '장 선택됨. 같은 포맷과 크기 설정으로 변환합니다.');
  });
  $('batchCancel').addEventListener('click', () => { generation++; stop(); $('batchRows').querySelectorAll('tr').forEach(row => { if (row.children[2].textContent === '처리 중') row.children[2].textContent = '취소됨'; }); lock(false); status('취소했습니다. 완료된 파일은 저장할 수 있습니다.'); });
  $('batchConvert').addEventListener('click', async () => {
    if (busy || !files.length) return;
    const w = Number($('batchWidth').value), h = Number($('batchHeight').value);
    if (['batchWidth', 'batchHeight'].some(id => $(id).value !== '' && (!Number.isInteger(Number($(id).value)) || Number($(id).value) < 1 || Number($(id).value) > 4096))) return status('크기는 1~4,096px 정수로 입력하거나 비워 두세요.');
    const format = $('batchFormat').value, quality = Number($('batchQuality').value), keep = $('batchAspect').checked;
    if (!Number.isInteger(quality) || quality < 1 || quality > 100) return status('품질은 1~100 사이 정수로 입력하세요.');
    const token = ++generation; results = []; $('batchRows').replaceChildren(); $('batchSummary').textContent = ''; lock(true);
    let inputTotal = 0, outputTotal = 0, failures = 0;
    for (let i = 0; i < files.length; i++) {
      if (token !== generation) break;
      const file = files[i], row = document.createElement('tr');
      const cells = [file.name, size(file.size), '처리 중', ''];
      cells.forEach(text => { const td = document.createElement('td'); td.textContent = text; row.append(td); }); $('batchRows').append(row);
      status((i + 1) + ' / ' + files.length + ' 변환 중…');
      try {
        const bytes = await file.arrayBuffer(); if (token !== generation) break;
        const valid = validateImageBuffer(bytes, file.name); if (!valid.ok) throw new Error(valid.error);
        const info = await ask({ action: 'inspect', bytes, fileName: file.name }, []);
        if (token !== generation) break;
        const [width, height] = batchSize(info.width, info.height, w, h, keep);
        if (!isSafeOutputSize(width, height, format === 'webp' ? info.frames : 1)) throw new Error('출력 크기·프레임 제한을 초과했습니다. 크기를 줄여 주세요.');
        const converted = await ask({ action: 'convert', bytes, fileName: file.name, format, quality, width, height, preserveAnimation: format === 'webp' && info.frames > 1 }, [bytes]);
        if (token !== generation) break;
        const blob = new Blob([converted.bytes], { type: converted.mime });
        if (outputTotal + blob.size > 100 * 1024 * 1024) throw new Error('결과 합계 100MB 제한을 초과했습니다.');
        const stem = file.name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 100) || 'image';
        const name = String(i + 1).padStart(2, '0') + '-' + stem + '.' + (format === 'jpeg' ? 'jpg' : format);
        results.push({ name, blob }); inputTotal += file.size; outputTotal += blob.size;
        row.children[2].textContent = `${size(blob.size)} · ${width} × ${height}${info.frames > 1 ? (converted.preservedAnimation ? ' · 움직임 보존' : ' · 첫 프레임') : ''}`;
        const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = '저장'; btn.addEventListener('click', () => download(blob, name)); row.children[3].append(btn);
      } catch (error) { if (token !== generation) break; failures++; row.children[2].textContent = error.message || '변환 실패'; }
    }
    if (token !== generation) return;
    stop(); lock(false);
    $('batchSummary').textContent = results.length ? `성공 ${results.length}장: 원본 ${size(inputTotal)} → 결과 ${size(outputTotal)} (${outputTotal <= inputTotal ? '감소' : '증가'} ${Math.abs((1 - outputTotal / inputTotal) * 100).toFixed(1)}%)` : '성공한 파일이 없습니다.';
    status(`완료: 성공 ${results.length}장 / 실패 ${failures}장. ZIP에는 성공한 파일만 포함됩니다.`);
  });
  $('batchZip').addEventListener('click', async () => {
    $('batchZip').disabled = true;
    // Snapshot results so replacing a selection cannot change an archive in flight.
    try { download(await makeZip(results.slice()), 'converted-images.zip'); status('ZIP 파일을 저장했습니다.'); }
    catch { status('ZIP 생성에 실패했습니다. 개별 저장을 이용하세요.'); }
    finally { $('batchZip').disabled = busy || !results.length; }
  });
  window.addEventListener('beforeunload', () => stop());
});
