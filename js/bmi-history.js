document.addEventListener('DOMContentLoaded', function () {
  'use strict';
  var KEY = 'lifetoolanswer.bmi.history.v1';
  var records = [];
  var storageReady = true;
  var el = function (id) { return document.getElementById(id); };
  var today = localDate(new Date());
  el('recordDate').value = today;
  el('recordDate').max = today;

  function localDate(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function validRecord(record) {
    if (!record || typeof record.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) return false;
    var parsed = new Date(record.date + 'T12:00:00');
    return Number.isFinite(parsed.getTime()) && localDate(parsed) === record.date && record.date >= '1900-01-01' && record.date <= today &&
      typeof record.height === 'number' && Number.isFinite(record.height) && record.height >= 50 && record.height <= 280 &&
      typeof record.weight === 'number' && Number.isFinite(record.weight) && record.weight >= 10 && record.weight <= 600;
  }
  function clean(list) {
    if (!Array.isArray(list) || list.length > 50000 || !list.every(validRecord)) throw new Error('invalid');
    var dates = new Set();
    return list.map(function (record) {
      if (dates.has(record.date)) throw new Error('duplicate');
      dates.add(record.date);
      return { date: record.date, height: record.height, weight: record.weight };
    }).sort(function (a, b) { return a.date.localeCompare(b.date); });
  }
  function status(text) { el('historyStatus').textContent = text; }
  try {
    var raw = localStorage.getItem(KEY);
    if (raw !== null) {
      var saved = JSON.parse(raw);
      if (!saved || saved.version !== 1) throw new Error('version');
      records = clean(saved.records);
    }
  } catch (error) {
    storageReady = false;
    status('저장된 기록을 읽을 수 없습니다. 브라우저 저장 권한이나 사이트 데이터를 확인하세요. 기존 데이터를 보호하기 위해 저장·삭제·불러오기를 중단했습니다.');
  }
  function persist(next) {
    if (!storageReady) { status('브라우저 저장소를 사용할 수 없습니다. 저장 권한과 사이트 데이터를 확인하세요.'); return false; }
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, records: next }));
      records = next;
      return true;
    } catch (error) {
      status('기록을 저장하지 못했습니다. 저장 공간과 브라우저 권한을 확인하고, 기존 기록을 백업하세요.');
      return false;
    }
  }
  function bmi(record) { return record.weight / Math.pow(record.height / 100, 2); }
  function selected() {
    var period = el('historyPeriod').value;
    return records.filter(function (record) { return period === 'all' || record.date.slice(0, 7) === period; });
  }
  function periodLabel() {
    var period = el('historyPeriod').value;
    return period === 'all' ? '전체 기록' : period.slice(0, 4) + '년 ' + Number(period.slice(5)) + '월 기록';
  }
  function summary(list) {
    var first = list[0], last = list[list.length - 1];
    var change = last.weight - first.weight;
    return [list.length + '일', first.weight + ' → ' + last.weight + ' kg', (change > 0 ? '+' : '') + change.toFixed(1) + ' kg'];
  }
  function render() {
    var previous = el('historyPeriod').value;
    var select = el('historyPeriod');
    select.replaceChildren(new Option('전체 기록', 'all'));
    Array.from(new Set(records.map(function (record) { return record.date.slice(0, 7); }))).sort().reverse().forEach(function (month) {
      select.add(new Option(month.slice(0, 4) + '년 ' + Number(month.slice(5)) + '월', month));
    });
    select.value = Array.from(select.options).some(function (option) { return option.value === previous; }) ? previous : 'all';
    var list = selected();
    el('historyReportTitle').textContent = '생활도구 · ' + periodLabel();
    el('exportPdf').textContent = periodLabel() + ' PDF / 인쇄';
    el('historySummary').replaceChildren();
    el('historyRows').replaceChildren();
    el('historyEmpty').hidden = list.length > 0;
    ['historyChart', 'historyTable', 'historyChartNote'].forEach(function (id) { el(id).hidden = list.length === 0; });
    ['exportPng', 'exportPdf', 'exportBackup'].forEach(function (id) { el(id).disabled = list.length === 0; });
    if (!list.length) return;
    var values = summary(list);
    ['기록한 날짜', '첫 기록 → 마지막 체중', '기간 내 체중 변화'].forEach(function (label, index) {
      var box = document.createElement('div'), title = document.createElement('span'), value = document.createElement('strong');
      title.textContent = label; value.textContent = values[index]; box.append(title, value); el('historySummary').append(box);
    });
    var fragment = document.createDocumentFragment();
    list.slice().reverse().forEach(function (record) {
      var row = document.createElement('tr');
      [record.date, record.height, record.weight, bmi(record).toFixed(1)].forEach(function (value) {
        var cell = document.createElement('td'); cell.textContent = value; row.append(cell);
      });
      var action = document.createElement('td'), button = document.createElement('button');
      action.className = 'bmi-no-print'; button.type = 'button'; button.textContent = '삭제';
      button.setAttribute('aria-label', record.date + ' 기록 삭제');
      button.disabled = !storageReady;
      button.addEventListener('click', function () {
        if (!confirm(record.date + ' 기록을 삭제할까요?')) return;
        if (persist(records.filter(function (item) { return item.date !== record.date; }))) { render(); status('기록을 삭제했습니다.'); }
      });
      action.append(button); row.append(action); fragment.append(row);
    });
    el('historyRows').append(fragment);
    drawChart(el('historyChart'), list);
  }
  function drawChart(canvas, list) {
    var ctx = canvas.getContext('2d'), width = canvas.width, height = canvas.height;
    var metric = el('chartMetric').value, isWeight = metric === 'weight';
    var values = list.map(function (record) { return isWeight ? record.weight : bmi(record); });
    var low = Math.min.apply(null, values), high = Math.max.apply(null, values);
    var padding = Math.max((high - low) * 0.2, isWeight ? 1 : 0.5);
    low = Math.max(0, low - padding); high += padding;
    var left = 110, right = width - 65, top = 65, bottom = height - 75;
    var firstTime = Date.parse(list[0].date + 'T00:00:00Z');
    var lastTime = Date.parse(list[list.length - 1].date + 'T00:00:00Z');
    function x(record) { return lastTime === firstTime ? (left + right) / 2 : left + (Date.parse(record.date + 'T00:00:00Z') - firstTime) / (lastTime - firstTime) * (right - left); }
    function y(value) { return bottom - (value - low) / (high - low) * (bottom - top); }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
    ctx.font = '22px sans-serif'; ctx.fillStyle = '#64748b'; ctx.textAlign = 'left';
    ctx.fillText(isWeight ? '체중 (kg)' : 'BMI', left, 33);
    for (var i = 0; i <= 4; i++) {
      var value = low + (high - low) * i / 4, lineY = y(value);
      ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(left, lineY); ctx.lineTo(right, lineY); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillStyle = '#64748b'; ctx.fillText(value.toFixed(1), left - 16, lineY + 7);
    }
    ctx.strokeStyle = '#3678cf'; ctx.lineWidth = 4; ctx.beginPath();
    list.forEach(function (record, index) { if (index === 0) ctx.moveTo(x(record), y(values[index])); else ctx.lineTo(x(record), y(values[index])); });
    ctx.stroke();
    // Dense histories keep the line readable; all exact values remain in the table.
    list.forEach(function (record, index) {
      if (list.length > 100 && index !== 0 && index !== list.length - 1) return;
      ctx.fillStyle = '#3678cf'; ctx.beginPath(); ctx.arc(x(record), y(values[index]), 5, 0, Math.PI * 2); ctx.fill();
    });
    ctx.font = '21px sans-serif'; ctx.fillStyle = '#64748b'; ctx.textAlign = 'left'; ctx.fillText(list[0].date, left, bottom + 40);
    if (list.length > 1) { ctx.textAlign = 'right'; ctx.fillText(list[list.length - 1].date, right, bottom + 40); }
    canvas.setAttribute('aria-label', periodLabel() + ', ' + (isWeight ? '체중' : 'BMI') + ' 변화 그래프. ' + list.length + '건. 상세 수치는 아래 기록표에서 확인할 수 있습니다.');
  }
  el('saveRecord').addEventListener('click', function () {
    var record = { date: el('recordDate').value, height: Number(el('height').value), weight: Number(el('weight').value) };
    if (!validRecord(record)) { status('날짜(1900년 이후~오늘), 키(50~280cm), 몸무게(10~600kg)를 올바르게 입력하세요.'); return; }
    var exists = records.some(function (item) { return item.date === record.date; });
    if (exists && !confirm(record.date + '에 저장된 기록을 입력한 값으로 수정할까요?')) return;
    var next = records.filter(function (item) { return item.date !== record.date; }).concat(record).sort(function (a, b) { return a.date.localeCompare(b.date); });
    if (persist(next)) {
      el('historyPeriod').value = 'all'; render();
      status(record.date + ' 기록을 ' + (exists ? '수정' : '저장') + '했습니다.');
    }
  });
  el('historyPeriod').addEventListener('change', render);
  el('chartMetric').addEventListener('change', render);
  function download(blob, filename) {
    var url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }
  function filename(extension) { return 'lifetoolanswer-bmi-' + el('historyPeriod').value + '-' + today + '.' + extension; }
  el('exportPng').addEventListener('click', function () {
    var list = selected(); if (!list.length) return;
    var canvas = document.createElement('canvas'); canvas.width = 1400; canvas.height = 920;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#294462'; ctx.font = 'bold 38px sans-serif'; ctx.fillText('생활도구 · ' + periodLabel(), 70, 80);
    ctx.fillStyle = '#64748b'; ctx.font = '24px sans-serif'; ctx.fillText(list[0].date + ' ~ ' + list[list.length - 1].date, 70, 130);
    var values = summary(list), titles = ['기록한 날짜', '첫 기록 → 마지막 체중', '기간 내 체중 변화'];
    values.forEach(function (value, index) {
      var x = 70 + index * 430; ctx.fillStyle = '#f1f6fc'; ctx.fillRect(x, 165, 400, 110);
      ctx.fillStyle = '#64748b'; ctx.font = '22px sans-serif'; ctx.fillText(titles[index], x + 20, 203);
      ctx.fillStyle = '#294462'; ctx.font = 'bold 28px sans-serif'; ctx.fillText(value, x + 20, 247);
    });
    ctx.drawImage(el('historyChart'), 60, 305, 1280, 576);
    ctx.fillStyle = '#64748b'; ctx.font = '19px sans-serif'; ctx.fillText('lifetoolanswer.com · 성인 참고용 기록 / 모든 측정값은 PDF 또는 JSON 백업으로 저장하세요.', 70, 900);
    canvas.toBlob(function (blob) { if (blob) download(blob, filename('png')); else status('이미지를 만들지 못했습니다. 다시 시도하세요.'); }, 'image/png');
  });
  el('exportPdf').addEventListener('click', function () {
    if (!selected().length) return;
    var oldTitle = document.title;
    document.title = '생활도구 BMI ' + periodLabel();
    document.body.classList.add('bmi-printing');
    function finish() { document.body.classList.remove('bmi-printing'); document.title = oldTitle; window.removeEventListener('afterprint', finish); }
    window.addEventListener('afterprint', finish);
    try { window.print(); } catch (error) { finish(); status('인쇄 창을 열지 못했습니다. 브라우저 인쇄 기능을 이용하세요.'); }
  });
  el('exportBackup').addEventListener('click', function () {
    if (!selected().length) return;
    download(new Blob([JSON.stringify({ version: 1, records: selected() }, null, 2)], { type: 'application/json' }), filename('json'));
  });
  el('importBackup').addEventListener('click', function () { el('backupFile').click(); });
  el('backupFile').addEventListener('change', async function () {
    var file = this.files[0]; this.value = ''; if (!file) return;
    if (!storageReady) { status('저장소를 읽을 수 없어 백업을 불러오지 않았습니다. 브라우저 저장 권한과 사이트 데이터를 확인하세요.'); return; }
    if (file.size > 10 * 1024 * 1024) { status('백업 파일은 10MB 이하만 불러올 수 있습니다.'); return; }
    try {
      var data = JSON.parse(await file.text());
      if (!data || data.version !== 1) throw new Error('version');
      var incoming = clean(data.records);
      if (!incoming.length) { status('백업에 기록이 없습니다.'); return; }
      var overlap = incoming.filter(function (record) { return records.some(function (item) { return item.date === record.date; }); }).length;
      if (!confirm(incoming.length + '건의 기록을 불러올까요?' + (overlap ? '\n겹치는 ' + overlap + '개 날짜는 백업 값으로 바뀝니다.' : '\n기존 기록에 추가합니다.'))) return;
      var merged = new Map(records.map(function (record) { return [record.date, record]; }));
      incoming.forEach(function (record) { merged.set(record.date, record); });
      var next = clean(Array.from(merged.values()));
      if (persist(next)) { el('historyPeriod').value = 'all'; render(); status(incoming.length + '건을 불러왔습니다. 전체 ' + records.length + '건이 저장되어 있습니다.'); }
    } catch (error) { status('올바른 생활도구 백업 파일이 아닙니다. 파일 형식·날짜·키·몸무게를 확인하세요. 기존 기록은 변경하지 않았습니다.'); }
  });
  window.addEventListener('storage', function (event) {
    if (event.key === KEY || event.key === null) {
      // Avoid silently overwriting edits made in another tab.
      storageReady = false; el('saveRecord').disabled = true; el('importBackup').disabled = true;
      status('다른 탭에서 기록이 변경되거나 삭제되었습니다. 최신 기록을 불러오려면 이 페이지를 새로고침하세요.');
    }
  });
  el('saveRecord').disabled = !storageReady;
  el('importBackup').disabled = !storageReady;
  render();
});
