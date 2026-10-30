import { describe, expect, it } from 'vitest';
import {
  braceBlock,
  customProperties,
  formatHits,
  readWebapp,
  searchSource,
} from './sourceFiles';

const NAVY = /#0047ab|#003d94|#00337d|#01115e|0, ?71, ?171/i;

describe('purple palette', () => {
  it('has no navy primary hexes under packages/webapp/src', () => {
    const hits = searchSource(NAVY);
    expect(formatHits(hits)).toBe('');
  });

  it('defines the light and dark runtime primaries', () => {
    const variables = readWebapp('src/style/_variables.scss');
    const root = customProperties(braceBlock(variables, ':root'));
    const dark = customProperties(braceBlock(variables, 'body.bp4-dark'));

    expect(root.get('--color-primary')).toEqual(['#7C5CBF']);
    expect(dark.get('--color-primary')).toEqual(['#C8B8EC']);
  });

  it('points live text, border, and background tokens at the runtime primary', () => {
    const root = customProperties(
      braceBlock(readWebapp('src/style/_variables.scss'), ':root'),
    );

    expect(root.get('--color-datatable-cell-focus-border')).toEqual([
      'var(--color-primary)',
    ]);
    expect(root.get('--color-bank-account-card-hover-border')).toEqual([
      'var(--color-primary)',
    ]);
    expect(root.get('--color-content-tab-hover-border')).toEqual([
      'var(--color-primary)',
    ]);
    expect(root.get('--color-content-tab-active-border')).toEqual([
      'var(--color-primary)',
    ]);
    expect(root.get('--color-content-tab-active-text')).toEqual([
      'var(--color-primary)',
    ]);
    expect(root.get('--color-stepper-step-active-background')).toEqual([
      'var(--color-primary)',
    ]);
    expect(root.get('--color-sidebar-background')).toEqual(['#2A1145']);
  });

  it('keeps one dark datatable focus token and drops the overridden copy', () => {
    const dark = customProperties(
      braceBlock(readWebapp('src/style/_variables.scss'), 'body.bp4-dark'),
    );

    expect(dark.get('--color-datatable-cell-focus-border')).toEqual([
      'var(--color-primary)',
    ]);
  });

  it('drops the dark bank-card hover hex so the root primary is used', () => {
    const dark = customProperties(
      braceBlock(readWebapp('src/style/_variables.scss'), 'body.bp4-dark'),
    );

    expect(dark.has('--color-bank-account-card-hover-border')).toBe(false);
  });

  it('keeps the dark content-tab hover override and the surviving active text', () => {
    const dark = customProperties(
      braceBlock(readWebapp('src/style/_variables.scss'), 'body.bp4-dark'),
    );

    expect(dark.get('--color-content-tab-hover-border')).toEqual([
      'rgba(255, 255, 255, 0.3)',
    ]);
    expect(dark.get('--color-content-tab-active-border')).toEqual([
      'var(--color-primary)',
    ]);
    expect(dark.get('--color-content-tab-active-text')).toEqual([
      'var(--color-light-gray1)',
    ]);
  });

  it('leaves the dark stepper active background on dark-gray5', () => {
    const dark = customProperties(
      braceBlock(readWebapp('src/style/_variables.scss'), 'body.bp4-dark'),
    );

    expect(dark.get('--color-stepper-step-active-background')).toEqual([
      'var(--color-dark-gray5)',
    ]);
  });

  it('leaves the dark alert primary tokens on the previous tint', () => {
    const dark = customProperties(
      braceBlock(readWebapp('src/style/_variables.scss'), 'body.bp4-dark'),
    );

    expect(dark.get('--color-alert-primary-border')).toEqual(['#9dbbf0']);
    expect(dark.get('--color-alert-primary-title-text')).toEqual(['#9dbbf0']);
  });

  it('compiles Blueprint primary, hover, pressed, dark text, and the focus ring', () => {
    const variables = readWebapp('src/style/_variables.scss');

    expect(variables).toContain('$fork-primary: #7C5CBF;');
    expect(variables).toContain('$fork-primary-hover: #6B47B5;');
    expect(variables).toContain('$fork-primary-pressed: #5E3F9F;');
    expect(variables).toContain('$fork-dark-text: #C8B8EC;');
    expect(variables).toContain('$blue3: $fork-primary;');
    expect(variables).toContain('$pt-link-color: $fork-primary;');
    expect(variables).toContain('$pt-intent-primary: $fork-primary;');
    expect(variables).toContain('$pt-icon-color-selected: $fork-primary;');
    expect(variables).toContain('$pt-dark-link-color: $fork-dark-text;');
    expect(variables).toContain(
      '$pt-dark-icon-color-selected: $fork-dark-text;',
    );
    expect(variables).toContain('$pt-outline-color: rgba(124, 92, 191, 0.6);');
    expect(variables).toContain(
      '"primary": ($fork-primary, $fork-primary-hover, $fork-primary-pressed)',
    );
  });

  it('does not darken the upstream blue steps used by footer link hover', () => {
    const variables = readWebapp('src/style/_variables.scss');
    expect(variables).toContain('$blue1: #0069ff;');
    expect(variables).toContain('$blue2: #0052ff;');
  });

  it('paints the sidebar submenu popover with the light sidebar color', () => {
    expect(readWebapp('src/style/_variables.scss')).toContain(
      '$sidebar-popover-submenu-bg: #2A1145;',
    );
  });

  it('moves dashboard text, icons, switches, and tab rules onto the runtime primary', () => {
    const dashboard = readWebapp('src/style/pages/Dashboard/Dashboard.scss');

    expect(dashboard).not.toMatch(/#0047ab/i);
    expect(dashboard).toContain('color: var(--color-primary);');
    expect(dashboard).toContain('background: var(--color-primary);');
    expect(dashboard).toContain(
      'box-shadow: inset 0 -2px 0 var(--color-primary);',
    );
  });

  it('deletes the dead quick-new dropdown rule', () => {
    const hits = searchSource(/form-group-quick-new-downDrop/);
    expect(formatHits(hits)).toBe('');
  });

  it('centres the sidebar mark in the collapsed rail and keeps the opacity transitions', () => {
    const sidebar = readWebapp('src/style/containers/Dashboard/Sidebar.scss');
    const logo = braceBlock(sidebar, '&-logo');

    expect(logo).toContain('left: 0;');
    expect(logo).toContain('width: 50px;');
    expect(logo).toContain('display: flex;');
    expect(logo).toContain('align-items: center;');
    expect(logo).toContain('justify-content: center;');
    expect(logo).toContain('color: var(--color-sidebar-text);');
    expect(sidebar).toContain('transition: opacity 0.3s ease-in-out;');
    expect(sidebar).toContain('transition-delay: 0.15s;');
    expect(sidebar).not.toContain('&-logo {}');
    expect(sidebar).not.toContain('Hide text of bigcapital logo');
  });
});
