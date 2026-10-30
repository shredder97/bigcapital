import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const esbuild = require(
  require.resolve('esbuild', {
    paths: [path.dirname(require.resolve('tsup/package.json'))],
  }),
) as typeof import('esbuild');

const repoRoot = process.cwd();
const webappSrc = path.join(repoRoot, 'packages/webapp/src');

export interface ReportMenuItem {
  link: string;
  ability: string;
  subject: string;
  feature?: string;
}

export interface ReportMenuSection {
  reports: ReportMenuItem[];
}

const COMPONENTS_STUB = `
  export function FormattedMessage() { return null; }
  export const T = FormattedMessage;
`;

function resolveWebappModule(specifier: string): string {
  const base = path.join(webappSrc, specifier);
  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    path.join(base, 'index.tsx'),
    path.join(base, 'index.ts'),
    path.join(base, 'index.jsx'),
    path.join(base, 'index.js'),
  ];
  const found = candidates.find(
    (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
  );
  if (!found) {
    throw new Error(`Cannot resolve @/${specifier} from the webapp source`);
  }
  return found;
}

let cached: ReportMenuSection[] | undefined;

/**
 * Loads `financialReportMenus` from the webapp source. The menu module pulls
 * in the components barrel, so that import is stubbed and the rest is bundled.
 */
export async function loadFinancialReportMenus(): Promise<ReportMenuSection[]> {
  if (cached) {
    return cached;
  }

  const result = await esbuild.build({
    absWorkingDir: repoRoot,
    entryPoints: [
      path.join(webappSrc, 'constants/financialReportsMenu.tsx'),
    ],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'node',
    jsx: 'automatic',
    plugins: [
      {
        name: 'webapp-alias',
        setup(build) {
          build.onResolve({ filter: /^@\// }, (args) => {
            if (args.path === '@/components') {
              return { path: 'components-stub', namespace: 'stub' };
            }
            return { path: resolveWebappModule(args.path.slice(2)) };
          });
          build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
            contents: COMPONENTS_STUB,
            loader: 'js',
          }));
        },
      },
    ],
  });

  const code = result.outputFiles[0].text;
  const loaded: { exports: { financialReportMenus?: ReportMenuSection[] } } = {
    exports: {},
  };
  const evaluate = new Function(
    'exports',
    'require',
    'module',
    code,
  ) as (
    exports: typeof loaded.exports,
    require: NodeRequire,
    module: typeof loaded,
  ) => void;
  evaluate(loaded.exports, require, loaded);

  const sections = loaded.exports.financialReportMenus;
  if (!sections?.length) {
    throw new Error('financialReportMenus did not load from the webapp source');
  }
  cached = sections.map((section) => ({
    reports: section.reports.map((report) => ({
      link: report.link,
      ability: report.ability,
      subject: report.subject,
      feature: report.feature,
    })),
  }));
  return cached;
}

export function isQueryLink(link: string): boolean {
  return link.includes('?');
}

/**
 * Reports withheld from the restricted e2e role: Audit Log, and Journal so a
 * section stays visible while one of its pills disappears.
 */
export function isWithheldFromRestrictedRole(report: ReportMenuItem): boolean {
  return report.subject === 'AuditLog' || report.link.endsWith('/journal-sheet');
}

export function featureAllows(
  report: ReportMenuItem,
  features: Record<string, boolean>,
): boolean {
  return !report.feature || features[report.feature] === true;
}

export function visibleSections(
  sections: ReportMenuSection[],
  can: (report: ReportMenuItem) => boolean,
  features: Record<string, boolean>,
): ReportMenuSection[] {
  return sections
    .map((section) => ({
      reports: section.reports.filter(
        (report) => featureAllows(report, features) && can(report),
      ),
    }))
    .filter((section) => section.reports.length > 0);
}

/** Links whose rendered href is stable enough to assert one-for-one. */
export function assertableHrefs(sections: ReportMenuSection[]): string[] {
  return sections.flatMap((section) =>
    section.reports
      .filter((report) => !isQueryLink(report.link))
      .map((report) => report.link),
  );
}

export function rolePermissionsFor(
  sections: ReportMenuSection[],
  include: (report: ReportMenuItem) => boolean,
): Array<{ subject: string; ability: string; value: true }> {
  const seen = new Set<string>();
  const permissions: Array<{ subject: string; ability: string; value: true }> =
    [];
  for (const section of sections) {
    for (const report of section.reports) {
      if (!include(report)) {
        continue;
      }
      const key = `${report.subject}\0${report.ability}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      permissions.push({
        subject: report.subject,
        ability: report.ability,
        value: true,
      });
    }
  }
  return permissions;
}
