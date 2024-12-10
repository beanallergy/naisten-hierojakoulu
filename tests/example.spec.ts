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
    tyyppi: 'Opiskelijahieronta', // TODO regex matches 3 elements here
    palvelu: '25 min hieronta (opiskelija)',
  }
];
const TARJOAJA = 'Valitse palveluntarjoaja';
const SEPARATOR = '---------------------------------';

test('Hierojakoulu ajanvaraus', async ({ page }) => {
  const X_SYMBOL = `×`;
  for (const seq of SEQUENCES) {
    console.log(SEPARATOR);
    await page.goto(URL);
    await expect(page).toHaveTitle(/Ajanvaraus.*Lahden.*hierojakoulu/i);
    await page.waitForLoadState('domcontentloaded');
    
    const allDropdowns = page.locator('td-select');
    await allDropdowns.first().waitFor({ state: 'visible', timeout: 5000 });
    expect(await allDropdowns.count()).toEqual(4);

    for (const key of Object.keys(seq) as (keyof DropdownSequence)[]) {
      const selectedText = seq[key];
      await page.locator('td-select').filter({ has: page.locator(`text="${selectedText}"`) }).locator('a').click();
      await page.getByRole('menuitem', { name: selectedText }).first().click();
      const dropdownSelected = page.getByText(`${selectedText} ${X_SYMBOL} `);
      expect(dropdownSelected).toBeVisible();
      console.log(`Valittu ${key}: ${selectedText}`);
    }
    // last dropdown
    const hierojat = page.locator(`label:has-text('${TARJOAJA}') + td-select div ul li`);
    const count = await hierojat.count();
    expect(count).toBeGreaterThan(1);
    for (let i = 0; i < count; i++) {
      const hierojanNimi = (await hierojat.nth(i).innerText());
      if (hierojanNimi.length === 0) {
        continue;
      }
      //await hierojat.nth(i).click();
      console.log(`Valittu hieroja: ${hierojanNimi}`);
      //const hierojaSelected = page.getByText(`${hierojanNimi} ${X_SYMBOL} `);
      //expect(hierojaSelected).toBeVisible();
    }
    console.log(SEPARATOR);
  }
  await page.close();
});