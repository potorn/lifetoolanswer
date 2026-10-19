import { byId as $, node, reportPng } from './tool-reports.js?v=20261019-theme1';
document.addEventListener('DOMContentLoaded', () => {
  const form = $('bmrForm'); let last = null;
  const note = node('p', '', 'upgrade-status'); note.setAttribute('role', 'status'); form.append(note);
  try {
    const raw = sessionStorage.getItem('lifetoolanswer.energy-transfer');
    if (raw) {
      sessionStorage.removeItem('lifetoolanswer.energy-transfer'); const data = JSON.parse(raw);
      if (Date.now() - data.time >= 0 && Date.now() - data.time < 300000 && Number.isFinite(data.height) && data.height >= 100 && data.height <= 250 && Number.isFinite(data.weight) && data.weight >= 25 && data.weight <= 350) {
        $('bmrHeight').value = data.height; $('bmrWeight').value = data.weight; note.textContent = 'BMI 계산기에서 키·몸무게를 가져왔습니다. 성별 계수와 나이를 입력하세요.';
      }
    }
  } catch { note.textContent = 'BMI 정보를 가져오지 못했습니다. 키와 몸무게를 직접 입력하세요.'; }
  const save = node('button', '계산 결과 PNG 저장', 'health-secondary'); save.type = 'button'; save.disabled = true; $('bmrResult').append(save);
  form.addEventListener('submit', () => {
    last = !$('bmrValues').hidden; save.disabled = !last;
  });
  form.addEventListener('input', event => { if (event.target !== $('bmrActivity')) { last = null; save.disabled = true; } });
  // Run after the base form's invalidation listener (the event bubbles from select).
  form.addEventListener('change', event => {
    if (event.target === $('bmrActivity') && last) form.requestSubmit();
    else { last = null; save.disabled = true; }
  });
  save.onclick = () => {
    if (!last || $('bmrValues').hidden) return;
    reportPng('생활도구 · 기초대사량·칼로리', [
      $('bmrSex').selectedOptions[0].textContent + ' · ' + $('bmrAge').value + '세 · ' + $('bmrHeight').value + 'cm · ' + $('bmrWeight').value + 'kg',
      '휴식 시 소모 열량: ' + $('restingValue').textContent + ' kcal/일', '하루 소모 열량: ' + $('energyValue').textContent + ' kcal/일',
      $('bmrActivity').selectedOptions[0].textContent, 'Mifflin–St Jeor 식과 활동계수에 따른 성인 참고용 추정값', '권장 섭취량이나 의료적 진단을 의미하지 않습니다.'
    ], null, 'bmr-calories.png');
  };
});
