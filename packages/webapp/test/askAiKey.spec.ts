import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const needle = ['ANTHROPIC', 'API', 'KEY'].join('_');

function filesIn(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === 'dist') return [];
    const fullPath = path.join(dir, name);
    if (statSync(fullPath).isDirectory()) return filesIn(fullPath);
    return [fullPath];
  });
}

describe('Ask AI client bundle', () => {
  it('does not mention the server API key anywhere in the webapp', () => {
    const root = path.resolve(__dirname, '..');
    const hits = filesIn(root).filter((file) => {
      if (!/\.(ts|tsx|js|jsx|json|scss|css|md|html)$/.test(file)) return false;
      return readFileSync(file, 'utf8').includes(needle);
    });

    expect(hits).toEqual([]);
  });

  it('mounts the chat once in the dashboard layout and not on the homepage content', () => {
    const dashboard = readFileSync(
      path.resolve(__dirname, '../src/components/Dashboard/Dashboard.tsx'),
      'utf8',
    );
    const homepage = readFileSync(
      path.resolve(__dirname, '../src/containers/Homepage/HomepageContent.tsx'),
      'utf8',
    );

    expect(dashboard).toContain('<AskBox');
    expect(homepage).not.toContain('AskBox');
  });
});
