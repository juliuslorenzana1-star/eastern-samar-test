// Apply the stored theme before first paint without requiring inline scripts.
(function () {
  try {
    var mode = window.localStorage.getItem('escam.theme-mode') || 'system';
    var dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch { document.documentElement.dataset.theme = 'light'; }
})();
