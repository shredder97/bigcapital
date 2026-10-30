import { expect, test } from '@playwright/test';

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

test('financial reports index renders report pills as links', async ({
  page,
}) => {
  await page.goto('/financial-reports');

  const pills = page.locator('.homepage-shortcuts a.homepage-pill');
  await expect(pills.first()).toBeVisible();
  await expect(page.locator('.financial-reports__item')).toHaveCount(0);

  for (const href of [
    '/financial-reports/balance-sheet',
    '/financial-reports/trial-balance-sheet',
    '/financial-reports/profit-loss-sheet',
    '/financial-reports/cash-flow',
    '/financial-reports/journal-sheet',
    '/financial-reports/general-ledger',
    '/financial-reports/receivable-aging-summary',
    '/financial-reports/payable-aging-summary',
    '/financial-reports/purchases-by-items',
    '/financial-reports/sales-by-items',
    '/financial-reports/customers-balance-summary',
    '/financial-reports/vendors-balance-summary',
    '/financial-reports/transactions-by-customers',
    '/financial-reports/transactions-by-vendors',
    '/financial-reports/inventory-item-details',
    '/financial-reports/inventory-valuation',
    '/financial-reports/audit-log',
  ]) {
    await expect(
      page.locator(`a.homepage-pill[href="${href}"]`),
      href,
    ).toHaveCount(1);
  }

  const pill = pills.first();
  const describedBy = await pill.getAttribute('aria-describedby');
  await expect(pill.locator(`[id="${describedBy}"]`)).toHaveText(/\S/);
});
