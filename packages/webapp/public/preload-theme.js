// Theme preference lives in localStorage under "theme".
// A saved "dark" or "light" value wins. With nothing stored, light is the
// default — prefers-color-scheme is not a stored preference.
// Keep in sync with src/theme/resolveStoredTheme.ts.
function resolveStoredTheme(stored) {
  if (stored === 'dark' || stored === 'light') {
    return stored;
  }
  return 'light';
}

const theme = resolveStoredTheme(localStorage.getItem('theme'));
const isDark = theme === 'dark';

document.documentElement.classList.toggle('bp4-dark', isDark);
document.body.classList.toggle('bp4-dark', isDark);

// Payment portal pages stay in light mode.
if (window.location.pathname.startsWith('/payment')) {
  document.documentElement.classList.remove('bp4-dark');
  document.body.classList.remove('bp4-dark');
}
