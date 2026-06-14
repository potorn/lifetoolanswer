document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('calcBtn').addEventListener('click', calculate);
  document.querySelectorAll('input[type="number"]').forEach(function (inp) {
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') calculate(); });
  });

  function calculate() {
    var salaryMan = parseFloat(document.getElementById('salary').value);
    var dependents = parseInt(document.getElementById('dependents').value) || 1;

    if (!salaryMan || salaryMan <= 0) { alert('연봉을 입력해주세요.'); return; }
    if (dependents < 1) { alert('부양가족 수는 1명 이상이어야 합니다.'); return; }

    var annual = salaryMan * 10000;
    var monthly = annual / 12;

    // 4대보험
    var pension = monthly * 0.0475;
    var health = monthly * 0.03595;
    var ltc = health * 0.1314;
    var employ = monthly * 0.009;
    var insuranceSum = pension + health + ltc + employ;

    // 소득세: 연 기준 계산 후 /12
    var incomeTax = calcIncomeTax(annual, dependents) / 12;
    var localTax = incomeTax * 0.1;
    var taxSum = incomeTax + localTax;

    var totalDeduct = insuranceSum + taxSum;
    var monthlyNet = monthly - totalDeduct;
    var annualNet = monthlyNet * 12;

    var fmt = function (n) { return Math.round(n).toLocaleString('ko-KR') + '원'; };

    document.getElementById('monthlyNet').textContent = fmt(monthlyNet);
    document.getElementById('annualNet').textContent = '세후 연봉 ' + fmt(annualNet);
    document.getElementById('insuranceTotal').textContent = fmt(insuranceSum);
    document.getElementById('taxTotal').textContent = fmt(taxSum);
    document.getElementById('deductTotal').textContent = fmt(totalDeduct);
    document.getElementById('annualNetStat').textContent = fmt(annualNet);

    var rows = [
      { name: '국민연금', rate: '4.75%', amount: pension },
      { name: '건강보험', rate: '3.595%', amount: health },
      { name: '장기요양보험', rate: '건보료×13.14%', amount: ltc },
      { name: '고용보험', rate: '0.90%', amount: employ },
      { name: '소득세', rate: '간이세액표', amount: incomeTax },
      { name: '지방소득세', rate: '소득세×10%', amount: localTax },
    ];

    var tbody = document.getElementById('deductBody');
    tbody.innerHTML = '';
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + r.name + '</td><td>' + r.rate + '</td><td>' + fmt(r.amount) + '</td>';
      tbody.appendChild(tr);
    });

    var totTr = document.createElement('tr');
    totTr.style.fontWeight = '700';
    totTr.style.background = '#eff6ff';
    totTr.innerHTML = '<td>합계</td><td>—</td><td>' + fmt(totalDeduct) + '</td>';
    tbody.appendChild(totTr);

    var card = document.getElementById('resultCard');
    card.classList.add('visible');
    setTimeout(function () { card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 50);
  }

  // 연간 소득세 계산 (근로소득 간이세액표 근사)
  function calcIncomeTax(annual, dependents) {
    // 근로소득공제
    var deduction;
    if (annual <= 5000000) {
      deduction = annual * 0.7;
    } else if (annual <= 15000000) {
      deduction = 3500000 + (annual - 5000000) * 0.4;
    } else if (annual <= 45000000) {
      deduction = 7500000 + (annual - 15000000) * 0.15;
    } else if (annual <= 100000000) {
      deduction = 12000000 + (annual - 45000000) * 0.05;
    } else {
      deduction = 14750000 + (annual - 100000000) * 0.02;
    }
    deduction = Math.min(deduction, 20000000);

    var earnedIncome = annual - deduction;

    // 인적공제 (150만원 × 부양가족수)
    var personalDeduct = dependents * 1500000;

    var taxBase = Math.max(earnedIncome - personalDeduct, 0);

    // 소득세율
    var tax;
    if (taxBase <= 14000000) {
      tax = taxBase * 0.06;
    } else if (taxBase <= 50000000) {
      tax = 840000 + (taxBase - 14000000) * 0.15;
    } else if (taxBase <= 88000000) {
      tax = 6240000 + (taxBase - 50000000) * 0.24;
    } else if (taxBase <= 150000000) {
      tax = 15360000 + (taxBase - 88000000) * 0.35;
    } else if (taxBase <= 300000000) {
      tax = 37060000 + (taxBase - 150000000) * 0.38;
    } else if (taxBase <= 500000000) {
      tax = 94060000 + (taxBase - 300000000) * 0.40;
    } else if (taxBase <= 1000000000) {
      tax = 174060000 + (taxBase - 500000000) * 0.42;
    } else {
      tax = 384060000 + (taxBase - 1000000000) * 0.45;
    }

    // 근로소득세액공제
    var taxCredit;
    if (tax <= 1300000) {
      taxCredit = tax * 0.55;
    } else {
      taxCredit = 715000 + (tax - 1300000) * 0.30;
    }
    var creditLimit;
    if (annual <= 33000000) {
      creditLimit = 740000;
    } else if (annual <= 70000000) {
      creditLimit = Math.max(740000 - (annual - 33000000) * 0.008, 660000);
    } else {
      creditLimit = 660000;
    }
    taxCredit = Math.min(taxCredit, creditLimit);

    return Math.max(tax - taxCredit, 0);
  }
});
