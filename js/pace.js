export const KM_PER_MILE = 1.609344;
export const RACE_DISTANCES = [
  { label: '5km', km: 5 }, { label: '10km', km: 10 },
  { label: '하프 · 21.0975km', km: 21.0975 }, { label: '풀 · 42.195km', km: 42.195 }
];

export function timeFromParts(hours, minutes, seconds) {
  if (!Number.isInteger(hours) || hours < 0 || hours > 999) throw new Error('시간은 0~999의 정수로 입력해 주세요.');
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) throw new Error('시간 입력의 분은 0~59의 정수로 입력해 주세요.');
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 59) throw new Error('시간 입력의 초는 0~59의 정수로 입력해 주세요.');
  return hours * 3600 + minutes * 60 + seconds;
}

export function paceFromParts(minutes, seconds) {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 999) throw new Error('페이스의 분은 0~999의 정수로 입력해 주세요.');
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 59) throw new Error('페이스의 초는 0~59의 정수로 입력해 주세요.');
  return minutes * 60 + seconds;
}

export function calculatePace({ mode, unit, distance, timeSeconds, paceSeconds }) {
  if (!['pace', 'time', 'distance'].includes(mode)) throw new Error('계산할 항목을 선택해 주세요.');
  if (!['km', 'mi'].includes(unit)) throw new Error('거리 단위를 선택해 주세요.');
  let km;
  if (mode !== 'distance') {
    if (!Number.isFinite(distance) || distance < 0.001 || distance > 1000) throw new Error('거리는 선택한 단위로 0.001~1,000 사이의 숫자를 입력해 주세요.');
    km = distance * (unit === 'mi' ? KM_PER_MILE : 1);
  }
  if (mode !== 'time' && (!Number.isFinite(timeSeconds) || timeSeconds <= 0 || timeSeconds > 3599999)) throw new Error('이동 시간을 0초보다 크게 입력해 주세요.');
  if (mode !== 'pace' && (!Number.isFinite(paceSeconds) || paceSeconds <= 0 || paceSeconds > 59999)) throw new Error('1km당 페이스를 0초보다 크게 입력해 주세요.');
  if (mode === 'pace') paceSeconds = timeSeconds / km;
  if (mode === 'time') timeSeconds = paceSeconds * km;
  if (mode === 'distance') km = timeSeconds / paceSeconds;
  return {
    distanceKm: km,
    distanceMiles: km / KM_PER_MILE,
    timeSeconds,
    paceSeconds,
    milePaceSeconds: paceSeconds * KM_PER_MILE,
    speedKmh: 3600 / paceSeconds,
    speedMph: 3600 / paceSeconds / KM_PER_MILE
  };
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error('유효하지 않은 시간입니다.');
  if (seconds > 0 && seconds < 0.5) return '1초 미만';
  const rounded = Math.round(seconds);
  return [Math.floor(rounded / 3600), Math.floor(rounded % 3600 / 60), rounded % 60].map(n => String(n).padStart(2, '0')).join(':');
}

export function formatPace(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('유효하지 않은 페이스입니다.');
  if (seconds < 0.5) return '1초 미만';
  const rounded = Math.round(seconds);
  return Math.floor(rounded / 60) + '분 ' + String(rounded % 60).padStart(2, '0') + '초';
}

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const form = $('paceForm');
  let mode = 'pace';
  const number = (n, digits = 2) => n.toLocaleString('ko-KR', { maximumFractionDigits: digits });
  const distanceNumber = n => number(n, n < 0.01 ? 6 : 3);
  function invalidate() {
    $('paceValues').hidden = true; $('pacePlaceholder').hidden = false;
    $('paceStatus').textContent = ''; $('paceStatus').classList.remove('is-error');
  }
  form.addEventListener('input', invalidate);
  form.addEventListener('change', invalidate);
  document.querySelectorAll('[name="paceMode"]').forEach(input => {
    input.addEventListener('change', () => {
      mode = input.value;
      $('distanceGroup').hidden = mode === 'distance';
      $('durationGroup').hidden = mode === 'time';
      $('targetPaceGroup').hidden = mode === 'pace';
      $('paceCalculate').textContent = { pace: '페이스 계산하기', time: '소요 시간 계산하기', distance: '거리 계산하기' }[mode];
      invalidate();
    });
  });
  $('paceUnit').addEventListener('change', () => { $('distanceUnitLabel').textContent = $('paceUnit').value === 'mi' ? '마일' : 'km'; });
  document.querySelectorAll('[data-distance]').forEach(button => {
    button.addEventListener('click', () => {
      $('paceUnit').value = 'km'; $('distanceUnitLabel').textContent = 'km'; $('paceDistance').value = button.dataset.distance; invalidate();
    });
  });
  form.addEventListener('submit', event => {
    event.preventDefault(); invalidate();
    try {
      const unit = $('paceUnit').value;
      const result = calculatePace({
        mode, unit, distance: Number($('paceDistance').value),
        timeSeconds: mode === 'time' ? undefined : timeFromParts(Number($('durationHours').value), Number($('durationMinutes').value), Number($('durationSeconds').value)),
        paceSeconds: mode === 'pace' ? undefined : paceFromParts(Number($('paceMinutes').value), Number($('paceSeconds').value))
      });
      const primary = mode === 'pace' ? formatPace(result.paceSeconds) : mode === 'time' ? formatDuration(result.timeSeconds) : distanceNumber(unit === 'mi' ? result.distanceMiles : result.distanceKm);
      $('paceResultLabel').textContent = { pace: '1km당 평균 페이스', time: '예상 소요 시간', distance: '예상 이동 거리' }[mode];
      $('paceResultValue').textContent = primary;
      $('paceResultUnit').textContent = mode === 'pace' ? '/ km' : mode === 'time' ? '시 : 분 : 초' : unit === 'mi' ? '마일' : 'km';
      $('kmPaceValue').textContent = formatPace(result.paceSeconds);
      $('milePaceValue').textContent = formatPace(result.milePaceSeconds);
      $('speedValue').textContent = number(result.speedKmh) + ' km/h';
      $('speedMiles').textContent = number(result.speedMph) + ' mph';
      $('distanceValue').textContent = distanceNumber(result.distanceKm) + ' km';
      $('distanceMiles').textContent = distanceNumber(result.distanceMiles) + ' 마일';
      $('elapsedValue').textContent = formatDuration(result.timeSeconds);
      $('raceRows').replaceChildren(...RACE_DISTANCES.map(race => {
        const row = document.createElement('tr');
        [race.label, formatDuration(race.km * result.paceSeconds)].forEach(text => { const cell = document.createElement('td'); cell.textContent = text; row.append(cell); });
        return row;
      }));
      $('pacePlaceholder').hidden = true; $('paceValues').hidden = false;
      $('paceStatus').textContent = '계산 완료: ' + distanceNumber(result.distanceKm) + 'km, ' + formatDuration(result.timeSeconds) + ', 1km당 ' + formatPace(result.paceSeconds) + '입니다.';
      if (window.innerWidth <= 760) $('paceResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) { $('paceStatus').textContent = error.message; $('paceStatus').classList.add('is-error'); }
  });
  $('paceExample').addEventListener('click', () => {
    $('paceUnit').value = 'km'; $('distanceUnitLabel').textContent = 'km';
    $('paceDistance').value = mode === 'time' ? '10' : '5';
    $('durationHours').value = '0'; $('durationMinutes').value = '30'; $('durationSeconds').value = '0';
    $('paceMinutes').value = mode === 'time' ? '5' : '6'; $('paceSeconds').value = '0';
    form.requestSubmit();
  });
});
