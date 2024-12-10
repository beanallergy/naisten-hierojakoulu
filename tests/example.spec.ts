import { test, expect, Response } from '@playwright/test';
import { readEtunimetCSV } from './helpers/csv';
import { displaySlotsMsg, Slot, slotRequestListener } from './helpers/slots';

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

            await page.getByRole('menuitem', { name: hierojanNimi }).click();
            await page.getByRole('heading', { name: hierojanNimi }).isVisible();
            console.log(`Valittu palveluntarjoaja: ${hierojanNimi}`);

            // TODO rework all this to check DOM elements instead of API
            let slotsForHieroja: Slot[] | undefined = undefined;
            page.on('requestfinished', async (req) => {
                const res = await req.response();
                const url = req.url();
                if (
                    url.startsWith(`${API_BASE_URL}/slot`)
                    && url.includes('user_id')
                    && res && res.status() === 200
                    && res.headers()['content-type']?.includes('json')
                ) {
                    slotsForHieroja = await slotRequestListener(res, hierojanNimi)
                }
            });

            const slotsLog = displaySlotsMsg(slotsForHieroja, WEB_URL);
            console.log(`¯\\_(ツ)_/¯ ${hierojanNimi.trimEnd()}:\n${slotsLog}`);
            selectedHierojanNimi = hierojanNimi;
        }
        console.log(SEPARATOR);
    }
});
