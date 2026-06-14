document.addEventListener('DOMContentLoaded', function () {
  // Radio option click handler
  document.querySelectorAll('.radio-option').forEach(function (opt) {
    opt.addEventListener('click', function () {
      var name = this.querySelector('input').getAttribute('name');
      document.querySelectorAll('.radio-option input[name="' + name + '"]').forEach(function (r) {
        r.closest('.radio-option').classList.remove('selected');
      });
      this.querySelector('input').checked = true;
      this.classList.add('selected');
    });
  });

  document.getElementById('calcBtn').addEventListener('click', calculate);

  document.querySelectorAll('input[type="number"]').forEach(function (inp) {
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') calculate();
    });
  });

  function calculate() {
    var height = parseFloat(document.getElementById('height').value);
    var weight = parseFloat(document.getElementById('weight').value);

    if (!height || !weight || height < 50 || height > 280 || weight < 10 || weight > 600) {
      alert('키와 몸무게를 올바르게 입력해주세요.\n(키: 50~280cm, 몸무게: 10~600kg)');
      return;
    }

    var h = height / 100;
    var bmi = weight / (h * h);

    var category, badgeClass, colorClass, advice;

    if (bmi < 18.5) {
      category = '저체중';
      badgeClass = 'badge-underweight';
      colorClass = 'color-under';
      advice = '체중이 정상 범위보다 낮습니다. 균형 잡힌 식단으로 영양을 충분히 섭취하고 건강한 방법으로 체중 증가를 목표로 하세요.';
    } else if (bmi < 23) {
      category = '정상 체중';
      badgeClass = 'badge-normal';
      colorClass = 'color-normal';
      advice = '건강한 체중 범위입니다. 규칙적인 운동과 균형 잡힌 식사로 현재 상태를 유지하세요.';
    } else if (bmi < 25) {
      category = '과체중';
      badgeClass = 'badge-overweight';
      colorClass = 'color-over';
      advice = '정상 체중 범위를 약간 초과했습니다. 규칙적인 유산소 운동과 식단 조절을 권장합니다.';
    } else if (bmi < 30) {
      category = '비만 1단계';
      badgeClass = 'badge-obese1';
      colorClass = 'color-obese1';
      advice = '비만 1단계입니다. 생활 습관 개선이 중요합니다. 전문의 상담과 체계적인 운동·식이요법을 시작하세요.';
    } else {
      category = '비만 2단계';
      badgeClass = 'badge-obese2';
      colorClass = 'color-obese2';
      advice = '비만 2단계입니다. 심뇌혈관 질환 등의 합병증 위험이 높아집니다. 의료 전문가와 상담하여 관리 계획을 세우세요.';
    }

    var minWeight = (18.5 * h * h).toFixed(1);
    var maxWeight = (22.9 * h * h).toFixed(1);

    // Gauge: BMI 15 ~ 40 mapped to 0% ~ 100%
    var gaugePos = Math.min(Math.max(((bmi - 15) / 25) * 100, 2), 97);

    // Update UI
    var valEl = document.getElementById('bmiValue');
    valEl.textContent = bmi.toFixed(1);
    valEl.className = 'bmi-value ' + colorClass;

    var badge = document.getElementById('bmiCategory');
    badge.textContent = category;
    badge.className = 'result-badge ' + badgeClass;

    document.getElementById('gaugeMarker').style.left = gaugePos + '%';
    document.getElementById('normalWeight').textContent = minWeight + ' ~ ' + maxWeight + ' kg';
    document.getElementById('diffWeight').textContent = calcDiff(weight, parseFloat(minWeight), parseFloat(maxWeight));
    document.getElementById('adviceText').textContent = advice;

    var card = document.getElementById('resultCard');
    card.classList.add('visible');
    setTimeout(function () {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }

  function calcDiff(weight, min, max) {
    if (weight < min) return (min - weight).toFixed(1) + ' kg 부족';
    if (weight > max) return (weight - max).toFixed(1) + ' kg 초과';
    return '정상 범위';
  }
});
