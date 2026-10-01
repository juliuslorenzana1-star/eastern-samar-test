// Light / Dark / System theme control for the whole platform.
//
// The resolved mode is written to <html data-theme="..."> so a single attribute
// flips every surface, including the Leaflet basemap. The stored preference is
// kept separately from the resolved value: "system" must keep following the
// operating system until the resident chooses a fixed mode.

export const themeModes = ['light', 'dark', 'system'];
const storageKey = 'escam.theme-mode';

export function readStoredThemeMode() {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return themeModes.includes(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function systemPrefersDark() {
  return Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

export function resolveThemeMode(mode) {
  if (mode === 'light' || mode === 'dark') return mode;
  return systemPrefersDark() ? 'dark' : 'light';
}

export function applyThemeMode(mode) {
  const resolved = resolveThemeMode(mode);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    const isDarkVariant = (meta.media || '').includes('dark');
    meta.setAttribute('content', isDarkVariant === (resolved === 'dark') ? '#0a1210' : '#edf3f0');
  });
  return resolved;
}

export function storeThemeMode(mode) {
  try {
    window.localStorage.setItem(storageKey, mode);
  } catch {
    // Private browsing or disabled storage: the in-memory mode still applies.
  }
}

// Called by React so the tab follows the OS while "System" is selected.
export function watchSystemTheme(onChange) {
  if (!window.matchMedia) return () => {};
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = () => onChange();
  if (query.addEventListener) query.addEventListener('change', listener);
  else query.addListener(listener);
  return () => {
    if (query.removeEventListener) query.removeEventListener('change', listener);
    else query.removeListener(listener);
  };
}
