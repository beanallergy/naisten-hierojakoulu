import { test, expect } from '@playwright/test';
import axios, { AxiosError, AxiosResponse } from 'axios';
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

test.skip('Hierojakoulu: calling APIs - NOT WORKING BECAUSE OF CORS', async () => {
  const company = await axios.get(`${API_BASE_URL}/company/lahdenhierojakoulu?include=extensionsettings,branches`);
  expect(company.status).toBe(200);
  expect(company.data).toHaveProperty('data.attributes.branches');
  const allBranches: any[] = company.data.data.attributes.branches;
  const branchToLookup = SEQUENCES[0].toimipiste;
  const BRANCH_ID = allBranches.filter((branch) => branch.name === branchToLookup)[0]['branch_id'];
  let reservationFilter: any;
  try {
    console.info(`Fetching reservationfilter API with branch ${branchToLookup} id=${BRANCH_ID} (looked up from /company API)`);
    reservationFilter = await axios.get(
      `${API_BASE_URL}/reservationfilter/?branch_id=${BRANCH_ID}`,
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Referer": `${WEB_URL}?branch_id=${BRANCH_ID}`,
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
        }
      }
    );
  } catch (error: AxiosError | any) {
    console.error('Failed to fetch reservationfilter API with headers:', (error as AxiosError).request?._header, 'response headers:', (error as AxiosError).response?.headers);
    throw(`Failed to fetch reservationfilter API: ${(error as AxiosError).response?.status} ${(error as AxiosError).response?.statusText}`);
  }
  console.log('reservationfilter API response:', reservationFilter.data);
});

test('Hierojakoulu: clicking dropdowns', async ({ page }) => {
  const X_SYMBOL = `×`;
  const naistenNimet = readEtunimetCSV();

  for (const seq of SEQUENCES) {
    console.log(SEPARATOR);
    await page.goto(WEB_URL);
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
    let selectedHieroja: string = '';
    const tarjoajaDropdown = page.locator(`label:has-text('${TARJOAJA}') + td-select`);
    const hierojat = tarjoajaDropdown.locator('div ul li');
    const count = await hierojat.count();
    await tarjoajaDropdown.locator('a').click();
    expect(count).toBeGreaterThan(1);
    for (let i = 0; i < count; i++) {
        if (selectedHieroja.length !== 0) {
          console.log(`Removing previous selection ${selectedHieroja} ...`);
          const tarjoajaDropdownSelected = page.locator('a').filter({ hasText: `${selectedHieroja} ${X_SYMBOL}` });
          await tarjoajaDropdownSelected.locator('a').click();
          expect(tarjoajaDropdownSelected).not.toBeVisible();
          selectedHieroja = '';
        }
        await tarjoajaDropdown.locator('a').click();

        const hierojanNimi = (await hierojat.nth(i).innerText());
        if (hierojanNimi.length === 0) {
          continue;
        }
        const isWoman = isWomanName(hierojanNimi, naistenNimet);
        console.log(`Hierojan nimi: ${hierojanNimi} - likely woman:`, isWoman);
        if (!isWoman) {
          continue;
        }
        await page.getByRole('menuitem', { name: hierojanNimi }).click();
        console.log(`Valittu palveluntarjoaja: ${hierojanNimi}`);
        selectedHieroja = hierojanNimi;
    }
    console.log(SEPARATOR);
  }
  await page.close();
});