import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { readWebapp } from './sourceFiles';
import { AuthCopyright } from '@/containers/Authentication/AuthCopyright';
import { AuthInsider } from '@/containers/Authentication/AuthInsider';

const MARK =
  '<span class="brand-mark brand-mark--sm" aria-label="Evena">E</span>';
const REPO_URL = ['https://github.com', 'shredder97', 'bigcapital'].join('/');

describe('AuthCopyright', () => {
  it('shows the small E', () => {
    expect(renderToStaticMarkup(<AuthCopyright />)).toBe(MARK);
  });

  it('does not render the rejected source line', () => {
    const view = renderToStaticMarkup(<AuthCopyright />);
    expect(view).not.toContain('<a');
    expect(view).not.toContain('href');
    expect(view).not.toContain(REPO_URL);
    expect(view).not.toContain('based on Bigcapital');
    expect(view).not.toContain('AGPL');
    expect(view).not.toContain('Source');
  });

  it('has no link in the component source', () => {
    const source = readWebapp(
      'src/containers/Authentication/AuthCopyright.tsx',
    );
    expect(source).toContain('<BrandMark className="brand-mark--sm" />');
    expect(source).not.toContain('href');
    expect(source).not.toContain(REPO_URL);
    expect(source).not.toContain('based on Bigcapital');
    expect(source).not.toContain('bigcapital');
  });

  it('places that E under the auth card', () => {
    const view = renderToStaticMarkup(
      <AuthInsider>
        <p>Sign in</p>
      </AuthInsider>,
    );
    expect(view).toContain('Sign in');
    expect(view).toContain(MARK);
    expect(view).not.toContain(REPO_URL);
  });

  it('omits the mark when the copyright slot is off', () => {
    const view = renderToStaticMarkup(
      <AuthInsider copyright={false}>
        <p>Sign in</p>
      </AuthInsider>,
    );
    expect(view).toContain('Sign in');
    expect(view).not.toContain('brand-mark');
  });
});
