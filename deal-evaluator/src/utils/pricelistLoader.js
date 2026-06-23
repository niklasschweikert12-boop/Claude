import * as XLSX from 'xlsx';

export function parsePricelist(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  // Find the "Preisliste" sheet
  const sheetName = workbook.SheetNames.find(
    (n) => n.toLowerCase() === 'preisliste'
  ) || workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const lookupMap = {};
  const models = new Set();
  const storageByModel = {};

  rows.forEach((row) => {
    const key = row['Deal-Key'] || row['deal-key'] || row['DealKey'] || '';
    if (!key) return;

    lookupMap[key] = {
      key,
      nachfrage: parseFloat(row['Nachfrage 1-10'] || row['Nachfrage']) || 0,
      verkaufVon: parseFloat(row['Verkauf von'] || row['VerkaufVon']) || 0,
      verkaufBis: parseFloat(row['Verkauf bis'] || row['VerkaufBis']) || 0,
      avgVerkauf: parseFloat(row['Ø Verkauf'] || row['AvgVerkauf'] || row['O Verkauf']) || 0,
      zielEK: parseFloat(row['Einkauf von (80€ Gewinn)'] || row['EinkaufVon'] || row['Einkauf von']) || 0,
      maxEK: parseFloat(row['Einkauf bis (50€ Gewinn)'] || row['EinkaufBis'] || row['Einkauf bis']) || 0,
      sofortkauf: parseFloat(row['Sofort kaufen bis (70€ Gewinn)'] || row['SofortKaufen'] || row['Sofort kaufen']) || 0,
      ebayLink: row['eBay verkauft'] || row['eBayLink'] || row['Ebay Verkauft'] || '',
      marktbeobachtung: row['Marktbeobachtung'] || '',
      empfehlung: row['Empfehlung'] || '',
    };

    // Extract category, model, storage from key (format: Kategorie|Modell|Speicher)
    const parts = key.split('|');
    if (parts.length >= 3) {
      const model = parts[1].trim();
      const storage = parts[2].trim();
      models.add(model);
      if (!storageByModel[model]) storageByModel[model] = new Set();
      storageByModel[model].add(storage);
    }
  });

  // Sort storage options naturally
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
  };
}

export function getDealKey(category, model, storage) {
  return `${category}|${model}|${storage}`;
}

export function lookupDeal(lookupMap, model, storage) {
  // Try to find the key — we don't know the category, so search all
  const keys = Object.keys(lookupMap);
  const match = keys.find((k) => {
    const parts = k.split('|');
    return parts[1]?.trim() === model && parts[2]?.trim() === storage;
  });
  return match ? lookupMap[match] : null;
}
