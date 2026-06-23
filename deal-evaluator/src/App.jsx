import { useState, useMemo } from 'react';
import { MODELS, STORAGE_BY_MODEL, PRICELIST } from './data/pricelist.js';
import { calculateDeal } from './utils/calculator.js';
import { generateMessage } from './utils/anthropic.js';
import {
  Settings, AlertTriangle, ExternalLink,
  Copy, Check, Loader2, MessageSquare, ShieldAlert,
} from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────
const eur = (n) => `${Math.round(n)} €`;

function lookupDeal(model, storage) {
  return PRICELIST.find((e) => {
    const p = e.key.split('|');
    return p[1]?.trim() === model && p[2]?.trim() === storage;
  }) || null;
}

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  // settings
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('sh_apikey') || '');

  // form
  const [modelQuery, setModelQuery] = useState('');
  const [modell, setModell] = useState('');
  const [speicher, setSpeicher] = useState('');
  const [zustand, setZustand] = useState(7);
  const [akku, setAkku] = useState(85);
  const [ovp, setOvp] = useState(false);
  const [faceId, setFaceId] = useState(true);
  const [icloud, setIcloud] = useState(false);
  const [angebotspreis, setAngebotspreis] = useState('');
  const [plattform, setPlattform] = useState('Kleinanzeigen');
  const [notiz, setNotiz] = useState('');

  // messages
  const [messages, setMessages] = useState({});
  const [loading, setLoading] = useState({});
  const [msgError, setMsgError] = useState('');
  const [copied, setCopied] = useState({});

  // derived
  const noData = MODELS.length === 0;

  const filteredModels = useMemo(
    () => MODELS.filter((m) => m.toLowerCase().includes(modelQuery.toLowerCase())),
    [modelQuery]
  );
  const storageOptions = modell ? (STORAGE_BY_MODEL[modell] || []) : [];
  const deal = modell && speicher ? lookupDeal(modell, speicher) : null;
  const calcResult = deal
    ? calculateDeal(deal, { zustand, akku, ovp, faceId, plattform, angebotspreis })
    : null;

  const selectModel = (m) => { setModell(m); setModelQuery(m); setSpeicher(''); };

  const saveApiKey = () => { localStorage.setItem('sh_apikey', apiKey); setShowSettings(false); };

  const handleGenerate = async (type) => {
    if (!apiKey) { setMsgError('Bitte erst API-Key in den Einstellungen eingeben.'); return; }
    if (!calcResult) return;
    setMsgError('');
    setLoading((p) => ({ ...p, [type]: true }));
    try {
      const text = await generateMessage({
        apiKey, type,
        formData: { modell, speicher, angebotspreis, zustand, akku, ovp, faceId, plattform, notiz },
        calcResult,
      });
      setMessages((p) => ({ ...p, [type]: text }));
    } catch (e) {
      setMsgError(e.message);
    } finally {
      setLoading((p) => ({ ...p, [type]: false }));
    }
  };

  const copy = async (text, key) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied((p) => ({ ...p, [key]: true }));
    setTimeout(() => setCopied((p) => ({ ...p, [key]: false })), 2000);
  };

  const empConfig = {
    KAUFEN:    { badge: 'bg-green-600',  border: 'border-green-500/30' },
    VERHANDELN:{ badge: 'bg-yellow-600', border: 'border-yellow-500/30' },
    ABLEHNEN:  { badge: 'bg-red-600',    border: 'border-red-500/30' },
  };
  const nfColor = (n) => n >= 8 ? 'text-green-400' : n >= 5 ? 'text-yellow-400' : 'text-red-400';

  // ── iCloud hardblock ──────────────────────────────────────────────────────
  if (icloud) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-red-950 border border-red-500 rounded-2xl p-10 text-center">
        <ShieldAlert className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-red-300 mb-2">Kein Kauf möglich</h2>
        <p className="text-red-400 mb-4">iCloud / Find My ist aktiv.</p>
        <p className="text-gray-400 text-sm mb-8">Das Gerät kann nicht übertragen werden. Verkäufer muss iCloud deaktivieren.</p>
        <button onClick={() => setIcloud(false)} className="px-6 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors">
          Zurück
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100" style={{ maxWidth: 'none' }}>

      {/* ── Header ── */}
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div>
          <span className="text-base font-semibold text-white">Schweikert Handel</span>
          <span className="ml-3 text-xs text-gray-500 uppercase tracking-widest">Deal-Evaluator</span>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors">
          <Settings className="w-4 h-4 text-gray-400" />
        </button>
      </header>

      {/* ── Settings panel ── */}
      {showSettings && (
        <div className="border-b border-gray-800 bg-gray-900 px-6 py-3 flex items-center gap-3 flex-wrap">
          <label className="text-sm text-gray-400 whitespace-nowrap">API-Key</label>
          <input
            type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            className="flex-1 min-w-0 max-w-sm bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
          <button onClick={saveApiKey} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm transition-colors">Speichern</button>
          <span className="text-xs text-gray-600">Nur lokal gespeichert</span>
        </div>
      )}

      {/* ── No data warning ── */}
      {noData && (
        <div className="m-6 p-5 bg-orange-950 border-2 border-orange-600 rounded-xl text-sm">
          <p className="text-orange-300 font-bold text-base mb-2">Preisliste fehlt</p>
          <p className="text-orange-400 mb-3">
            Lege die Excel-Datei in den Projektordner und führe dann aus:
          </p>
          <pre className="bg-orange-900/50 text-orange-200 rounded-lg p-3 text-xs mb-3 overflow-x-auto">
{`cd deal-evaluator
node scripts/convert-pricelist.mjs
npm run dev`}
          </pre>
          <p className="text-orange-500 text-xs">
            Dateiname: <code className="bg-orange-900/50 px-1 rounded">apple_einkauf_preisliste_realistisch_2026_06_21_iphones_v6_ebay_.xlsx</code>
          </p>
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[calc(100vh-57px)]">

        {/* ══ LEFT: Form ══ */}
        <div className="border-r border-gray-800 p-5 flex flex-col gap-5 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Gerät bewerten</p>

          {/* Modell */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">
              Modell <span className="text-gray-700">({MODELS.length} verfügbar)</span>
            </label>
            {/* Search input */}
            <input
              type="text"
              value={modelQuery}
              onChange={(e) => { setModelQuery(e.target.value); if (modell && e.target.value !== modell) { setModell(''); setSpeicher(''); } }}
              placeholder="Suchen…"
              className="w-full bg-gray-900 border border-gray-700 rounded-t-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            {/* Scrollable model list */}
            <div className="h-44 overflow-y-auto bg-gray-900 border border-t-0 border-gray-700 rounded-b-xl">
              {filteredModels.length === 0 ? (
                <p className="text-gray-600 text-sm px-4 py-3">Keine Treffer</p>
              ) : filteredModels.map((m) => (
                <button
                  key={m}
                  onClick={() => selectModel(m)}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    modell === m
                      ? 'bg-indigo-700 text-white'
                      : 'hover:bg-gray-800 text-gray-300'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Speicher */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Speicher</label>
            {storageOptions.length === 0 ? (
              <p className="text-gray-600 text-sm">— erst Modell wählen —</p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {storageOptions.map((s) => (
                  <button
                    key={s} onClick={() => setSpeicher(s)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      speicher === s ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Zustand */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">
              Zustand <span className="text-white font-semibold">{zustand}/10</span>
            </label>
            <input type="range" min={1} max={10} value={zustand}
              onChange={(e) => setZustand(Number(e.target.value))}
              className="w-full accent-indigo-500" />
            <div className="flex justify-between text-xs text-gray-600 mt-0.5">
              <span>Defekt</span><span>Neuwertig</span>
            </div>
          </div>

          {/* Akku */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">
              Akku{' '}
              <span className={`font-semibold ${akku < 75 ? 'text-red-400' : akku < 85 ? 'text-yellow-400' : 'text-green-400'}`}>
                {akku}%
              </span>
            </label>
            <input type="number" min={1} max={100} value={akku}
              onChange={(e) => setAkku(Number(e.target.value))}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-3 gap-3">
            <Toggle label="OVP" value={ovp} onChange={setOvp} on="Ja" off="Nein" />
            <Toggle label="Face ID" value={faceId} onChange={setFaceId} on="OK" off="Defekt" warnOff />
            <Toggle label="iCloud aktiv?" value={icloud} onChange={setIcloud} on="Aktiv" off="Nein" dangerOn />
          </div>

          {/* Angebotspreis */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Angeforderter Preis</label>
            <div className="relative">
              <input type="number" value={angebotspreis} onChange={(e) => setAngebotspreis(e.target.value)}
                placeholder="0"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 pr-10"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">€</span>
            </div>
          </div>

          {/* Plattform */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Plattform</label>
            <div className="flex gap-2">
              {['Kleinanzeigen', 'eBay', 'Privat'].map((p) => (
                <button key={p} onClick={() => setPlattform(p)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    plattform === p ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Notiz */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Notiz <span className="text-gray-700">(optional)</span></label>
            <textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} rows={2}
              placeholder="z.B. Kratzer am Gehäuse, Ladekabel dabei…"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>
        </div>

        {/* ══ RIGHT: Results ══ */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto bg-gray-950">
          {!modell || !speicher ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-600 text-sm text-center">
                {!modell ? 'Modell aus der Liste wählen' : 'Speichergröße wählen'}
              </p>
            </div>
          ) : !deal ? (
            <div className="p-4 bg-yellow-950 border border-yellow-700 rounded-xl text-yellow-400 text-sm">
              Kein Eintrag für <strong>{modell} {speicher}</strong> in der Preisliste.
            </div>
          ) : calcResult ? (
            <>
              {/* Warnings */}
              {!faceId && <Warn yellow>Face ID defekt — Abschlag −40 € eingerechnet</Warn>}
              {akku < 75 && <Warn orange>Sehr schwacher Akku — harter Abschlag (−35 €)</Warn>}
              {calcResult.nachfrage <= 3 && <Warn red>Schwache Nachfrage — sehr vorsichtig</Warn>}

              {/* Empfehlung */}
              {calcResult.empfehlung && (
                <div className={`rounded-2xl border p-5 text-center bg-gray-900 ${empConfig[calcResult.empfehlung].border}`}>
                  <span className={`inline-block px-6 py-2 rounded-full text-sm font-bold tracking-widest text-white ${empConfig[calcResult.empfehlung].badge}`}>
                    {calcResult.empfehlung}
                  </span>
                  <div className="mt-3 text-3xl font-bold text-white">
                    {eur(calcResult.gewinnBeiZielEK)}
                    <span className="text-base font-normal text-gray-500 ml-2">erw. Gewinn</span>
                  </div>
                </div>
              )}

              {/* EK-Werte */}
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Ziel-EK (80€ Gewinn)" value={eur(calcResult.zielEK)} color="text-green-400" />
                <Stat label="Max-EK (50€ Gewinn)" value={eur(calcResult.maxEK)} color="text-yellow-400" />
              </div>

              {/* Abzüge */}
              {calcResult.abzugDetails.length > 0 && (
                <div className="bg-gray-900 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Abzüge</p>
                  <div className="space-y-1.5">
                    {calcResult.abzugDetails.map((a) => (
                      <div key={a.label} className="flex justify-between text-sm">
                        <span className="text-gray-400">{a.label}</span>
                        <span className="text-red-400 font-medium">{a.betrag} €</span>
                      </div>
                    ))}
                    <div className="border-t border-gray-700 pt-1.5 flex justify-between text-sm font-semibold">
                      <span className="text-gray-300">Gesamt</span>
                      <span className="text-red-400">−{calcResult.totalAbzug} €</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Markt-Infos */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-900 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Nachfrage</p>
                  <p className={`text-2xl font-bold ${nfColor(calcResult.nachfrage)}`}>
                    {calcResult.nachfrage}<span className="text-sm font-normal text-gray-600">/10</span>
                  </p>
                </div>
                <div className="bg-gray-900 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Ø Verkaufspreis</p>
                  <p className="text-2xl font-bold text-white">{eur(calcResult.avgVerkauf)}</p>
                </div>
              </div>

              {calcResult.empfehlungText && (
                <InfoBox label="Empfehlung">{calcResult.empfehlungText}</InfoBox>
              )}
              {calcResult.marktbeobachtung && (
                <InfoBox label="Marktbeobachtung" muted>{calcResult.marktbeobachtung}</InfoBox>
              )}

              {calcResult.ebayLink && (
                <a href={calcResult.ebayLink} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 w-fit">
                  <ExternalLink className="w-4 h-4" />
                  eBay Verkäufe ansehen
                </a>
              )}

              {/* ── KI-Nachrichten ── */}
              <div className="border-t border-gray-800 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">KI-Nachricht</p>
                {msgError && (
                  <div className="mb-3 p-3 bg-red-950 border border-red-800 rounded-lg text-sm text-red-400">{msgError}</div>
                )}
                <div className="flex gap-2 flex-wrap">
                  {[
                    { key: 'verhandlung', label: 'Verhandeln' },
                    { key: 'kauf', label: 'Kaufbestätigung' },
                    { key: 'ablehnung', label: 'Ablehnung' },
                  ].map(({ key, label }) => (
                    <button key={key} onClick={() => handleGenerate(key)} disabled={loading[key]}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                    >
                      {loading[key] ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                      {label}
                    </button>
                  ))}
                </div>

                <div className="space-y-3 mt-4">
                  {[
                    { key: 'verhandlung', label: 'Verhandlungsnachricht' },
                    { key: 'kauf', label: 'Kaufbestätigung' },
                    { key: 'ablehnung', label: 'Ablehnung' },
                  ].map(({ key, label }) =>
                    messages[key] ? (
                      <div key={key} className="bg-gray-900 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
                          <button onClick={() => copy(messages[key], key)}
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors">
                            {copied[key] ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied[key] ? 'Kopiert' : 'Kopieren'}
                          </button>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{messages[key]}</p>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── small components ─────────────────────────────────────────────────────────
function Toggle({ label, value, onChange, on, off, warnOff, dangerOn }) {
  let cls = value ? 'bg-green-700 text-green-100' : 'bg-gray-700 text-gray-400';
  if (value && dangerOn) cls = 'bg-red-600 text-white';
  if (!value && warnOff) cls = 'bg-yellow-700 text-yellow-100';
  return (
    <div className="bg-gray-900 rounded-xl p-3 text-center">
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <button onClick={() => onChange(!value)} className={`w-full py-1.5 rounded-lg text-xs font-medium transition-colors ${cls}`}>
        {value ? on : off}
      </button>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color || 'text-white'}`}>{value}</p>
    </div>
  );
}

function Warn({ children, yellow, orange, red }) {
  const cls = red ? 'bg-red-950 border-red-700/50 text-red-400'
    : orange ? 'bg-orange-950 border-orange-700/50 text-orange-400'
    : 'bg-yellow-950 border-yellow-700/50 text-yellow-400';
  return (
    <div className={`flex items-center gap-2 p-3 border rounded-xl text-sm ${cls}`}>
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      {children}
    </div>
  );
}

function InfoBox({ label, children, muted }) {
  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-sm ${muted ? 'text-gray-400' : 'text-gray-300'}`}>{children}</p>
    </div>
  );
}
