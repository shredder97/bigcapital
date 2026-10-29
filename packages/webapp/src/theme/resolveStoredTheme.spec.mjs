import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { THEME_STORAGE_KEY, resolveStoredTheme } from './resolveStoredTheme.ts';

const bootPreload = (stored) => {
  const htmlClasses = new Set();
  const bodyClasses = new Set();
  const classList = (classes) => ({
    add: (name) => {
      classes.add(name);
    },
    remove: (name) => {
      classes.delete(name);
    },
    toggle: (name, force) => {
      if (force) {
        classes.add(name);
      } else {
        classes.delete(name);
      }
    },
    contains: (name) => classes.has(name),
  });
  const context = vm.createContext({
    localStorage: {
      getItem: (key) => (key === THEME_STORAGE_KEY ? stored : null),
    },
    document: {
      documentElement: { classList: classList(htmlClasses) },
      body: { classList: classList(bodyClasses) },
    },
    window: {
      location: { pathname: '/' },
      matchMedia: () => ({ matches: true }),
    },
  });
  const source = fs.readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../public/preload-theme.js',
    ),
    'utf8',
  );

  vm.runInContext(source, context);

  return {
    htmlDark: htmlClasses.has('bp4-dark'),
    bodyDark: bodyClasses.has('bp4-dark'),
  };
};

test('saved dark preference stays dark', () => {
  assert.equal(resolveStoredTheme('dark'), 'dark');

  const booted = bootPreload('dark');

  assert.equal(booted.htmlDark, true);
  assert.equal(booted.bodyDark, true);
});

test('no stored preference resolves to light', () => {
  assert.equal(resolveStoredTheme(null), 'light');
  assert.equal(resolveStoredTheme(undefined), 'light');
  assert.equal(resolveStoredTheme(''), 'light');

  // matchMedia is stubbed to prefer dark. That is not a stored preference.
  const booted = bootPreload(null);

  assert.equal(booted.htmlDark, false);
  assert.equal(booted.bodyDark, false);
});
