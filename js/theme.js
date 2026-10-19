(function () {
  'use strict';
  var key = 'lifetoolanswer.theme';
  var choices = ['system', 'light', 'dark'];
  var root = document.documentElement;
  var query = window.matchMedia('(prefers-color-scheme: dark)');
  var mode = 'system';
  var printing = false;
  var control;
  var buttons = [];
  try {
    var saved = localStorage.getItem(key);
    if (choices.indexOf(saved) !== -1) mode = saved;
  } catch (error) { /* The switch still works when storage is unavailable. */ }

  function apply() {
    var theme = printing ? 'light' : mode === 'system' ? (query.matches ? 'dark' : 'light') : mode;
    var previous = root.dataset.theme;
    root.dataset.theme = theme;
    root.dataset.themeMode = mode;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta);
    }
    meta.content = theme === 'dark' ? '#101827' : '#ffffff';
    if (control) {
      control.style.setProperty('--theme-index', choices.indexOf(mode));
      buttons.forEach(function (button) {
        var selected = button.dataset.themeChoice === mode;
        button.setAttribute('aria-checked', String(selected));
        button.tabIndex = selected ? 0 : -1;
      });
    }
    if (previous !== theme) document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme, mode: mode } }));
  }
  function select(next) {
    if (choices.indexOf(next) === -1) return;
    mode = next;
    try {
      if (mode === 'system') localStorage.removeItem(key);
      else localStorage.setItem(key, mode);
    } catch (error) {
      var note = document.getElementById('themeStatus');
      if (note) note.textContent = '테마는 현재 페이지에 적용됐습니다. 브라우저 저장소를 사용할 수 없어 다음 방문에는 시스템 설정을 따릅니다.';
    }
    apply();
  }
  // Executed in <head>, before the page styles, to avoid a light flash.
  apply();
  function systemChanged() { if (mode === 'system') apply(); }
  if (query.addEventListener) query.addEventListener('change', systemChanged);
  else query.addListener(systemChanged);
  window.addEventListener('storage', function (event) {
    if (event.key !== key && event.key !== null) return;
    mode = choices.indexOf(event.newValue) !== -1 ? event.newValue : 'system'; apply();
  });
  window.addEventListener('beforeprint', function () { printing = true; apply(); });
  window.addEventListener('afterprint', function () { printing = false; apply(); });
  document.addEventListener('DOMContentLoaded', function () {
    control = document.querySelector('.theme-switch');
    if (!control) return;
    buttons = Array.from(control.querySelectorAll('[data-theme-choice]'));
    buttons.forEach(function (button) {
      button.addEventListener('click', function () { select(button.dataset.themeChoice); });
      button.addEventListener('keydown', function (event) {
        var index = choices.indexOf(mode), next;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % choices.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + choices.length - 1) % choices.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = choices.length - 1;
        else return;
        event.preventDefault(); select(choices[next]); buttons[next].focus();
      });
    });
    control.hidden = false; apply();
  });
})();
