document.addEventListener('DOMContentLoaded', function () {
  var currentMode = 'add';
  var amountInput = document.getElementById('amount');
  var amountLabel = document.getElementById('amountLabel');
  var amountHelp = document.getElementById('amountHelp');
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
      amountLabel.textContent = currentMode === 'add' ? '공급가액' : '부가세 포함 합계금액';
      amountHelp.textContent = currentMode === 'add'
        ? '부가세가 포함되지 않은 금액을 입력하세요.'
        : '부가세가 포함된 최종 금액을 입력하세요.';
      amountInput.placeholder = currentMode === 'add' ? '예: 1000000' : '예: 1100000';
      resultCard.classList.remove('visible');
      amountInput.focus();
    });
  });

  document.getElementById('calcBtn').addEventListener('click', calculate);
  amountInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') calculate();
  });

  function calculate() {
    var amount = Number(amountInput.value);

    if (amountInput.value.trim() === '' || !Number.isSafeInteger(amount) || amount < 0) {
      alert('0 이상의 금액을 원 단위 정수로 입력해주세요.');
      return;
    }

    var supply;
    var tax;
    var total;

    if (currentMode === 'add') {
      supply = amount;
      tax = Math.round(supply * 0.1);
      total = supply + tax;
    } else {
      total = amount;
      supply = Math.round(total / 1.1);
      tax = total - supply;
    }

    document.getElementById('supplyValue').textContent = formatWon(supply);
    document.getElementById('taxValue').textContent = formatWon(tax);
    document.getElementById('totalValue').textContent = formatWon(total);
    resultCard.classList.add('visible');
    setTimeout(function () {
      resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }

  function formatWon(value) {
    return value.toLocaleString('ko-KR') + '원';
  }
});
