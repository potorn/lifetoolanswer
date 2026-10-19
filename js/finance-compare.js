import { byId as $, node, won, table, csv, drawLines, reportPng } from './tool-reports.js?v=20261019-theme1';

document.addEventListener('DOMContentLoaded', () => {
  const tool = location.pathname.split('/').pop().replace('.html', '');
  const titles = { loan: '대출 조건 비교', savings: '예금·적금 상품 비교', salary: '연봉 인상·이직 비교' };
  if (!titles[tool]) return;
  const section = node('section', undefined, 'card upgrade-panel'); section.id = 'comparePanel';
  section.setAttribute('aria-labelledby', 'compareTitle');
  const title = node('h2', titles[tool]); title.id = 'compareTitle';
  section.append(title, node('p', '조건을 계산한 뒤 비교에 추가하세요. 최대 3개를 나란히 볼 수 있습니다. 첫 조건이 차이 계산의 기준입니다.', 'upgrade-help'));
  const actions = node('div', undefined, 'upgrade-actions');
  const label = node('label', '조건 이름 (선택)'); label.htmlFor = 'compareName';
  const name = node('input'); name.id = 'compareName'; name.type = 'text'; name.maxLength = 30; name.placeholder = tool === 'salary' ? '예: 현재 연봉 / 이직 제안' : '예: 상품 A';
  const add = node('button', '계산한 조건 비교에 추가'); add.type = 'button'; add.disabled = true;
  const exportButton = node('button', '비교표 CSV 저장'); exportButton.type = 'button'; exportButton.disabled = true;
  actions.append(label, name, add, exportButton);
  const message = node('p', '', 'upgrade-status'); message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite');
  const output = node('div'); section.append(actions, message, output);
  $('resultCard').after(section);
  let latest = null, items = [], nextLabel = 1;
  const signature = () => Array.from(document.querySelectorAll('main input:not(#compareName), main select, main .unit-btn.active, main .mode-tabs .selected')).map(item => item.value ?? item.dataset.unit ?? item.dataset.mode).join('|');
  let calculatedSignature = '';
  const stale = () => { if (signature() !== calculatedSignature) { latest = null; add.disabled = true; message.textContent = '조건을 변경했습니다. 다시 계산한 뒤 비교에 추가하세요.'; } };
  document.querySelectorAll('main input, main select, main .unit-btn, main .mode-tabs button').forEach(input => {
    if (input === name) return;
    input.addEventListener('input', stale); input.addEventListener('change', stale);
    if (input.tagName === 'BUTTON') input.addEventListener('click', () => { latest = null; add.disabled = true; });
  });
  window.addEventListener('tool-result', event => {
    if (event.detail.tool !== tool) return;
    latest = event.detail; calculatedSignature = signature(); add.disabled = items.length >= 3;
    message.textContent = '계산했습니다. 현재 조건을 비교표에 추가할 수 있습니다.';
    if (tool === 'savings') renderGrowth(latest);
  });
  function render() {
    output.replaceChildren(); exportButton.disabled = items.length === 0;
    add.disabled = !latest || items.length >= 3;
    if (!items.length) return;
    const headers = ['비교 항목', ...items.map(item => item.name)];
    const rows = [['입력 조건', ...items.map(item => item.conditions)]];
    items[0].metrics.forEach((metric, index) => {
      rows.push([metric.label, ...items.map(item => won(item.metrics[index].value))]);
      if (metric.compare) rows.push([metric.label + ' · 첫 조건 대비', ...items.map(item => {
        const difference = item.metrics[index].value - items[0].metrics[index].value;
        return (difference > 0 ? '+' : difference < 0 ? '−' : '') + won(Math.abs(difference));
      })]);
    });
    
    const deleteCells = items.map((item, index) => { const cell = node('td'); const button = node('button', '제외'); button.type = 'button'; button.setAttribute('aria-label', item.name + ' 비교에서 제외'); button.addEventListener('click', () => { items.splice(index, 1); render(); }); cell.append(button); return cell; });
    output.append(table(headers, [...rows, ['관리', ...deleteCells]]));
    output.append(node('p', tool === 'loan' ? '원금·기간이 다르면 총이자 차이만으로 유리한 상품을 판단할 수 없습니다. 만기일시의 월 납입금은 이자이며 만기에 원금이 추가됩니다.' : tool === 'savings' ? '기간·납입 원금이 다르면 만기금액만으로 수익률을 비교할 수 없습니다. 세금·이자 계산은 위 계산기와 같은 가정입니다.' : '연봉을 12개월 균등 지급하고 기존 간소화 세금·보험 계산을 동일하게 적용한 비교입니다. 비과세액·보험 상한·개인별 공제는 반영하지 않습니다.', 'upgrade-help'));
    exportButton.onclick = () => csv([headers, ...rows], tool + '-comparison.csv');
  }
  add.addEventListener('click', () => {
    if (!latest || items.length >= 3 || calculatedSignature !== signature()) return;
    items.push({ ...latest, name: name.value.trim() || '조건 ' + nextLabel++ });
    name.value = ''; render(); message.textContent = items.length + '개 조건을 비교 중입니다. 비교표는 새로고침하면 초기화됩니다.';
  });
  let growthPanel;
  function renderGrowth(result) {
    if (!growthPanel) { growthPanel = node('section', undefined, 'card upgrade-panel'); growthPanel.id = 'savingsGrowth'; section.before(growthPanel); }
    growthPanel.replaceChildren(node('h2', '월별 원금·이자 누적 그래프'));
    growthPanel.append(node('p', result.conditions + ' · 세전 발생 이자를 포함한 추정값입니다. 실제 중도해지 수령액은 아닙니다.', 'upgrade-help'));
    const canvas = node('canvas'); canvas.width = 1200; canvas.height = 540; canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', '월별 납입 원금과 세전 이자 누적 그래프. 모든 수치는 아래 표에 표시됩니다.');
    growthPanel.append(canvas);
    drawLines(canvas, result.growth.map(row => row.month + '개월'), [{ name: '납입 원금', color: '#3678cf', values: result.growth.map(row => row.principal / 10000) }, { name: '원금 + 세전 이자', color: '#199780', values: result.growth.map(row => (row.principal + row.interest) / 10000) }], '만원');
    const rows = result.growth.map(row => [row.month + '개월', Math.round(row.principal), Math.round(row.interest), Math.round(row.principal + row.interest)]);
    const details = node('details'); details.append(node('summary', '월별 상세 금액 보기'), table(['경과', '납입 원금 (원)', '세전 이자 (원)', '합계 (원)'], rows.map(row => [row[0], ...row.slice(1).map(value => value.toLocaleString('ko-KR'))]))); growthPanel.append(details);
    const actions = node('div', undefined, 'upgrade-actions'), saveCsv = node('button', '월별 기록 CSV 저장'), savePng = node('button', '그래프 PNG 저장'); saveCsv.type = savePng.type = 'button';
    saveCsv.onclick = () => csv([['경과', '납입 원금 (원)', '세전 이자 (원)', '합계 (원)'], ...rows], 'savings-monthly.csv');
    savePng.onclick = () => reportPng('생활도구 · 예금·적금 누적 예상', [result.conditions, ...result.metrics.map(metric => metric.label + ' ' + won(metric.value))], canvas, 'savings-growth.png');
    actions.append(saveCsv, savePng); growthPanel.append(actions);
  }
});
