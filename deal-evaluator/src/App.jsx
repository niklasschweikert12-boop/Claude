import { useState, useEffect, useRef, useCallback } from 'react';
import { parsePricelist, lookupDeal } from './utils/pricelistLoader';
import { calculateDeal } from './utils/calculator';
import { generateMessage } from './utils/anthropic';
import {
  Settings,
  Upload,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  TrendingUp,
  ShieldAlert,
} from 'lucide-react';

const eur = (n) => `${Math.round(n)} €`;

export default function App() {
  const [pricelist, setPricelist] = useState(null);
  const [fileError, setFileError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('sh_apikey') || '');
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
  const [modelQuery, setModelQuery] = useState('');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const modelRef = useRef(null);
  const [messages, setMessages] = useState({ verhandlung: '', kauf: '', ablehnung: '' });
  const [loadingMsg, setLoadingMsg] = useState({ verhandlung: false, kauf: false, ablehnung: false });
  const [msgError, setMsgError] = useState('');
  const [copied, setCopied] = useState({});

  useEffect(() => {
    const saved = localStorage.getItem('sh_pricelist');
    if (saved) {
      try { setPricelist(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (modelRef.current && !modelRef.current.contains(e.target))
        setShowModelDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setSpeicher(''); }, [modell]);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setFileError('');
    try {
      const buf = await file.arrayBuffer();
      const data = parsePricelist(buf);
      setPricelist(data);
      try { localStorage.setItem('sh_pricelist', JSON.stringify(data)); } catch { /* quota */ }
    } catch (e) {
      setFileError(`Datei konnte nicht gelesen werden: ${e.message}`);
    }
  }, []);

  const onFileInput = (e) => handleFile(e.target.files[0]);
  const onDrop = (e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); };

  const saveApiKey = () => {
    localStorage.setItem('sh_apikey', apiKey);
    setShowSettings(false);
  };

  const resetPricelist = () => {
    localStorage.removeItem('sh_pricelist');
    setPricelist(null);
    setModell('');
    setModelQuery('');
    setSpeicher('');
  };

  const filteredModels = pricelist
    ? pricelist.models.filter((m) => m.toLowerCase().includes(modelQuery.toLowerCase()))
    : [];
  const storageOptions = pricelist && modell ? pricelist.storageByModel[modell] || [] : [];
  const deal = pricelist && modell && speicher ? lookupDeal(pricelist.lookupMap, modell, speicher) : null;
  const calcResult = deal
    ? calculateDeal(deal, { zustand, akku, ovp, faceId, plattform, angebotspreis })
    : null;

  const handleGenerate = async (type) => {
    if (!apiKey) { setMsgError('Bitte erst API-Key in den Einstellungen hinterlegen.'); return; }
    if (!calcResult) return;
    setMsgError('');
    setLoadingMsg((p) => ({ ...p, [type]: true }));
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
      setLoadingMsg((p) => ({ ...p, [type]: false }));
    }
  };

  const copyToClipboard = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied((p) => ({ ...p, [key]: true }));
      setTimeout(() => setCopied((p) => ({ ...p, [key]: false })), 2000);
    } catch { /* ignore */ }
  };

  const empfehlungConfig = {
    KAUFEN: { bg: 'bg-green-600', border: 'border-green-500/30' },
    VERHANDELN: { bg: 'bg-yellow-600', border: 'border-yellow-500/30' },
    ABLEHNEN: { bg: 'bg-red-600', border: 'border-red-500/30' },
  };

  const nachfrageColor = (n) => n >= 8 ? 'text-green-400' : n >= 5 ? 'text-yellow-400' : 'text-red-400';

  if (icloud) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4" style={{ maxWidth: 'none' }}>
        <div className="max-w-lg w-full bg-red-950 border border-red-500 rounded-2xl p-10 text-center">
          <ShieldAlert className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-300 mb-2">Kein Kauf möglich</h2>
          <p className="text-red-400 text-lg mb-4">iCloud / Find My ist aktiv.</p>
          <p className="text-gray-400 text-sm mb-8">
            Das Gerät kann nicht übertragen werden. Bitte den Verkäufer auffordern, iCloud zu deaktivieren.
          </p>
          <button onClick={() => setIcloud(false)} className="px-6 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors">
            Zurück
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100" style={{ maxWidth: 'none' }}>
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <span className="text-lg font-semibold text-white tracking-tight">Schweikert Handel</span>
          <span className="ml-3 text-xs text-gray-500 uppercase tracking-widest">Deal-Evaluator</span>
        </div>
        <div className="flex items-center gap-3">
          {!pricelist ? (
            <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">
              <Upload className="w-4 h-4" />
              Preisliste laden
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onFileInput} />
            </label>
          ) : (
            <>
              <span className="text-xs text-gray-500">
                {pricelist.models.length} Modelle
              </span>
              <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-400 transition-colors">
                <Upload className="w-3 h-3" />
                Aktualisieren
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onFileInput} />
              </label>
              <button onClick={resetPricelist} className="px-3 py-1.5 bg-gray-800 hover:bg-red-900 rounded-lg text-xs text-gray-500 hover:text-red-400 transition-colors">
                Zurücksetzen
              </button>
            </>
          )}
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors">
            <Settings className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </header>

      {/* Settings */}
      {showSettings && (
        <div className="border-b border-gray-800 bg-gray-900 px-6 py-4 flex items-center gap-4 flex-wrap">
          <label className="text-sm text-gray-400 whitespace-nowrap">Anthropic API-Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            className="flex-1 min-w-0 max-w-md bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-gray-500"
          />
          <button onClick={saveApiKey} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm transition-colors">
            Speichern
          </button>
          <span className="text-xs text-gray-500">Wird nur lokal im Browser gespeichert.</span>
        </div>
      )}

      {fileError && (
        <div className="mx-6 mt-4 p-3 bg-red-950 border border-red-800 rounded-lg text-sm text-red-400">{fileError}</div>
      )}

      {pricelist && pricelist.models.length === 0 && (
        <div className="mx-6 mt-4 p-4 bg-yellow-950 border border-yellow-700 rounded-xl text-sm text-yellow-300">
          <strong>Keine Modelle gefunden.</strong> Die Preisliste wurde geladen ({pricelist.totalRows} Zeilen), aber der Deal-Key konnte nicht erkannt werden.
          {pricelist.availableCols?.length > 0 && (
            <p className="mt-2 text-yellow-500 text-xs">
              Gefundene Spalten: <code className="bg-yellow-900/50 px-1 rounded">{pricelist.availableCols.slice(0, 10).join(', ')}</code>
              {pricelist.availableCols.length > 10 && ` … (+${pricelist.availableCols.length - 10} weitere)`}
            </p>
          )}
          <p className="mt-2 text-yellow-500 text-xs">
            Erwartet wird eine Spalte namens <code className="bg-yellow-900/50 px-1 rounded">Deal-Key</code> mit Einträgen im Format <code className="bg-yellow-900/50 px-1 rounded">iPhone|iPhone 16 Pro|128GB</code>.
            Öffne die Browser-Konsole (F12) für Details.
          </p>
          <button onClick={resetPricelist} className="mt-3 px-3 py-1.5 bg-yellow-700 hover:bg-yellow-600 text-white rounded-lg text-xs">
            Neue Datei laden
          </button>
        </div>
      )}

      {!pricelist ? (
        <div className="flex-1 flex items-center justify-center min-h-[70vh]">
          <div
            className="border-2 border-dashed border-gray-700 rounded-2xl p-16 text-center max-w-md w-full mx-4 cursor-pointer hover:border-gray-500 transition-colors"
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <Upload className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-300 font-medium mb-2">Preisliste hochladen</p>
            <p className="text-gray-500 text-sm mb-6">apple_einkauf_preisliste_*.xlsx (Sheet: Preisliste)</p>
            <label className="cursor-pointer px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-medium transition-colors">
              Datei auswählen
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onFileInput} />
            </label>
            <p className="text-gray-600 text-xs mt-4">Oder per Drag &amp; Drop hierher ziehen</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[calc(100vh-73px)]" style={{ maxWidth: 'none' }}>
          {/* LEFT: Form */}
          <div className="border-r border-gray-800 p-6 space-y-5 overflow-y-auto">
            <h2 className="text-base font-semibold text-gray-300 uppercase tracking-wider text-left">Gerät bewerten</h2>

            {/* Modell */}
            <div className="relative" ref={modelRef}>
              <label className="block text-xs text-gray-500 mb-1.5">Modell</label>
              <input
                type="text"
                value={modell || modelQuery}
                onChange={(e) => { setModelQuery(e.target.value); setModell(''); setShowModelDropdown(true); }}
                onFocus={() => setShowModelDropdown(true)}
                placeholder="Modell suchen…"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
              {showModelDropdown && filteredModels.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                  {filteredModels.map((m) => (
                    <button
                      key={m}
                      onClick={() => { setModell(m); setModelQuery(m); setShowModelDropdown(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-800 text-gray-200 transition-colors first:rounded-t-xl last:rounded-b-xl"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Speicher */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Speicher</label>
              <div className="flex gap-2 flex-wrap">
                {storageOptions.length === 0 ? (
                  <p className="text-gray-600 text-sm">— Erst Modell wählen —</p>
                ) : storageOptions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeicher(s)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${speicher === s ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Zustand */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">
                Zustand <span className="text-white font-semibold">{zustand}/10</span>
              </label>
              <input type="range" min={1} max={10} value={zustand} onChange={(e) => setZustand(Number(e.target.value))} className="w-full accent-indigo-500" />
              <div className="flex justify-between text-xs text-gray-600 mt-0.5"><span>Defekt</span><span>Neuwertig</span></div>
            </div>

            {/* Akku */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">
                Akkukapazität{' '}
                <span className={`font-semibold ${akku < 75 ? 'text-red-400' : akku < 85 ? 'text-yellow-400' : 'text-green-400'}`}>{akku}%</span>
              </label>
              <input
                type="number" min={1} max={100} value={akku}
                onChange={(e) => setAkku(Number(e.target.value))}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-3 gap-3">
              <Toggle label="OVP" value={ovp} onChange={setOvp} positiveLabel="Ja" negativeLabel="Nein" />
              <Toggle label="Face ID" value={faceId} onChange={setFaceId} positiveLabel="OK" negativeLabel="Defekt" warnWhenFalse />
              <Toggle label="iCloud aktiv?" value={icloud} onChange={setIcloud} positiveLabel="Aktiv" negativeLabel="Nein" dangerWhenTrue />
            </div>

            {/* Angebotspreis */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Angeforderter Preis</label>
              <div className="relative">
                <input
                  type="number" value={angebotspreis} onChange={(e) => setAngebotspreis(e.target.value)} placeholder="0"
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
                  <button
                    key={p} onClick={() => setPlattform(p)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${plattform === p ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Notiz */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Notiz <span className="text-gray-600">(optional)</span></label>
              <textarea
                value={notiz} onChange={(e) => setNotiz(e.target.value)} rows={2}
                placeholder="z.B. Kratzer am Gehäuse, Ladekabel dabei…"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          </div>

          {/* RIGHT: Results */}
          <div className="p-6 space-y-4 overflow-y-auto bg-gray-950">
            {!modell || !speicher ? (
              <div className="h-full flex items-center justify-center text-gray-600 text-sm">
                Modell und Speicher wählen, um Bewertung zu sehen.
              </div>
            ) : !deal ? (
              <div className="p-4 bg-yellow-950 border border-yellow-700 rounded-xl text-yellow-400 text-sm">
                Modell nicht in der Preisliste gefunden: <strong>{modell} {speicher}</strong>
              </div>
            ) : calcResult ? (
              <>
                {/* Warnings */}
                {!faceId && (
                  <div className="flex items-center gap-2 p-3 bg-yellow-950 border border-yellow-700/50 rounded-xl text-yellow-400 text-sm">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    Face ID defekt — Abschlag −40 € eingerechnet
                  </div>
                )}
                {akku < 75 && (
                  <div className="flex items-center gap-2 p-3 bg-orange-950 border border-orange-700/50 rounded-xl text-orange-400 text-sm">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    Sehr schwacher Akku — harter Abschlag (−35 €)
                  </div>
                )}
                {calcResult.nachfrage <= 3 && (
                  <div className="flex items-center gap-2 p-3 bg-red-950 border border-red-700/50 rounded-xl text-red-400 text-sm">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    Schwache Nachfrage — vorsichtig
                  </div>
                )}

                {/* Empfehlung Badge */}
                {calcResult.empfehlung && (
                  <div className={`rounded-2xl border p-5 text-center ${empfehlungConfig[calcResult.empfehlung].border} bg-gray-900`}>
                    <span className={`inline-block px-6 py-2 rounded-full text-sm font-bold tracking-widest ${empfehlungConfig[calcResult.empfehlung].bg} text-white mb-3`}>
                      {calcResult.empfehlung}
                    </span>
                    <div className="text-3xl font-bold text-white mt-1">
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
                      <div className="border-t border-gray-700 pt-1.5 mt-1.5 flex justify-between text-sm font-semibold">
                        <span className="text-gray-300">Gesamt</span>
                        <span className="text-red-400">−{calcResult.totalAbzug} €</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Nachfrage & Markt */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-900 rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-1">Nachfrage</p>
                    <p className={`text-2xl font-bold ${nachfrageColor(calcResult.nachfrage)}`}>
                      {calcResult.nachfrage}<span className="text-sm font-normal text-gray-600">/10</span>
                    </p>
                  </div>
                  <div className="bg-gray-900 rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-1">Ø Verkaufspreis</p>
                    <p className="text-2xl font-bold text-white">{eur(calcResult.avgVerkauf)}</p>
                  </div>
                </div>

                {/* Empfehlung aus Liste */}
                {calcResult.empfehlungText && (
                  <div className="bg-gray-900 rounded-xl p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Empfehlung</p>
                    <p className="text-sm text-gray-300">{calcResult.empfehlungText}</p>
                  </div>
                )}

                {/* Marktbeobachtung */}
                {calcResult.marktbeobachtung && (
                  <div className="bg-gray-900 rounded-xl p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Marktbeobachtung</p>
                    <p className="text-sm text-gray-400">{calcResult.marktbeobachtung}</p>
                  </div>
                )}

                {/* eBay Link */}
                {calcResult.ebayLink && (
                  <a href={calcResult.ebayLink} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors w-fit">
                    <ExternalLink className="w-4 h-4" />
                    eBay Verkäufe ansehen
                  </a>
                )}

                {/* Message Generator */}
                <div className="border-t border-gray-800 pt-5">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">KI-Nachricht generieren</h3>
                  {msgError && (
                    <div className="mb-3 p-3 bg-red-950 border border-red-800 rounded-lg text-sm text-red-400">{msgError}</div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { key: 'verhandlung', label: 'Verhandeln' },
                      { key: 'kauf', label: 'Kaufbestätigung' },
                      { key: 'ablehnung', label: 'Ablehnung' },
                    ].map(({ key, label }) => (
                      <button
                        key={key} onClick={() => handleGenerate(key)} disabled={loadingMsg[key]}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                      >
                        {loadingMsg[key] ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
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
                            <button onClick={() => copyToClipboard(messages[key], key)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors">
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
      )}
    </div>
  );
}

function Toggle({ label, value, onChange, positiveLabel, negativeLabel, warnWhenFalse, dangerWhenTrue }) {
  const isActive = value;
  let btnClass = 'bg-gray-700 text-gray-400';
  if (isActive && dangerWhenTrue) btnClass = 'bg-red-600 text-white';
  else if (isActive) btnClass = 'bg-green-700 text-green-100';
  else if (!isActive && warnWhenFalse) btnClass = 'bg-yellow-700 text-yellow-100';

  return (
    <div className="bg-gray-900 rounded-xl p-3 text-center">
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <button onClick={() => onChange(!value)} className={`w-full py-1.5 rounded-lg text-xs font-medium transition-colors ${btnClass}`}>
        {value ? positiveLabel : negativeLabel}
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
