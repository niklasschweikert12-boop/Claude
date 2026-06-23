#!/usr/bin/env node
// Run: node scripts/convert-pricelist.mjs
// Reads the xlsx and writes src/data/pricelist.js

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// ── Find the xlsx file ───────────────────────────────────────────────────────
// First try known names, then pick any .xlsx in the project root
const knownNames = [
  'apple_einkauf_preisliste_realistisch_2026-05-11.xlsx',
  'apple_einkauf_preisliste_realistisch_2026_06_21_iphones_v6_ebay_.xlsx',
  'preisliste.xlsx',
  'pricelist.xlsx',
];

let xlsxPath = null;
for (const name of knownNames) {
  try {
    const p = resolve(root, name);
    readFileSync(p);
    xlsxPath = p;
    break;
  } catch {}
}

// Fallback: find any xlsx in project root
if (!xlsxPath) {
  try {
    const files = readdirSync(root).filter((f) => f.endsWith('.xlsx') || f.endsWith('.xls'));
    if (files.length > 0) {
      xlsxPath = resolve(root, files[0]);
      console.log('📂  Gefundene Datei:', files[0]);
    }
  } catch {}
}

if (!xlsxPath) {
  console.error('\n❌  Preisliste nicht gefunden.');
  console.error('    Lege die Datei in den Projektordner deal-evaluator/ und benenne sie z.B.:');
  console.error('    apple_einkauf_preisliste_realistisch_2026-05-11.xlsx\n');
  process.exit(1);
}

console.log('📂  Lese:', xlsxPath);

// ── Parse ────────────────────────────────────────────────────────────────────
const workbook = XLSX.read(readFileSync(xlsxPath), { type: 'buffer' });

const sheetName =
  workbook.SheetNames.find((n) => n.toLowerCase() === 'preisliste') ||
  workbook.SheetNames[0];

console.log('📋  Sheet:', sheetName, '(verfügbar:', workbook.SheetNames.join(', ') + ')');

const sheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

if (rows.length === 0) { console.error('❌  Sheet ist leer.'); process.exit(1); }

const cols = Object.keys(rows[0]);
console.log('📊  Spalten:', cols.join(' | '));
console.log('📊  Erste Zeile:', JSON.stringify(rows[0]).slice(0, 200));

// ── Auto-detect Deal-Key column ───────────────────────────────────────────────
function findCol(row, ...names) {
  const rowKeys = Object.keys(row);
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== '') return name;
    const ci = rowKeys.find((k) => k.toLowerCase() === name.toLowerCase());
    if (ci) return ci;
    const partial = rowKeys.find((k) => k.toLowerCase().includes(name.toLowerCase()));
    if (partial) return partial;
  }
  return null;
}

// Detect Deal-Key column by looking for pipe-separated values
let dealKeyCol = cols.find((c) => String(rows[0][c] || rows[1]?.[c] || '').includes('|'));
if (!dealKeyCol) dealKeyCol = findCol(rows[0], 'Deal-Key', 'DealKey', 'deal-key', 'Key');
if (!dealKeyCol) { console.error('❌  Keine Deal-Key Spalte gefunden (suche Spalte mit A|B|C Werten).'); process.exit(1); }
console.log('🔑  Deal-Key Spalte:', dealKeyCol);

function getCol(row, ...names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== '') return row[name];
    const k = Object.keys(row).find((k) => k.toLowerCase().includes(name.toLowerCase()));
    if (k && row[k] !== undefined && row[k] !== '') return row[k];
  }
  return '';
}
function numVal(row, ...names) { return parseFloat(getCol(row, ...names)) || 0; }

// ── Convert rows ─────────────────────────────────────────────────────────────
const entries = [];
const models = new Set();
const storageByModel = {};

for (const row of rows) {
  const key = String(row[dealKeyCol] || '').trim();
  if (!key || !key.includes('|')) continue;

  const parts = key.split('|');
  if (parts.length < 3) continue;

  const model = parts[1].trim();
  const storage = parts[2].trim();
  models.add(model);
  if (!storageByModel[model]) storageByModel[model] = [];
  if (!storageByModel[model].includes(storage)) storageByModel[model].push(storage);

  entries.push({
    key,
    nachfrage: numVal(row, 'Nachfrage 1-10', 'Nachfrage'),
    verkaufVon: numVal(row, 'Verkauf von'),
    verkaufBis: numVal(row, 'Verkauf bis'),
    avgVerkauf: numVal(row, 'Ø Verkauf', 'O Verkauf', 'Avg Verkauf', 'Durchschnitt'),
    zielEK: numVal(row, 'Einkauf von (80', 'Einkauf von'),
    maxEK: numVal(row, 'Einkauf bis (50', 'Einkauf bis'),
    sofortkauf: numVal(row, 'Sofort kaufen bis', 'Sofortkauf'),
    ebayLink: String(getCol(row, 'eBay verkauft', 'eBayLink', 'Ebay Verkauft') || ''),
    marktbeobachtung: String(getCol(row, 'Marktbeobachtung', 'Markt') || ''),
    empfehlung: String(getCol(row, 'Empfehlung') || ''),
  });
}

const storageOrder = ['64GB', '128GB', '256GB', '512GB', '1TB'];
const modelList = Array.from(models).sort();
const storageMap = {};
for (const [m, arr] of Object.entries(storageByModel)) {
  storageMap[m] = arr.sort((a, b) => {
    const ia = storageOrder.indexOf(a), ib = storageOrder.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1; if (ib === -1) return -1;
    return ia - ib;
  });
}

// ── Write output ─────────────────────────────────────────────────────────────
mkdirSync(resolve(root, 'src/data'), { recursive: true });
const outPath = resolve(root, 'src/data/pricelist.js');

const js = `// AUTO-GENERATED — do not edit manually.
// Source: ${sheetName} (${entries.length} entries, ${modelList.length} models)

export const MODELS = ${JSON.stringify(modelList, null, 2)};

export const STORAGE_BY_MODEL = ${JSON.stringify(storageMap, null, 2)};

export const PRICELIST = ${JSON.stringify(entries, null, 2)};
`;

writeFileSync(outPath, js, 'utf8');
console.log(`✅  ${entries.length} Einträge, ${modelList.length} Modelle → src/data/pricelist.js`);
