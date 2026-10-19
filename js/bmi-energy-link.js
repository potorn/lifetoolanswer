document.addEventListener('DOMContentLoaded', () => {
  const link = document.createElement('a'); link.href = 'bmr.html'; link.className = 'upgrade-link'; link.textContent = '이 키·몸무게로 하루 소모 칼로리 계산하기';
  const status = document.createElement('p'); status.className = 'upgrade-status'; status.setAttribute('role', 'status'); document.getElementById('resultCard').append(link, status);
  link.onclick = event => {
    const height = Number(document.getElementById('height').value), weight = Number(document.getElementById('weight').value);
    if (!Number.isFinite(height) || height < 100 || height > 250 || !Number.isFinite(weight) || weight < 25 || weight > 350) { event.preventDefault(); status.textContent = '칼로리 계산기는 키 100~250cm, 체중 25~350kg의 성인을 대상으로 합니다.'; return; }
    try { sessionStorage.setItem('lifetoolanswer.energy-transfer', JSON.stringify({ height, weight, time: Date.now() })); }
    catch { event.preventDefault(); status.textContent = '임시 저장소를 사용할 수 없습니다. 기초대사량 계산기에서 값을 직접 입력하세요.'; }
  };
});
