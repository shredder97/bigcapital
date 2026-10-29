export const THEME_STORAGE_KEY = 'theme';

export type ThemeName = 'light' | 'dark';

/**
 * Resolves the theme persisted in localStorage by public/preload-theme.js.
 * Only an explicit saved value is a preference. Anything else, including a
 * missing key, is light. Dark mode stays available when "dark" is stored.
 */
export function resolveStoredTheme(
  stored: string | null | undefined,
): ThemeName {
  if (stored === 'dark' || stored === 'light') {
    return stored;
  }
  return 'light';
}

export function persistTheme(theme: ThemeName): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}
