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
const knownNames = [
  'apple_einkauf_preisliste_realistisch_2026-05-11.xlsx',
  'preisliste.xlsx',
  'pricelist.xlsx',
  'apple_einkauf_preisliste_realistisch_2026_06_21_iphones_v6_ebay_.xlsx',
];

let xlsxPath = null;
for (const name of knownNames) {
  try { readFileSync(resolve(root, name)); xlsxPath = resolve(root, name); break; } catch {}
}
if (!xlsxPath) {
  try {
    const files = readdirSync(root).filter((f) => f.endsWith('.xlsx') || f.endsWith('.xls'));
    if (files.length > 0) { xlsxPath = resolve(root, files[0]); console.log('📂  Datei gefunden:', files[0]); }
  } catch {}
}
if (!xlsxPath) {
  console.error('\n❌  Keine xlsx-Datei im Projektordner gefunden.');
  console.error('    Lege die Preisliste in: deal-evaluator/\n');
  process.exit(1);
}

console.log('📂  Lese:', xlsxPath);

// ── Parse ────────────────────────────────────────────────────────────────────
const workbook = XLSX.read(readFileSync(xlsxPath), { type: 'buffer' });

const sheetName =
  workbook.SheetNames.find((n) => n.toLowerCase() === 'preisliste') ||
  workbook.SheetNames[0];
console.log('📋  Sheet:', sheetName, '| verfügbar:', workbook.SheetNames.join(', '));

const sheet = workbook.Sheets[sheetName];

// Read as raw array-of-arrays to find the real header row
const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

// Find the header row: the first row that contains "Modell" or "Deal-Key"
let headerRowIndex = -1;
for (let i = 0; i < Math.min(10, raw.length); i++) {
  const row = raw[i].map(String);
  if (row.some((c) => c === 'Modell' || c === 'Deal-Key' || c === 'Kategorie')) {
    headerRowIndex = i;
    break;
  }
}

if (headerRowIndex === -1) {
  console.error('❌  Keine Header-Zeile gefunden (suche nach "Modell" / "Deal-Key" / "Kategorie").');
  process.exit(1);
}

const headers = raw[headerRowIndex].map(String);
console.log('📊  Header (Zeile', headerRowIndex + 1, '):', headers.join(' | '));

const dataRows = raw.slice(headerRowIndex + 1);

function h(name) { return headers.indexOf(name); }
const iKey      = h('Deal-Key');
const iKat      = h('Kategorie');
const iModell   = h('Modell');
const iSpeicher = h('Speicher / Variante');
const iNachfr   = h('Nachfrage 1-10');
const iVKvon    = h('Verkauf von');
const iVKbis    = h('Verkauf bis');
const iVKavg    = h('Ø Verkauf');
const iEKvon    = h('Einkauf von (80€ Gewinn)');
const iEKbis    = h('Einkauf bis (50€ Gewinn)');
const iSofort   = h('Sofort kaufen bis (70€ Gewinn)');
const iMarkt    = h('Marktbeobachtung');
const iEmpf     = h('Empfehlung');
const iEbay     = h('eBay verkauft');

console.log('🔑  Spalten-Indizes:', { key: iKey, modell: iModell, speicher: iSpeicher, ekVon: iEKvon, ekBis: iEKbis });

const n = (v) => parseFloat(v) || 0;
const s = (v) => String(v || '').trim();

const entries = [];
const models  = new Set();
const storageByModel = {};

for (const row of dataRows) {
  // Build key: prefer explicit Deal-Key column, else assemble from parts
  let key = iKey >= 0 ? s(row[iKey]) : '';
  if (!key && iKat >= 0 && iModell >= 0 && iSpeicher >= 0) {
    const kat  = s(row[iKat]);
    const mod  = s(row[iModell]);
    const spe  = s(row[iSpeicher]);
    if (kat && mod && spe) key = `${kat}|${mod}|${spe}`;
  }
  if (!key || !key.includes('|')) continue;

  const parts   = key.split('|');
  const model   = parts[1]?.trim();
  const storage = parts[2]?.trim();
  if (!model || !storage) continue;

  models.add(model);
  if (!storageByModel[model]) storageByModel[model] = [];
  if (!storageByModel[model].includes(storage)) storageByModel[model].push(storage);

  entries.push({
    key,
    nachfrage:        n(row[iNachfr]),
    verkaufVon:       n(row[iVKvon]),
    verkaufBis:       n(row[iVKbis]),
    avgVerkauf:       n(row[iVKavg]),
    zielEK:           n(row[iEKvon]),
    maxEK:            n(row[iEKbis]),
    sofortkauf:       n(row[iSofort]),
    marktbeobachtung: s(row[iMarkt]),
    empfehlung:       s(row[iEmpf]),
    ebayLink:         s(row[iEbay]),
  });
}

if (entries.length === 0) {
  console.error('❌  Keine Datenzeilen gefunden. Prüfe die Dateistruktur.');
  process.exit(1);
}

const storageOrder = ['64GB', '128GB', '256GB', '512GB', '1TB'];
const modelList    = Array.from(models).sort();
const storageMap   = {};
for (const [m, arr] of Object.entries(storageByModel)) {
  storageMap[m] = [...arr].sort((a, b) => {
    const ia = storageOrder.indexOf(a), ib = storageOrder.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1; if (ib === -1) return -1;
    return ia - ib;
  });
}

// ── Write output ─────────────────────────────────────────────────────────────
mkdirSync(resolve(root, 'src/data'), { recursive: true });
const outPath = resolve(root, 'src/data/pricelist.js');

writeFileSync(outPath, `// AUTO-GENERATED — do not edit manually.
// Source: ${sheetName} (${entries.length} Einträge, ${modelList.length} Modelle)

export const MODELS = ${JSON.stringify(modelList, null, 2)};

export const STORAGE_BY_MODEL = ${JSON.stringify(storageMap, null, 2)};

export const PRICELIST = ${JSON.stringify(entries, null, 2)};
`, 'utf8');

console.log(`✅  ${entries.length} Einträge, ${modelList.length} Modelle → src/data/pricelist.js`);
