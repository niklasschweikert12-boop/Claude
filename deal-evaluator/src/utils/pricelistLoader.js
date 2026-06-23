import * as XLSX from 'xlsx';

function col(row, ...names) {
  const rowKeys = Object.keys(row);
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== '') return row[name];
    const found = rowKeys.find((k) => k.toLowerCase() === name.toLowerCase());
    if (found && row[found] !== undefined && row[found] !== '') return row[found];
    const partial = rowKeys.find((k) => k.toLowerCase().includes(name.toLowerCase()));
    if (partial && row[partial] !== undefined && row[partial] !== '') return row[partial];
  }
  return '';
}

function numCol(row, ...names) {
  return parseFloat(col(row, ...names)) || 0;
}

export function parsePricelist(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  const sheetName =
    workbook.SheetNames.find((n) => n.toLowerCase() === 'preisliste') ||
    workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rows.length === 0) throw new Error('Sheet ist leer oder hat kein Header-Format.');

  const availableCols = Object.keys(rows[0] || {});
  const firstRow = rows[0] || {};
  const sheetNames = workbook.SheetNames;

  console.log('[Preisliste] Sheets:', sheetNames);
  console.log('[Preisliste] Verwendet:', sheetName);
  console.log('[Preisliste] Spalten:', availableCols);
  console.log('[Preisliste] Erste Zeile:', firstRow);

  // Try to auto-detect the Deal-Key column
  // It should contain pipe-separated values like "iPhone|iPhone 16|128GB"
  let dealKeyCol = null;
  for (const colName of availableCols) {
    const sampleVal = String(firstRow[colName] || '');
    if (sampleVal.includes('|')) {
      dealKeyCol = colName;
      console.log('[Preisliste] Deal-Key Spalte gefunden:', colName, '→', sampleVal);
      break;
    }
  }
  // fallback: look by column name
  if (!dealKeyCol) {
    dealKeyCol = availableCols.find((k) =>
      ['deal-key', 'dealkey', 'deal_key', 'key', 'id'].includes(k.toLowerCase())
    ) || null;
  }

  console.log('[Preisliste] Deal-Key Spalte:', dealKeyCol);

  const lookupMap = {};
  const models = new Set();
  const storageByModel = {};

  rows.forEach((row) => {
    const key = dealKeyCol ? String(row[dealKeyCol] || '') : col(row, 'Deal-Key', 'DealKey', 'deal-key', 'deal_key', 'Key');
    if (!key || !key.includes('|')) return;

    lookupMap[key] = {
      key,
      nachfrage: numCol(row, 'Nachfrage 1-10', 'Nachfrage', 'nachfrage'),
      verkaufVon: numCol(row, 'Verkauf von', 'VerkaufVon'),
      verkaufBis: numCol(row, 'Verkauf bis', 'VerkaufBis'),
      avgVerkauf: numCol(row, 'Ø Verkauf', 'O Verkauf', 'Avg Verkauf', 'AvgVerkauf', 'Durchschnitt'),
      zielEK: numCol(row, 'Einkauf von (80', 'Einkauf von', 'EinkaufVon', 'Ziel-EK'),
      maxEK: numCol(row, 'Einkauf bis (50', 'Einkauf bis', 'EinkaufBis', 'Max-EK'),
      sofortkauf: numCol(row, 'Sofort kaufen bis', 'SofortKaufen', 'Sofortkauf'),
      ebayLink: col(row, 'eBay verkauft', 'eBayLink', 'Ebay Verkauft', 'ebay'),
      marktbeobachtung: col(row, 'Marktbeobachtung', 'Markt'),
      empfehlung: col(row, 'Empfehlung'),
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
    firstRowSample: Object.fromEntries(
      Object.entries(firstRow).slice(0, 6).map(([k, v]) => [k, String(v).slice(0, 60)])
    ),
    sheetNames,
    usedSheet: sheetName,
    totalRows: rows.length,
    dealKeyCol,
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


