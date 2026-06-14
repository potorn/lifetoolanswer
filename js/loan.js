document.addEventListener('DOMContentLoaded', function () {
  var periodUnit = 'year';

  document.querySelectorAll('.unit-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.unit-btn').forEach(function (b) { b.classList.remove('active'); });
      this.classList.add('active');
      periodUnit = this.dataset.unit;
      document.getElementById('periodUnit').textContent = periodUnit === 'year' ? '년' : '개월';
      document.getElementById('period').placeholder = periodUnit === 'year' ? '예: 20' : '예: 240';
    });
  });

  document.getElementById('calcBtn').addEventListener('click', calculate);

  document.querySelectorAll('input[type="number"]').forEach(function (inp) {
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') calculate(); });
  });

  function calculate() {
    var principal = parseFloat(document.getElementById('principal').value);
    var annualRate = parseFloat(document.getElementById('rate').value);
    var periodVal = parseFloat(document.getElementById('period').value);
    var graceMonths = parseInt(document.getElementById('grace').value) || 0;
    var method = document.getElementById('method').value;

    if (!principal || !annualRate || !periodVal) {
      alert('모든 항목을 입력해주세요.');
      return;
    }

    if (principal <= 0 || annualRate <= 0 || annualRate > 100 || periodVal <= 0) {
      alert('올바른 값을 입력해주세요.');
      return;
    }

    principal = principal * 10000; // 만원 → 원
    var months = periodUnit === 'year' ? periodVal * 12 : periodVal;

    if (months > 600) {
      alert('대출 기간은 최대 50년(600개월)까지 입력 가능합니다.');
      return;
    }

    if (graceMonths < 0 || graceMonths >= months) {
      alert('거치기간은 0개월 이상, 대출 기간보다 짧아야 합니다.');
      return;
    }

    var r = annualRate / 100 / 12;
    var repayMonths = months - graceMonths;
    var graceInterest = principal * r; // 거치기간 월 이자 (원금 고정)
    var fmt = function (n) { return Math.round(n).toLocaleString('ko-KR'); };

    var schedule = [];
    var monthlyPayment, totalInterest, totalPayment;

    // 거치기간 행 추가 (공통)
    for (var g = 1; g <= graceMonths; g++) {
      schedule.push({
        month: g,
        payment: Math.round(graceInterest),
        principal: 0,
        interest: Math.round(graceInterest),
        balance: Math.round(principal),
        isGrace: true
      });
    }

    if (method === 'equal-payment') {
      // 원리금균등상환
      if (r === 0) {
        monthlyPayment = principal / repayMonths;
      } else {
        monthlyPayment = principal * r * Math.pow(1 + r, repayMonths) / (Math.pow(1 + r, repayMonths) - 1);
      }

      var balance = principal;
      for (var i = 1; i <= repayMonths; i++) {
        var interest = balance * r;
        var prinPart = monthlyPayment - interest;
        balance -= prinPart;
        schedule.push({
          month: graceMonths + i,
          payment: Math.round(monthlyPayment),
          principal: Math.round(prinPart),
          interest: Math.round(interest),
          balance: Math.max(0, Math.round(balance))
        });
      }

      totalPayment = graceInterest * graceMonths + monthlyPayment * repayMonths;
      totalInterest = totalPayment - principal;

      if (graceMonths > 0) {
        document.getElementById('monthlyNote').innerHTML =
          '거치기간 ' + graceMonths + '개월: 이자 ' + fmt(graceInterest) + '원/월<br>' +
          '상환 시작 후: 매월 ' + fmt(monthlyPayment) + '원';
        document.getElementById('monthlyNote').style.display = 'block';
        document.getElementById('monthlyValue').textContent = fmt(monthlyPayment) + '원';
      } else {
        document.getElementById('monthlyNote').style.display = 'none';
        document.getElementById('monthlyValue').textContent = fmt(monthlyPayment) + '원';
      }

    } else if (method === 'equal-principal') {
      // 원금균등상환
      var prinPart2 = principal / repayMonths;
      totalInterest = graceInterest * graceMonths;
      var balance2 = principal;

      for (var j = 1; j <= repayMonths; j++) {
        var interest2 = balance2 * r;
        var payment2 = prinPart2 + interest2;
        totalInterest += interest2;
        balance2 -= prinPart2;
        schedule.push({
          month: graceMonths + j,
          payment: Math.round(payment2),
          principal: Math.round(prinPart2),
          interest: Math.round(interest2),
          balance: Math.max(0, Math.round(balance2))
        });
      }

      monthlyPayment = schedule[graceMonths].payment; // 상환 시작 1회차
      totalPayment = principal + totalInterest;

      if (graceMonths > 0) {
        document.getElementById('monthlyNote').innerHTML =
          '거치기간 ' + graceMonths + '개월: 이자 ' + fmt(graceInterest) + '원/월<br>' +
          '※ 원금균등상환: 상환 시작 후 1회차 기준 (이후 매월 감소)';
      } else {
        document.getElementById('monthlyNote').innerHTML =
          '※ 원금균등상환: 1회차 기준 (이후 매월 감소)';
      }
      document.getElementById('monthlyNote').style.display = 'block';
      document.getElementById('monthlyValue').textContent = fmt(monthlyPayment) + '원';

    } else {
      // 만기일시상환 (거치기간과 무관하게 전 기간 이자만 납부)
      var monthlyInt = principal * r;
      monthlyPayment = monthlyInt;
      totalInterest = monthlyInt * months;
      totalPayment = principal + totalInterest;

      for (var k = 1; k <= repayMonths; k++) {
        var isLast = k === repayMonths;
        schedule.push({
          month: graceMonths + k,
          payment: isLast ? Math.round(principal + monthlyInt) : Math.round(monthlyInt),
          principal: isLast ? Math.round(principal) : 0,
          interest: Math.round(monthlyInt),
          balance: isLast ? 0 : Math.round(principal)
        });
      }

      document.getElementById('monthlyValue').textContent = fmt(monthlyPayment) + '원';
      document.getElementById('monthlyNote').textContent = '※ 만기일시상환: 매월 이자만 납부, 만기에 원금 일시 상환';
      document.getElementById('monthlyNote').style.display = 'block';
    }

    document.getElementById('totalInterest').textContent = fmt(totalInterest) + '원';
    document.getElementById('totalPayment').textContent = fmt(totalPayment) + '원';

    var interestRatio = totalPayment > 0 ? (totalInterest / totalPayment) * 100 : 0;
    var principalRatio = 100 - interestRatio;

    document.getElementById('ratioPrincipal').style.width = principalRatio.toFixed(1) + '%';
    document.getElementById('legendPrincipal').textContent = '원금 ' + principalRatio.toFixed(1) + '%';
    document.getElementById('legendInterest').textContent = '이자 ' + interestRatio.toFixed(1) + '%';

    renderSchedule(schedule, months);

    var card = document.getElementById('resultCard');
    card.classList.add('visible');
    setTimeout(function () {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }

  function renderSchedule(schedule, totalMonths) {
    var tbody = document.getElementById('scheduleBody');
    tbody.innerHTML = '';

    var fmt = function (n) { return n.toLocaleString('ko-KR'); };

    var rows;
    if (totalMonths <= 12) {
      rows = schedule;
    } else {
      rows = schedule.slice(0, 6).concat([null]).concat([schedule[schedule.length - 1]]);
    }

    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      if (!row) {
        tr.innerHTML = '<td colspan="5" style="text-align:center;color:#94a3b8;font-size:0.8rem;padding:6px;">⋮ 중간 생략 ⋮</td>';
      } else {
        if (row.isGrace) {
          tr.style.background = '#eff6ff';
        }
        tr.innerHTML =
          '<td>' + row.month + '회' + (row.isGrace ? ' <span style="font-size:0.7rem;color:#3b82f6;font-weight:700;">거치</span>' : '') + '</td>' +
          '<td>' + fmt(row.payment) + '</td>' +
          '<td>' + fmt(row.principal) + '</td>' +
          '<td>' + fmt(row.interest) + '</td>' +
          '<td>' + fmt(row.balance) + '</td>';
      }
      tbody.appendChild(tr);
    });
  }
});
