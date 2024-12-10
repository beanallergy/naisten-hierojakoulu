import { test, expect } from '@playwright/test';

//const URL = 'https://hierojakoulu.net/ajanvaraus/';
const URL = 'https://avoinna24.fi/lahdenhierojakoulu/reservation';

test('Hierojakoulu ajanvaraus', async ({ page }) => {
  await page.goto(URL);
  await expect(page).toHaveTitle(/Ajanvaraus.*Lahden.*hierojakoulu/i);
  await page.waitForLoadState('domcontentloaded');
  
  const allDropdowns = page.locator('td-select');
  await allDropdowns.first().waitFor({ state: 'visible', timeout: 5000 });
  expect(await allDropdowns.count()).toEqual(4);

  const KOULUTETUT_HIEROJAT_TEXT = 'LAHTI - Koulutetut hierojat (B-Karjalankatu 45)';
  const OPISKELIJAT_TEXT = 'LAHTI - Opiskelijahieronta (Karjalankatu 45)';

  const open_toimipiste_select = page.locator('td-select').filter({ hasText: KOULUTETUT_HIEROJAT_TEXT }).locator('a');
  await open_toimipiste_select.waitFor({ state: 'visible', timeout: 2000 });
  await open_toimipiste_select.click();

  const koulutetut = page.getByRole('menuitem', { name: KOULUTETUT_HIEROJAT_TEXT });
  const opiskelijat = page.getByRole('menuitem', { name: OPISKELIJAT_TEXT });
  await koulutetut.waitFor({ state: 'visible' });
  await opiskelijat.waitFor({ state: 'visible' });
  expect(opiskelijat).toBeVisible();

  await page.close();
});