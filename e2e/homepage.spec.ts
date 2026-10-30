import { createRequire } from 'module';
import path from 'path';
import { expect, test } from '@playwright/test';
import { readApiAuth, type ApiAuth } from './_api';
import {
  authCookies,
  generateCredentials,
  signInUser,
} from './_auth';
import {
  financialReportMenuData,
  type FinancialReportMenuItem,
  type FinancialReportMenuSection,
} from '../packages/webapp/src/constants/financialReportsMenu.data';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const API_BASE = process.env.PLAYWRIGHT_TEST_API_URL || 'http://localhost:3000';

test('homepage shortcut pill describes itself and shows a tooltip on focus', async ({
  page,
}) => {
  await page.goto('/');

  const pill = page.locator('a.homepage-pill').first();
  await expect(pill).toBeVisible();

  const describedBy = await pill.getAttribute('aria-describedby');
  expect(describedBy).toBeTruthy();

  const description = pill.locator(`[id="${describedBy}"]`);
  await expect(description).toHaveText(/\S/);

  await pill.focus();
  const text = await description.innerText();
  await expect(page.locator('.homepage-shortcut-tooltip')).toBeVisible();
  await expect(page.locator('.homepage-shortcut-tooltip')).toContainText(
    text.trim(),
  );
});

async function apiSend(auth: ApiAuth, path: string, init: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${auth.accessToken}`,
      'organization-id': auth.organizationId,
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      `${init.method ?? 'GET'} ${path} failed: ${res.status} ${JSON.stringify(body)}`,
    );
  }
  return body;
}

async function featureMap(auth: ApiAuth): Promise<Record<string, boolean>> {
  const body = await apiSend(auth, '/api/dashboard/boot');
  const features = body?.features ?? [];
  const map: Record<string, boolean> = {};
  for (const feature of features) {
    map[feature.name] = Boolean(
      feature.is_accessible ?? feature.isAccessible,
    );
  }
  return map;
}

function isQueryLink(link: string): boolean {
  return link.includes('?');
}

function isWithheldFromRestrictedRole(report: FinancialReportMenuItem): boolean {
  return report.subject === 'AuditLog' || report.link.endsWith('/journal-sheet');
}

function featureAllows(
  report: FinancialReportMenuItem,
  features: Record<string, boolean>,
): boolean {
  return !report.feature || features[report.feature] === true;
}

function visibleSections(
  sections: FinancialReportMenuSection[],
  can: (report: FinancialReportMenuItem) => boolean,
  features: Record<string, boolean>,
): FinancialReportMenuSection[] {
  return sections
    .map((section) => ({
      ...section,
      reports: section.reports.filter(
        (report) => featureAllows(report, features) && can(report),
      ),
    }))
    .filter((section) => section.reports.length > 0);
}

function assertableHrefs(sections: FinancialReportMenuSection[]): string[] {
  return sections.flatMap((section) =>
    section.reports
      .filter((report) => !isQueryLink(report.link))
      .map((report) => report.link),
  );
}

function rolePermissionsFor(
  sections: FinancialReportMenuSection[],
  include: (report: FinancialReportMenuItem) => boolean,
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

async function expectReportPills(
  page: import('@playwright/test').Page,
  sections: FinancialReportMenuSection[],
) {
  const rendered = page.locator('section.homepage-shortcuts__section');
  await expect(rendered).toHaveCount(sections.length);

  for (let index = 0; index < sections.length; index += 1) {
    await expect(
      rendered.nth(index).locator('a.homepage-pill'),
    ).toHaveCount(sections[index].reports.length);
  }

  for (const href of assertableHrefs(sections)) {
    await expect(
      page.locator(`a.homepage-pill[href="${href}"]`),
      href,
    ).toHaveCount(1);
  }

  const pill = page.locator('.homepage-shortcuts a.homepage-pill').first();
  await expect(pill).toBeVisible();
  const describedBy = await pill.getAttribute('aria-describedby');
  await expect(pill.locator(`[id="${describedBy}"]`)).toHaveText(/\S/);
}

test('financial reports index renders the menu pills the user is allowed to open', async ({
  page,
}) => {
  const menu = financialReportMenuData;
  const features = await featureMap(readApiAuth());
  const sections = visibleSections(menu, () => true, features);

  await page.goto('/financial-reports');
  await expectReportPills(page, sections);

  for (const report of menu.flatMap((section) => section.reports)) {
    if (report.feature && features[report.feature] !== true && !report.link.includes('?')) {
      await expect(
        page.locator(`a.homepage-pill[href="${report.link}"]`),
        report.link,
      ).toHaveCount(0);
    }
  }
});

async function inviteToken(email: string): Promise<string> {
  const mysql = require(
    require.resolve('mysql2/promise', {
      paths: [path.join(process.cwd(), 'packages/server')],
    }),
  ) as {
    createConnection: (options: {
      host: string;
      user: string;
      password: string;
      database: string;
    }) => Promise<{
      query: (
        sql: string,
        params: string[],
      ) => Promise<[Array<{ token: string }>, unknown]>;
      end: () => Promise<void>;
    }>;
  };
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'bigcapital',
    password: process.env.DB_PASSWORD || 'bigcapital',
    database: process.env.SYSTEM_DB_NAME || 'bigcapital_system',
  });
  try {
    const [tables] = await connection.query(
      `SELECT table_name AS tableName
       FROM information_schema.tables
       WHERE table_schema = DATABASE() AND LOWER(table_name) = 'user_invites'`,
      [],
    );
    const tableName = tables[0]?.tableName;
    if (!tableName) {
      throw new Error('user_invites table was not found in the system database');
    }
    const [rows] = await connection.query(
      `SELECT token FROM \`${tableName.replace(/`/g, '')}\` WHERE email = ? ORDER BY id DESC LIMIT 1`,
      [email],
    );
    const token = (rows as Array<{ token: string }>)[0]?.token;
    if (!token) {
      throw new Error(`No invite token stored for ${email}`);
    }
    return token;
  } finally {
    await connection.end();
  }
}

