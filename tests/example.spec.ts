import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import Papa from 'papaparse';

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
const TARJOAJA = 'Valitse palveluntarjoaja';
const SEPARATOR = '---------------------------------';

function readEtunimetCSV(): string[] {
  const filePath = './data/etunimitilasto-2024-08-05-dvv-naiset-kaikki.csv';
  const naistenEtunimet: string[] = [];

  const fileContent = fs.readFileSync(filePath, 'utf8');
  Papa.parse(fileContent, {
    header: true,
    delimiter: ';',
    complete: (results) => {
      // only check against 1000 most common names
      results.data.slice(0, 1000).forEach((row) => {
        const name = row['Etunimi'];
        if (name != null && name.length > 0) {
          naistenEtunimet.push(name);
        }
      });
    },
  });
  if (naistenEtunimet.length === 0) {
    throw('Failed to process CSV file: 0 rows parsed');
  }
  console.log(`CSV file processed successfully. Checking against ${naistenEtunimet.length} women names in Finland`);
  return naistenEtunimet;
};

function isWomanName(name: string, womenNames: string[]): boolean {
  const etunimi = name.trimStart().split(' ')[0];
  return womenNames.includes(etunimi);
}

test('Hierojakoulu ajanvaraus', async ({ page }) => {
  const X_SYMBOL = `×`;
  const naistenNimet = readEtunimetCSV();

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
    const tarjoajaDropdown = page.locator(`label:has-text('${TARJOAJA}') + td-select`);
    const hierojat = tarjoajaDropdown.locator('div ul li');
    const count = await hierojat.count();
    expect(count).toBeGreaterThan(1);
    for (let i = 0; i < count; i++) {
      const hierojanNimi = (await hierojat.nth(i).innerText());
      if (hierojanNimi.length === 0) {
        continue;
      }
      //await hierojat.nth(i).click();
      console.log(`Hierojan nimi: ${hierojanNimi} - likely woman:`,isWomanName(hierojanNimi, naistenNimet));
      //const hierojaSelected = page.getByText(`${hierojanNimi} ${X_SYMBOL} `);
      //expect(hierojaSelected).toBeVisible();
    }
    console.log(SEPARATOR);
  }
  await page.close();
});