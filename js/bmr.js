// Mifflin–St Jeor's simplified REE equation (1990), kcal/day.
// https://pubmed.ncbi.nlm.nih.gov/2305711/
export const ACTIVITY_LEVELS = [
  { factor: 1.4, label: '대부분 앉아서 생활' },
  { factor: 1.6, label: '가벼운 움직임이 있는 생활' },
  { factor: 1.8, label: '서 있거나 걷는 활동이 많은 생활' },
  { factor: 2.0, label: '신체활동이 매우 많은 생활' }
];

export function calculateEnergy({ sex, age, height, weight, activity }) {
  if (!['male', 'female'].includes(sex)) throw new Error('계산에 사용할 성별 계수를 선택해 주세요.');
  if (!Number.isInteger(age) || age < 18 || age > 100) throw new Error('나이는 18~100세의 정수로 입력해 주세요.');
  if (!Number.isFinite(height) || height < 100 || height > 250) throw new Error('키는 100~250cm로 입력해 주세요.');
  if (!Number.isFinite(weight) || weight < 25 || weight > 350) throw new Error('몸무게는 25~350kg으로 입력해 주세요.');
  if (!ACTIVITY_LEVELS.some(level => level.factor === activity)) throw new Error('하루 활동량을 선택해 주세요.');
  const resting = 10 * weight + 6.25 * height - 5 * age + (sex === 'male' ? 5 : -161);
  return {
    resting,
    total: resting * activity,
    estimates: ACTIVITY_LEVELS.map(level => ({ ...level, calories: resting * level.factor }))
  };
}

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const form = $('bmrForm');
  const number = value => Math.round(value).toLocaleString('ko-KR');
  function invalidate() {
    $('bmrValues').hidden = true;
    $('bmrPlaceholder').hidden = false;
    $('bmrStatus').textContent = '';
    $('bmrStatus').classList.remove('is-error');
  }
  form.addEventListener('input', invalidate);
  form.addEventListener('change', invalidate);
  form.addEventListener('submit', event => {
    event.preventDefault(); invalidate();
    try {
      const activity = Number($('bmrActivity').value);
      const result = calculateEnergy({
        sex: $('bmrSex').value,
        age: Number($('bmrAge').value),
        height: Number($('bmrHeight').value),
        weight: Number($('bmrWeight').value),
        activity
      });
      $('restingValue').textContent = number(result.resting);
      $('energyValue').textContent = number(result.total);
      $('activityApplied').textContent = '휴식 시 소모 열량 × 활동계수 ' + activity.toFixed(1);
      const rows = result.estimates.map(level => {
        const row = document.createElement('tr');
        if (level.factor === activity) { row.className = 'health-selected-row'; row.setAttribute('aria-current', 'true'); }
        [level.label + (level.factor === activity ? ' · 선택' : ''), level.factor.toFixed(1), number(level.calories) + ' kcal'].forEach(text => {
          const cell = document.createElement('td'); cell.textContent = text; row.append(cell);
        });
        return row;
      });
      $('activityRows').replaceChildren(...rows);
      $('bmrPlaceholder').hidden = true; $('bmrValues').hidden = false;
      $('bmrStatus').textContent = '휴식 시 약 ' + number(result.resting) + 'kcal, 하루 전체 약 ' + number(result.total) + 'kcal를 소모하는 것으로 추정합니다.';
      if (window.innerWidth <= 760) $('bmrResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
      $('bmrStatus').textContent = error.message; $('bmrStatus').classList.add('is-error');
    }
  });
  $('bmrExample').addEventListener('click', () => {
    $('bmrSex').value = 'male'; $('bmrAge').value = '30';
    $('bmrHeight').value = '175'; $('bmrWeight').value = '70'; $('bmrActivity').value = '1.4';
    form.requestSubmit();
  });
});
