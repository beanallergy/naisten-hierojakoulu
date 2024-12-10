import { test, expect, Response, Request } from '@playwright/test';
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
    let selectedHierojanNimi: string | undefined = undefined; // TODO better selectedHierojanNimi handling
    const tarjoajaDropdown = page.locator(`label:has-text('${valitse_tarjoaja}') + td-select`);
    const hierojienNimet = (await tarjoajaDropdown.locator('div ul li').allInnerTexts()).filter((nimi) => nimi.length > 0);
    expect(hierojienNimet.length).toBeGreaterThan(1);

    for (let i = 0; i < hierojienNimet.length; i++) {
      const hierojanNimi = hierojienNimet[i];
      const isWoman = isWomanName(hierojanNimi, naistenNimet);
      console.log(`Hierojan nimi: ${hierojanNimi} - likely woman:`, isWoman);
      if (!isWoman) {
        continue;
      }

      if (i === 0) {
        await page.locator('span', { hasText: kuka_tahansa }).isVisible();
        await page.locator('a').filter({ hasText: kuka_tahansa }).click();
      } else {
        await page.locator('a').filter({ hasText: `${selectedHierojanNimi} ${X_SYMBOL}` }).isVisible();
        await page.getByText(`${selectedHierojanNimi} ${X_SYMBOL}`).click();
      }

      const slotRequestListener = async (req: Request, nimi: string) => {
        if (!req.url().startsWith(`${API_BASE_URL}/slot`) || !req.url().includes('user_id')) {
          return;
        }

        const response = await req.response();
        if (!response) {
          console.error(`No response for slots API request for ${nimi}`);
          return;
        }
        if (response.status() !== 200) {
          console.error(`Failed API response for ${nimi}:`, response.statusText());
          return;
        }
        if (response.headers()['content-type'] && !response.headers()['content-type'].includes('json')) {
          console.error(`Non-JSON API response for ${nimi}:`, response.url());
          return;
        }

        let responseBody;
        try {
          responseBody = await response.json();
        } catch (e) {
          console.error(`Failed to parse JSON slots API response for ${nimi}`, e);
          return;
        }

        const slotsLog = displaySlotsMsg(responseBody?.data
          .filter(i => i.type === 'slot')
          .map(slot => slot.attributes as Slot)
        );
        console.log(`¯\\_(ツ)_/¯ ${nimi}: Slots:`, slotsLog);
        // TODO slots printed twice for everyone https://playwright.dev/docs/events#waiting-for-event
        // TODO slots of Katariina got printed for Niina Mira etc.
      };
      
      page.on('requestfinished', req => slotRequestListener(req, hierojanNimi));
      await page.getByRole('menuitem', { name: hierojanNimi }).click();
      
      await page.getByRole('heading', { name: hierojanNimi }).isVisible();
      console.log(`Valittu palveluntarjoaja: ${hierojanNimi}`);
      selectedHierojanNimi = hierojanNimi;
    }
    console.log(SEPARATOR);
  }
});

type Slot = {
  product_id: string;
  starttime: string;
  endtime: string;
}

function displaySlotsMsg(slots: Slot[]): string {
  if (slots.length === 0) {
    return 'No slots available';
  }
  const slotsMsg = slots.slice(0, 5).map(slot => formatSlot(slot)).join('\n');
  const remainingMsg = slots.length > 5 ? `...and ${slots.length - 5} more on ${WEB_URL}` : '';
  return slots.length > 5 ? `First 5 slots:\n${slotsMsg}\n${remainingMsg}` : slotsMsg;
}

function formatSlot(slot: Slot): string {
  const start = new Date(slot.starttime);
  const end = new Date(slot.endtime);
  return `${start.toLocaleString()} - ${end.toLocaleTimeString()}`;
};