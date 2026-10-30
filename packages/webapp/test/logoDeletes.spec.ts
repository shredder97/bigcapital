import { existsSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { formatHits, searchSource, webappRoot } from './sourceFiles';
import icons from '@/static/json/icons';

describe('removed Bigcapital logos', () => {
  it('deletes BigcapitalAlt', () => {
    expect(
      existsSync(
        path.join(webappRoot, 'src/components/Icons/BigcapitalAlt.tsx'),
      ),
    ).toBe(false);

    const hits = searchSource(/BigcapitalAlt/);
    expect(formatHits(hits)).toBe('');
  });

  it('removes the bigcapital and mini-bigcapital icon entries', () => {
    expect(icons).not.toHaveProperty('bigcapital');
    expect(icons).not.toHaveProperty('mini-bigcapital');

    const hits = searchSource(/icon=\{?['"](mini-)?bigcapital/);
    expect(formatHits(hits)).toBe('');
  });

  it('removes the Bigcapital object stylesheet and its import', () => {
    expect(
      existsSync(path.join(webappRoot, 'src/style/objects/Bigcapital.scss')),
    ).toBe(false);

    const hits = searchSource(
      /bigcapital--alt|data-icon='bigcapital'|objects\/Bigcapital/,
    );
    expect(formatHits(hits)).toBe('');
  });

  it('removes the auth icon-bigcapital color override', () => {
    const hits = searchSource(/icon-bigcapital/);
    expect(formatHits(hits)).toBe('');
  });
});
