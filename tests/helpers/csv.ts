import * as fs from 'fs';
import Papa from 'papaparse';

export function readEtunimetCSV(): string[] {
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
        throw ('Failed to process CSV file: 0 rows parsed');
    }
    console.log(`CSV file processed successfully. Checking against ${naistenEtunimet.length} women names in Finland`);
    return naistenEtunimet;
};