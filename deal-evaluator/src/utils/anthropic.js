export async function generateMessage({ apiKey, type, formData, calcResult }) {
  const { modell, speicher, angebotspreis, zustand, akku, ovp, faceId, plattform, notiz } = formData;
  const { zielEK, maxEK, totalAbzug } = calcResult;

  const typeLabel = {
    verhandlung: 'Verhandlungsnachricht',
    kauf: 'Kaufbestätigung',
    ablehnung: 'Ablehnung',
  }[type];

  const userPrompt = `
Nachrichtentyp: ${typeLabel}
Gerät: ${modell}, ${speicher}
Angeforderter Preis: ${angebotspreis}€
Unser Ziel-EK: ${zielEK}€
Unser Max-EK: ${maxEK}€
Berechnete Abzüge gesamt: ${totalAbzug}€
Zustand: ${zustand}/10
Akku: ${akku}%
OVP: ${ovp ? 'Ja' : 'Nein'}
Face ID: ${faceId ? 'Funktioniert' : 'Defekt'}
Plattform: ${plattform}
${notiz ? `Notiz: ${notiz}` : ''}
`.trim();

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-calls': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system:
        'Du bist Assistent für Schweikert Handel, ein professionelles Apple-Recommerce-Business. Generiere eine kurze, individuelle Nachricht auf Deutsch. Stil: professionell, freundlich, nie Copy-Paste-artig. Kleinanzeigen: etwas lockerer. eBay: etwas formeller. Immer „Sie". Nur die Nachricht, kein Kommentar drumherum. Max. 3 Sätze.',
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API-Fehler: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}
