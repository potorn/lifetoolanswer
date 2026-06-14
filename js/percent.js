document.addEventListener('DOMContentLoaded', function () {
  var currentMode = 'discount';

  document.querySelectorAll('.radio-option').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.radio-option').forEach(function (b) { b.classList.remove('selected'); });
      this.classList.add('selected');
      currentMode = this.dataset.mode;
      document.getElementById('formDiscount').style.display = currentMode === 'discount' ? '' : 'none';
      document.getElementById('formChange').style.display = currentMode === 'change' ? '' : 'none';
      document.getElementById('formReverse').style.display = currentMode === 'reverse' ? '' : 'none';
      document.getElementById('resultCard').classList.remove('visible');
    });
  });

  document.getElementById('calcBtn').addEventListener('click', calculate);
  document.querySelectorAll('input[type="number"]').forEach(function (inp) {
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') calculate(); });
  });

  function calculate() {
    if (currentMode === 'discount') calcDiscount();
    else if (currentMode === 'change') calcChange();
    else calcReverse();
  }

  function showResults(boxes) {
    var container = document.getElementById('resultBoxes');
    container.innerHTML = '';
    boxes.forEach(function (b) {
      var div = document.createElement('div');
      div.className = 'stat-box';
      div.innerHTML = '<div class="stat-label">' + b.label + '</div><div class="stat-val">' + b.value + '</div>';
      container.appendChild(div);
    });
    var card = document.getElementById('resultCard');
    card.classList.add('visible');
    setTimeout(function () { card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 50);
  }

  function fmtNum(n) {
    if (Math.abs(n) >= 1) return n.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
    return n.toFixed(2);
  }

  function calcDiscount() {
    var orig = parseFloat(document.getElementById('origPrice').value);
    var rate = parseFloat(document.getElementById('discountRate').value);
    if (isNaN(orig) || isNaN(rate)) { alert('원래 가격과 할인율을 입력해주세요.'); return; }
    if (rate < 0 || rate > 100) { alert('할인율은 0~100% 사이여야 합니다.'); return; }
    var discountAmt = orig * (rate / 100);
    var finalPrice = orig - discountAmt;
    showResults([
      { label: '할인 금액', value: fmtNum(discountAmt) + '원' },
      { label: '최종 가격', value: fmtNum(finalPrice) + '원' },
      { label: '할인율', value: rate + '%' },
      { label: '원래 가격', value: fmtNum(orig) + '원' },
    ]);
  }

  function calcChange() {
    var before = parseFloat(document.getElementById('beforeVal').value);
    var after = parseFloat(document.getElementById('afterVal').value);
    if (isNaN(before) || isNaN(after)) { alert('변경 전·후 값을 입력해주세요.'); return; }
    if (before === 0) { alert('변경 전 값은 0이 될 수 없습니다.'); return; }
    var diff = after - before;
    var rate = (diff / Math.abs(before)) * 100;
    var sign = diff >= 0 ? '+' : '';
    showResults([
      { label: '증감량', value: sign + fmtNum(diff) },
      { label: '증감률', value: sign + fmtNum(rate) + '%' },
      { label: '변경 전', value: fmtNum(before) },
      { label: '변경 후', value: fmtNum(after) },
    ]);
  }

  function calcReverse() {
    var sale = parseFloat(document.getElementById('salePrice').value);
    var rate = parseFloat(document.getElementById('reverseRate').value);
    if (isNaN(sale) || isNaN(rate)) { alert('할인된 가격과 할인율을 입력해주세요.'); return; }
    if (rate < 0 || rate >= 100) { alert('할인율은 0~99% 사이여야 합니다.'); return; }
    var orig = sale / (1 - rate / 100);
    var discountAmt = orig - sale;
    showResults([
      { label: '원래 가격', value: fmtNum(orig) + '원' },
      { label: '할인 금액', value: fmtNum(discountAmt) + '원' },
      { label: '할인된 가격', value: fmtNum(sale) + '원' },
      { label: '할인율', value: rate + '%' },
    ]);
  }
});
