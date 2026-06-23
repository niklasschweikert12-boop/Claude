import * as XLSX from 'xlsx';

// Find a column value case-insensitively and with common variations
function col(row, ...names) {
  const rowKeys = Object.keys(row);
  for (const name of names) {
    // exact match first
    if (row[name] !== undefined && row[name] !== '') return row[name];
    // case-insensitive
    const found = rowKeys.find((k) => k.toLowerCase() === name.toLowerCase());
    if (found && row[found] !== undefined && row[found] !== '') return row[found];
    // partial match (key contains the search term)
    const partial = rowKeys.find((k) => k.toLowerCase().includes(name.toLowerCase()));
    if (partial && row[partial] !== undefined && row[partial] !== '') return row[partial];
  }
  return '';
}

function numCol(row, ...names) {
  const v = col(row, ...names);
  return parseFloat(v) || 0;
}

export function parsePricelist(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  const sheetName =
    workbook.SheetNames.find((n) => n.toLowerCase() === 'preisliste') ||
    workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rows.length === 0) throw new Error('Sheet ist leer oder hat kein Header-Format.');

  // Log available columns for debugging
  const availableCols = Object.keys(rows[0] || {});
  console.log('[Preisliste] Gefundene Spalten:', availableCols);
  console.log('[Preisliste] Erste Zeile:', rows[0]);

  const lookupMap = {};
  const models = new Set();
  const storageByModel = {};

  rows.forEach((row, i) => {
    const key = col(row, 'Deal-Key', 'DealKey', 'deal-key', 'deal_key', 'Key', 'ID');
    if (!key || typeof key !== 'string') return;

    lookupMap[key] = {
      key,
      nachfrage: numCol(row, 'Nachfrage 1-10', 'Nachfrage', 'nachfrage'),
      verkaufVon: numCol(row, 'Verkauf von', 'VerkaufVon', 'verkauf_von'),
      verkaufBis: numCol(row, 'Verkauf bis', 'VerkaufBis', 'verkauf_bis'),
      avgVerkauf: numCol(row, 'Ø Verkauf', 'O Verkauf', 'Avg Verkauf', 'AvgVerkauf', 'Durchschnitt'),
      zielEK: numCol(row, 'Einkauf von (80', 'Einkauf von', 'EinkaufVon', 'Ziel-EK', 'ZielEK'),
      maxEK: numCol(row, 'Einkauf bis (50', 'Einkauf bis', 'EinkaufBis', 'Max-EK', 'MaxEK'),
      sofortkauf: numCol(row, 'Sofort kaufen bis', 'SofortKaufen', 'Sofortkauf'),
      ebayLink: col(row, 'eBay verkauft', 'eBayLink', 'Ebay Verkauft', 'ebay', 'eBay-Link'),
      marktbeobachtung: col(row, 'Marktbeobachtung', 'Markt', 'Beobachtung'),
      empfehlung: col(row, 'Empfehlung', 'empfehlung'),
    };

    const parts = key.split('|');
    if (parts.length >= 3) {
      const model = parts[1].trim();
      const storage = parts[2].trim();
      models.add(model);
      if (!storageByModel[model]) storageByModel[model] = new Set();
      storageByModel[model].add(storage);
    }
  });

  console.log(`[Preisliste] ${Object.keys(lookupMap).length} Einträge, ${models.size} Modelle geladen.`);

  const storageOrder = ['64GB', '128GB', '256GB', '512GB', '1TB'];
  const storageByModelSorted = {};
  Object.keys(storageByModel).forEach((m) => {
    const arr = Array.from(storageByModel[m]);
    arr.sort((a, b) => {
      const ia = storageOrder.indexOf(a);
      const ib = storageOrder.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    storageByModelSorted[m] = arr;
  });

  return {
    lookupMap,
    models: Array.from(models).sort(),
    storageByModel: storageByModelSorted,
    availableCols,
    totalRows: rows.length,
  };
}

export function lookupDeal(lookupMap, model, storage) {
  const keys = Object.keys(lookupMap);
  const match = keys.find((k) => {
    const parts = k.split('|');
    return parts[1]?.trim() === model && parts[2]?.trim() === storage;
  });
  return match ? lookupMap[match] : null;
}

