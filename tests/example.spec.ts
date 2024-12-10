import { test, expect } from '@playwright/test';
import axios, { AxiosError } from 'axios';
import * as fs from 'fs';
import Papa from 'papaparse';

const WEB_URL = 'https://avoinna24.fi/lahdenhierojakoulu/reservation';
const API_BASE_URL = `https://avoinna24.fi/api`;
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

test('Hierojakoulu: clicking dropdowns', async ({ page }) => {
  const X_SYMBOL = `×`;
  const naistenNimet = readEtunimetCSV();

  for (const seq of SEQUENCES) {
    console.log(SEPARATOR);
    await page.goto(WEB_URL);
    await expect(page).toHaveTitle(/Ajanvaraus.*Lahden.*hierojakoulu/i);
    await page.waitForLoadState('domcontentloaded');
    
    const allDropdowns = page.locator('td-select');
    await allDropdowns.first().waitFor({ state: 'visible', timeout: 10000 });
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
    const valitse_tarjoaja = 'Valitse palveluntarjoaja';
    const kuka_tahansa = 'Kuka tahansa';
    let selectedHierojanNimi: string | undefined = undefined;
    const tarjoajaDropdown = page.locator(`label:has-text('${valitse_tarjoaja}') + td-select`);
    const hierojienNimet = (await tarjoajaDropdown.locator('div ul li').allInnerTexts()).filter((nimi) => nimi.length > 0);
    expect(hierojienNimet.length).toBeGreaterThan(1);

    for (const hierojanNimi of hierojienNimet) {
      const isWoman = isWomanName(hierojanNimi, naistenNimet);
      console.log(`Hierojan nimi: ${hierojanNimi} - likely woman:`, isWoman);
      if (!isWoman) {
        continue;
      }

      if (selectedHierojanNimi != null) {
        const tarjoajaDropdownSelected = page.locator('a').filter({ hasText: `${selectedHierojanNimi} ${X_SYMBOL}` });
        if (await tarjoajaDropdownSelected.isVisible()) {
          console.log(`New loop, removing previous selection ${selectedHierojanNimi} ...`);
          await tarjoajaDropdownSelected.locator('a').click(); // remove existing selection by clicking x
          expect(tarjoajaDropdownSelected).not.toBeVisible();
        };
        selectedHierojanNimi = undefined;
      }

      await page.locator('span', { hasText: kuka_tahansa }).isVisible();
      await page.locator('a').filter({ hasText: kuka_tahansa }).click();

      await page.getByRole('menuitem', { name: hierojanNimi }).click();
      await page.getByRole('heading', { name: hierojanNimi }).isVisible();
      selectedHierojanNimi = hierojanNimi;
      console.log(`Valittu palveluntarjoaja: ${hierojanNimi}`);
    }
    console.log(SEPARATOR);
    await page.reload();
  }
});