test('a role without audit log or journal access sees only its pills and no empty sections', async ({
  browser,
  baseURL,
}) => {
  const menu = financialReportMenuData;
  const admin = readApiAuth();
  const credentials = generateCredentials();
  credentials.password = 'E2eReports1!';

  const created = await apiSend(admin, '/api/roles', {
    method: 'POST',
    body: JSON.stringify({
      role_name: `Reports ${credentials.email}`,
      role_description: 'e2e role without audit log or journal',
      permissions: rolePermissionsFor(
        menu,
        (report) => !isWithheldFromRestrictedRole(report),
      ),
    }),
  });
  const roleId = created?.data?.id ?? created?.id;
  if (!roleId) {
    throw new Error(`create role response missing id: ${JSON.stringify(created)}`);
  }

  await apiSend(admin, '/api/invite', {
    method: 'PATCH',
    body: JSON.stringify({ email: credentials.email, role_id: roleId }),
  });

  const token = await inviteToken(credentials.email);
  const accept = await fetch(`${API_BASE}/api/invite/accept/${token}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      first_name: credentials.firstName,
      last_name: credentials.lastName,
      password: credentials.password,
    }),
  });
  const acceptBody = await accept.json().catch(() => null);
  if (!accept.ok) {
    throw new Error(
      `accept invite failed: ${accept.status} ${JSON.stringify(acceptBody)}`,
    );
  }

  const session = await signInUser(API_BASE, credentials);
  const features = await featureMap({
    accessToken: session.accessToken,
    organizationId: session.organizationId,
    tenantId: String(session.tenantId),
  });
  const sections = visibleSections(
    menu,
    (report) => !isWithheldFromRestrictedRole(report),
    features,
  );
  const hidden = menu
    .flatMap((section) => section.reports)
    .filter(
      (report) =>
        isWithheldFromRestrictedRole(report) && !report.link.includes('?'),
    );

  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  await context.addCookies(
    authCookies(session, new URL(baseURL ?? 'http://localhost:4000').hostname),
  );
  const page = await context.newPage();
  try {
    await page.goto('/financial-reports');
    await expectReportPills(page, sections);
    for (const report of hidden) {
      await expect(
        page.locator(`a.homepage-pill[href="${report.link}"]`),
        report.link,
      ).toHaveCount(0);
    }
  } finally {
    await context.close();
  }
});
