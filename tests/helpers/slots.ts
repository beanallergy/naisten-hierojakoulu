import { Response } from '@playwright/test';

export type ApiSlot = {
    product_id: string;
    starttime: string;
    endtime: string;
}

export type UISlot = {
    dateStr: string,
    timeSlotStr: string
}

export async function slotRequestListener(response: Response, nimi: string): Promise<ApiSlot[] | undefined> {
    let responseBody;
    try {
        responseBody = await response.json();
    } catch (e) {
        console.error(`Failed to parse JSON slots API response for ${nimi}`, e);
        return undefined;
    }
    const slots = responseBody?.data
        .filter(i => i.type === 'slot')
        .map(slot => slot.attributes as ApiSlot)
        ;
    return slots;
}

export function displaySlotsMsg(slots: ApiSlot[] | UISlot[] | undefined, url: string): string {
    if (!slots || slots.length === 0) {
        return 'No slots available';
    }
    const slotsMsg = slots.slice(0, 5).map(slot => formatSlot(slot)).join('\n');
    const remainingMsg = slots.length > 5 ? `...and ${slots.length - 5} more on ${url}` : '';
    return slots.length > 5
        ? `First 5 slots:\n${slotsMsg}\n${remainingMsg}`
        : `${slots.length} slots:\n${slotsMsg}`;
}

export function formatSlot(slot: ApiSlot | UISlot): string {
    if ('starttime' in slot && 'endtime' in slot) {
        const start = new Date(slot.starttime);
        const end = new Date(slot.endtime);
        return `${start.toLocaleString()} - ${end.toLocaleTimeString()}`;
    }
    return `${slot.dateStr}: ${slot.timeSlotStr}`;
}
