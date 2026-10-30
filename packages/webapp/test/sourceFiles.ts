import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

export const webappRoot = path.resolve(__dirname, '..');
export const repoRoot = path.resolve(webappRoot, '../..');

const SOURCE_EXTENSIONS = ['.scss', '.css', '.ts', '.tsx', '.js', '.jsx'];
const SKIP_DIRECTORIES = new Set(['node_modules', 'static']);

export function readWebapp(relativePath: string): string {
  return readFileSync(path.join(webappRoot, relativePath), 'utf8');
}

export function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

export function listSourceFiles(): string[] {
  const files: string[] = [];

  const walk = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const fullPath = path.join(directory, entry);
      if (statSync(fullPath).isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry)) {
          walk(fullPath);
        }
        continue;
      }
      if (SOURCE_EXTENSIONS.includes(path.extname(fullPath))) {
        files.push(fullPath);
      }
    }
  };

  walk(path.join(webappRoot, 'src'));
  return files;
}

export interface SourceHit {
  file: string;
  line: number;
  text: string;
}

/**
 * Line search equivalent to `rg -n` over packages/webapp/src, skipping /static.
 */
export function searchSource(pattern: RegExp): SourceHit[] {
  const hits: SourceHit[] = [];

  for (const file of listSourceFiles()) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((text, index) => {
      if (pattern.test(text)) {
        hits.push({
          file: path.relative(webappRoot, file),
          line: index + 1,
          text: text.trim(),
        });
      }
    });
  }

  return hits;
}

export function braceBlock(source: string, header: string): string {
  const start = source.indexOf(header);
  if (start < 0) {
    throw new Error(`missing block header: ${header}`);
  }

  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const character = source[index];
    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(open + 1, index);
      }
    }
  }

  throw new Error(`unclosed block: ${header}`);
}

export function customProperties(block: string): Map<string, string[]> {
  const properties = new Map<string, string[]>();

  for (const match of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    const name = match[1];
    const values = properties.get(name) ?? [];
    values.push(match[2].trim());
    properties.set(name, values);
  }

  return properties;
}

export function formatHits(hits: SourceHit[]): string {
  return hits.map((hit) => `${hit.file}:${hit.line}: ${hit.text}`).join('\n');
}
