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
