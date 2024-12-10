import { test, expect } from '@playwright/test';

//const URL = 'https://hierojakoulu.net/ajanvaraus/';
const URL = 'https://avoinna24.fi/lahdenhierojakoulu/reservation';
interface DropdownSequence {
  toimipiste: string;
  tyyppi: string;
  palvelu: string;
}
const SEQUENCES: DropdownSequence[] = [
  {
    toimipiste: 'LAHTI - Koulutetut hierojat (B-Karjalankatu 45)',
    tyyppi: 'Hieronta (koulutetut hierojat)',
    palvelu: '25 min hieronta (koul.hier.)',
  },
  {
    toimipiste: 'LAHTI - Opiskelijahieronta (Karjalankatu 45)',
    tyyppi: 'Opiskelijahieronta',
    palvelu: '25 min hieronta (opiskelija)',
  }
];
for (const seq of SEQUENCES) {
  for (const key of Object.keys(seq) as (keyof DropdownSequence)[]) {
    console.log(seq[key]);
  }
}

test('Hierojakoulu ajanvaraus', async ({ page }) => {
  const X_SYMBOL = `×`;
  for (const seq of SEQUENCES) {
    await page.goto(URL);
    await expect(page).toHaveTitle(/Ajanvaraus.*Lahden.*hierojakoulu/i);
    await page.waitForLoadState('domcontentloaded');
    
    const allDropdowns = page.locator('td-select');
    await allDropdowns.first().waitFor({ state: 'visible', timeout: 5000 });
    expect(await allDropdowns.count()).toEqual(4);

    for (const key of Object.keys(seq) as (keyof DropdownSequence)[]) {
      const dropdownText = seq[key];
      await page.locator('td-select').filter({ hasText: dropdownText }).locator('a').click();
      await page.getByRole('menuitem', { name: dropdownText }).click();
      const dropdownSelected = page.getByText(`${dropdownText} ${X_SYMBOL}`);
      expect(dropdownSelected).toBeVisible();
      console.log(`Valittu ${key}: ${dropdownText}`);
    }
  }

  await page.close();
});