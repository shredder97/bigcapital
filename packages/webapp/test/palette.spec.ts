import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const sass = require('sass') as typeof import('sass');

function compiledTheme(): string {
  const styleDir = path.resolve(__dirname, '../src/style');
  const nodeModules = (packageName: string) =>
    path.resolve(
      path.dirname(require.resolve(`${packageName}/package.json`)),
      '../..',
    );

  return sass.compileString(
    `@import '${path.join(styleDir, '_variables.scss')}';
.probe-primary { color: $fork-primary; }
.probe-hover { color: $fork-primary-hover; }
.probe-pressed { color: $fork-primary-pressed; }
.probe-dark-text { color: $fork-dark-text; }
.probe-submenu { background-color: $sidebar-popover-submenu-bg; }
.probe-outline { outline-color: $pt-outline-color; }
`,
    {
      loadPaths: [
        styleDir,
        nodeModules('@blueprintjs/core'),
        nodeModules('@blueprintjs/colors'),
      ],
    },
  ).css;
}

function block(css: string, selector: string): string {
  const match = css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`));
  if (!match) {
    throw new Error(`compiled CSS has no ${selector} block`);
  }
  return match[1];
}

function declaration(css: string, selector: string, property: string): string {
  const match = block(css, selector).match(
    new RegExp(`${property}\\s*:\\s*([^;]+);`),
  );
  if (!match) {
    throw new Error(`compiled CSS has no ${property} on ${selector}`);
  }
  return match[1].trim();
}

describe('Evena palette', () => {
  it('resolves the compiled theme colors', () => {
    const css = compiledTheme();

    expect(declaration(css, ':root', '--color-primary')).toBe('#7C5CBF');
    expect(declaration(css, ':root', '--color-sidebar-background')).toBe(
      '#2A1145',
    );
    expect(
      declaration(css, ':root', '--color-datatable-cell-focus-border'),
    ).toBe('var(--color-primary)');
    expect(
      declaration(css, ':root', '--color-bank-account-card-hover-border'),
    ).toBe('var(--color-primary)');
    expect(declaration(css, ':root', '--color-content-tab-hover-border')).toBe(
      'var(--color-primary)',
    );
    expect(declaration(css, ':root', '--color-content-tab-active-border')).toBe(
      'var(--color-primary)',
    );
    expect(declaration(css, ':root', '--color-content-tab-active-text')).toBe(
      'var(--color-primary)',
    );
    expect(
      declaration(css, ':root', '--color-stepper-step-active-background'),
    ).toBe('var(--color-primary)');

    const dark = block(css, 'body\\.bp4-dark');
    expect(declaration(css, 'body\\.bp4-dark', '--color-primary')).toBe(
      '#C8B8EC',
    );
    expect(
      declaration(css, 'body\\.bp4-dark', '--color-sidebar-background'),
    ).toBe('var(--color-dark-gray3)');
    expect(
      declaration(
        css,
        'body\\.bp4-dark',
        '--color-datatable-cell-focus-border',
      ),
    ).toBe('var(--color-primary)');
    expect(dark).not.toContain('--color-bank-account-card-hover-border');
    expect(
      declaration(css, 'body\\.bp4-dark', '--color-content-tab-hover-border'),
    ).toBe('rgba(255, 255, 255, 0.3)');
    expect(
      declaration(css, 'body\\.bp4-dark', '--color-content-tab-active-text'),
    ).toBe('var(--color-light-gray1)');
    expect(
      declaration(
        css,
        'body\\.bp4-dark',
        '--color-stepper-step-active-background',
      ),
    ).toBe('var(--color-dark-gray5)');

    expect(declaration(css, '\\.probe-primary', 'color')).toBe('#7C5CBF');
    expect(declaration(css, '\\.probe-hover', 'color')).toBe('#6B47B5');
    expect(declaration(css, '\\.probe-pressed', 'color')).toBe('#5E3F9F');
    expect(declaration(css, '\\.probe-dark-text', 'color')).toBe('#C8B8EC');
    expect(declaration(css, '\\.probe-submenu', 'background-color')).toBe(
      '#2A1145',
    );
    expect(declaration(css, '\\.probe-outline', 'outline-color')).toBe(
      'rgba(124, 92, 191, 0.6)',
    );
  });
});
