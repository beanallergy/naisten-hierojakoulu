import { test, expect } from '@playwright/test';
import csv from 'csv-parser';
import * as fs from 'fs';

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

  fs.createReadStream(filePath)
    .pipe(csv({ separator: ';' }))
    .on('data', (row: any) => {
      const name = row['Etunimi'];
      if (name == null || name.length === 0) {
        return;
      }
      naistenEtunimet.push(name);
    })
    .on('end', () => {
      if (naistenEtunimet.length === 0) {
        throw('Failed to process CSV file: 0 rows parsed');
      }
      console.log(`CSV file processed successfully. Checking against ${naistenEtunimet.length} women names in Finland`);
    });
  return naistenEtunimet;
};

function isWomanName(name: string, womenNames: string[]): boolean {
  const etunimi = name.trimStart().split(' ')[0];
  console.log(`Checking first name ${etunimi}`);
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
    const hierojat = page.locator(`label:has-text('${TARJOAJA}') + td-select div ul li`);
    const count = await hierojat.count();
    expect(count).toBeGreaterThan(1);
    for (let i = 0; i < count; i++) {
      const hierojanNimi = (await hierojat.nth(i).innerText());
      if (hierojanNimi.length === 0) {
        continue;
      }
      //await hierojat.nth(i).click();
      console.log(`Hierojan nimi: ${hierojanNimi} - isWomanName=${isWomanName(hierojanNimi, naistenNimet)}`);
      //const hierojaSelected = page.getByText(`${hierojanNimi} ${X_SYMBOL} `);
      //expect(hierojaSelected).toBeVisible();
    }
    console.log(SEPARATOR);
  }
  await page.close();
});