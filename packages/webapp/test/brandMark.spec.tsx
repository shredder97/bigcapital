import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { readWebapp } from './sourceFiles';

describe('BrandMark', () => {
  it('renders a bold E labelled Evena at the default size', async () => {
    const { BrandMark } = await import('@/components/BrandMark');
    expect(renderToStaticMarkup(<BrandMark />)).toBe(
      '<span class="brand-mark" aria-label="Evena">E</span>',
    );
  });

  it('appends the small modifier without a size prop', async () => {
    const { BrandMark } = await import('@/components/BrandMark');
    expect(renderToStaticMarkup(<BrandMark className="brand-mark--sm" />)).toBe(
      '<span class="brand-mark brand-mark--sm" aria-label="Evena">E</span>',
    );
  });

  it('keeps extra classes after the mark classes', async () => {
    const { BrandMark } = await import('@/components/BrandMark');
    expect(
      renderToStaticMarkup(<BrandMark className="brand-mark--sm rail" />),
    ).toBe(
      '<span class="brand-mark brand-mark--sm rail" aria-label="Evena">E</span>',
    );
  });

  it('does not render a link', async () => {
    const { BrandMark } = await import('@/components/BrandMark');
    const view = renderToStaticMarkup(<BrandMark />);
    expect(view).not.toContain('<a');
    expect(view).not.toContain('href');
  });

  it('declares the mark in the existing base stylesheet', () => {
    const base = readWebapp('src/style/_base.scss');
    expect(base).toContain(
      "font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;",
    );
    expect(base).toContain('font-weight: 700;');
    expect(base).toContain('line-height: 1;');
    expect(base).toContain('color: currentColor;');
    expect(base).toContain('.brand-mark {');
    expect(base).toContain('font-size: 36px;');
    expect(base).toContain('.brand-mark--sm {');
    expect(base).toContain('font-size: 24px;');
  });
});
