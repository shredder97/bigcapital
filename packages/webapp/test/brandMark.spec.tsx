import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BrandMark } from '@/components/BrandMark';
import { AuthCopyright } from '@/containers/Authentication/AuthCopyright';
import { AuthInsider } from '@/containers/Authentication/AuthInsider';

const DEFAULT_MARK = '<span class="brand-mark" aria-label="Evena">E</span>';
const SMALL_MARK =
  '<span class="brand-mark brand-mark--sm" aria-label="Evena">E</span>';

describe('BrandMark', () => {
  it('renders an E with the default mark class', () => {
    expect(renderToStaticMarkup(<BrandMark />)).toBe(DEFAULT_MARK);
  });

  it('adds the small modifier to the mark class', () => {
    expect(renderToStaticMarkup(<BrandMark className="brand-mark--sm" />)).toBe(
      SMALL_MARK,
    );
  });

  it('keeps caller classes after the mark class', () => {
    expect(
      renderToStaticMarkup(<BrandMark className="brand-mark--sm rail" />),
    ).toBe(
      '<span class="brand-mark brand-mark--sm rail" aria-label="Evena">E</span>',
    );
  });
});

describe('AuthCopyright', () => {
  it('renders the small Evena mark', () => {
    expect(renderToStaticMarkup(<AuthCopyright />)).toBe(SMALL_MARK);
  });

  it('shows that mark under the auth card', () => {
    const view = renderToStaticMarkup(
      <AuthInsider>
        <p>Sign in</p>
      </AuthInsider>,
    );

    expect(view).toContain('Sign in');
    expect(view).toContain(SMALL_MARK);
  });

  it('omits the mark when the copyright slot is turned off', () => {
    const view = renderToStaticMarkup(
      <AuthInsider copyright={false}>
        <p>Sign in</p>
      </AuthInsider>,
    );

    expect(view).toContain('Sign in');
    expect(view).not.toContain('brand-mark');
  });
});
