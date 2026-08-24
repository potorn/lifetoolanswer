document.addEventListener('DOMContentLoaded', function () {
  var currentMode = 'deposit';
  var amountInput = document.getElementById('amount');
  var amountLabel = document.getElementById('amountLabel');
  var amountHelp = document.getElementById('amountHelp');
  var interestMethodGroup = document.getElementById('interestMethodGroup');
  var resultCard = document.getElementById('resultCard');

  document.querySelectorAll('.mode-tabs .radio-option').forEach(function (button) {
    button.addEventListener('click', function () {
      document.querySelectorAll('.mode-tabs .radio-option').forEach(function (item) {
        item.classList.remove('selected');
        item.setAttribute('aria-pressed', 'false');
      });
      button.classList.add('selected');
      button.setAttribute('aria-pressed', 'true');
      currentMode = button.dataset.mode;
      updateMode();
    });
  });

  document.getElementById('calcBtn').addEventListener('click', calculate);
  document.querySelectorAll('input[type="number"]').forEach(function (input) {
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') calculate();
    });
  });

  function updateMode() {
    var isDeposit = currentMode === 'deposit';
    amountLabel.textContent = isDeposit ? '예치금액' : '월 납입금액';
    amountHelp.textContent = isDeposit
      ? '처음에 한 번 맡기는 금액을 입력하세요.'
      : '매월 같은 날짜에 납입하는 금액을 입력하세요.';
    amountInput.placeholder = isDeposit ? '예: 1000' : '예: 50';
    interestMethodGroup.style.display = isDeposit ? '' : 'none';
    resultCard.classList.remove('visible');
    amountInput.focus();
  }

  function calculate() {
    var amountMan = Number(amountInput.value);
    var annualRate = Number(document.getElementById('annualRate').value);
    var months = Number(document.getElementById('months').value);

    if (!Number.isFinite(amountMan) || amountMan <= 0 || amountMan > 1000000) {
      alert('금액은 0보다 크고 1,000,000만원 이하여야 합니다.');
      return;
    }
    if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 100) {
      alert('연 이자율은 0~100% 사이로 입력해주세요.');
      return;
    }
    if (!Number.isInteger(months) || months < 1 || months > 600) {
      alert('기간은 1~600개월 사이의 정수로 입력해주세요.');
      return;
    }

    var amount = amountMan * 10000;
    var monthlyRate = annualRate / 100 / 12;
    var principal;
    var gross;
    var note;

    if (currentMode === 'deposit') {
      principal = amount;
      if (document.getElementById('interestMethod').value === 'compound') {
        gross = principal * Math.pow(1 + monthlyRate, months) - principal;
        note = '월복리 가정으로 계산한 예상 금액입니다.';
      } else {
        gross = principal * annualRate / 100 * months / 12;
        note = '단리 기준으로 계산한 예상 금액입니다.';
      }
    } else {
      principal = amount * months;
      gross = amount * monthlyRate * months * (months + 1) / 2;
      note = '매월 초 동일 금액을 납입하는 정기적금 단리 기준입니다.';
    }

    var taxRate = document.getElementById('taxType').value === 'normal' ? 0.154 : 0;
    var roundedGross = Math.round(gross);
    var tax = Math.round(roundedGross * taxRate);
    var netInterest = roundedGross - tax;
    var maturity = Math.round(principal) + netInterest;

    document.getElementById('maturityValue').textContent = formatWon(maturity);
    document.getElementById('resultSummary').textContent = '세후 이자 ' + formatWon(netInterest);
    document.getElementById('resultSummary').style.display = 'block';
    document.getElementById('principalValue').textContent = formatWon(principal);
    document.getElementById('grossInterest').textContent = formatWon(roundedGross);
    document.getElementById('taxValue').textContent = formatWon(tax);
    document.getElementById('netInterest').textContent = formatWon(netInterest);
    document.getElementById('calculationNote').textContent = note;
    resultCard.classList.add('visible');
    setTimeout(function () {
      resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }

  function formatWon(value) {
    return Math.round(value).toLocaleString('ko-KR') + '원';
  }
});
