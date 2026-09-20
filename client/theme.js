// Light/dark theme. Runs in <head> so the right theme is applied before first
// paint (no flash). Saved choice wins; otherwise follow the OS setting.
(function () {
  var KEY = 'theme';
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

  function saved() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function resolve() {
    var s = saved();
    if (s === 'light' || s === 'dark') return s;
    return media && media.matches ? 'light' : 'dark';
  }
  function apply(theme) {
    root.setAttribute('data-theme', theme);
    var btn = document.querySelector('button.theme-toggle');
    if (btn) {
      btn.textContent = theme === 'light' ? '\u{1F319}' : '☀️';
      btn.title = theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
      btn.setAttribute('aria-label', btn.title);
    }
    document.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
  }

  apply(resolve());
  if (media && media.addEventListener) {
    media.addEventListener('change', function () { if (!saved()) apply(resolve()); });
  }

  // Called by shared.js's renderNav (or automatically on pages with no navbar).
  window.mountThemeToggle = function (parent, floating) {
    if (document.querySelector('button.theme-toggle')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-toggle ghost' + (floating ? ' floating' : '');
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      try { localStorage.setItem(KEY, next); } catch (e) {}
      apply(next);
    });
    parent.appendChild(btn);
    apply(root.getAttribute('data-theme'));
  };

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('topnav')) window.mountThemeToggle(document.body, true);
  });
})();
