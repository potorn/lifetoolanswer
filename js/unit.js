document.addEventListener('DOMContentLoaded', function () {

  var CATEGORIES = {
    length: {
      name: '길이', icon: '📏',
      units: { 'mm': 0.001, 'cm': 0.01, 'm': 1, 'km': 1000, 'in': 0.0254, 'ft': 0.3048, 'yd': 0.9144, 'mi': 1609.344 },
      labels: { 'mm': 'mm · 밀리미터', 'cm': 'cm · 센티미터', 'm': 'm · 미터', 'km': 'km · 킬로미터', 'in': 'in · 인치', 'ft': 'ft · 피트', 'yd': 'yd · 야드', 'mi': 'mi · 마일' }
    },
    weight: {
      name: '무게', icon: '⚖️',
      units: { 'mg': 0.001, 'g': 1, 'kg': 1000, 't': 1e6, 'oz': 28.3495, 'lb': 453.592 },
      labels: { 'mg': 'mg · 밀리그램', 'g': 'g · 그램', 'kg': 'kg · 킬로그램', 't': 't · 톤', 'oz': 'oz · 온스', 'lb': 'lb · 파운드' }
    },
    temperature: {
      name: '온도', icon: '🌡️', special: true,
      units: { '°C': null, '°F': null, 'K': null },
      labels: { '°C': '°C · 섭씨', '°F': '°F · 화씨', 'K': 'K · 켈빈' }
    },
    area: {
      name: '넓이', icon: '📐',
      units: { 'mm²': 1e-6, 'cm²': 1e-4, 'm²': 1, 'km²': 1e6, '평': 3.30579, 'acre': 4046.86, 'ft²': 0.092903 },
      labels: { 'mm²': 'mm² · 평방밀리미터', 'cm²': 'cm² · 평방센티미터', 'm²': 'm² · 평방미터', 'km²': 'km² · 평방킬로미터', '평': '평 (坪)', 'acre': 'acre · 에이커', 'ft²': 'ft² · 평방피트' }
    },
    volume: {
      name: '부피', icon: '💧',
      units: { 'mL': 1, 'L': 1000, 'm³': 1e6, '큰술': 15, '컵': 240, 'fl oz': 29.5735, 'gallon': 3785.41 },
      labels: { 'mL': 'mL · 밀리리터', 'L': 'L · 리터', 'm³': 'm³ · 세제곱미터', '큰술': '큰술 (15mL)', '컵': '컵 (240mL)', 'fl oz': 'fl oz · 액량온스', 'gallon': 'gallon · 갤런' }
    }
  };

  var currentCategory = 'length';

  function convertTemp(value, from) {
    var c;
    if (from === '°C') c = value;
    else if (from === '°F') c = (value - 32) * 5 / 9;
    else c = value - 273.15;
    return { '°C': c, '°F': c * 9 / 5 + 32, 'K': c + 273.15 };
  }

  function formatNum(n) {
    if (!isFinite(n)) return '∞';
    var abs = Math.abs(n);
    if (abs === 0) return '0';
    if (abs < 0.0001) return n.toExponential(4);
    if (abs < 1) return parseFloat(n.toFixed(6)).toString();
    if (abs < 10000) return parseFloat(n.toFixed(4)).toString();
    return n.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  }

  var catBtns = document.querySelectorAll('.conv-cat-btn');
  catBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      catBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentCategory = btn.dataset.cat;
      updateUnitSelect();
      document.getElementById('resultCard').classList.remove('visible');
      document.getElementById('valueInput').value = '';
      document.getElementById('valueInput').focus();
    });
  });

  function updateUnitSelect() {
    var select = document.getElementById('fromUnit');
    var cat = CATEGORIES[currentCategory];
    var units = Object.keys(cat.units);
    select.innerHTML = units.map(function (u) {
      return '<option value="' + u + '">' + cat.labels[u] + '</option>';
    }).join('');
    document.getElementById('inputUnitLabel').textContent = units[0];
  }

  document.getElementById('fromUnit').addEventListener('change', function () {
    document.getElementById('inputUnitLabel').textContent = this.value;
  });

  document.getElementById('valueInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') convert();
  });

  document.getElementById('calcBtn').addEventListener('click', convert);

  function convert() {
    var raw = document.getElementById('valueInput').value.trim();
    var value = parseFloat(raw);
    if (raw === '' || isNaN(value)) {
      document.getElementById('valueInput').focus();
      document.getElementById('valueInput').style.borderColor = '#dc2626';
      setTimeout(function () {
        document.getElementById('valueInput').style.borderColor = '';
      }, 800);
      return;
    }

    var fromUnit = document.getElementById('fromUnit').value;
    var cat = CATEGORIES[currentCategory];
    var results;

    if (cat.special) {
      results = convertTemp(value, fromUnit);
    } else {
      var baseValue = value * cat.units[fromUnit];
      results = {};
      Object.keys(cat.units).forEach(function (u) {
        results[u] = baseValue / cat.units[u];
      });
    }

    var grid = document.getElementById('resultGrid');
    grid.innerHTML = Object.keys(results).map(function (u) {
      var isActive = (u === fromUnit) ? ' active' : '';
      return '<div class="stat-box' + isActive + '">' +
        '<div class="stat-label">' + u + '</div>' +
        '<div class="stat-val">' + formatNum(results[u]) + '</div>' +
        '</div>';
    }).join('');

    var card = document.getElementById('resultCard');
    card.classList.add('visible');
    setTimeout(function () {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }

  updateUnitSelect();
});
