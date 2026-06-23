export function roundToFive(val) {
  return Math.round(val / 5) * 5;
}

export function calculateDeal(deal, form) {
  if (!deal) return null;

  const { zustand, akku, ovp, faceId, plattform, angebotspreis } = form;

  let zielEKBase = deal.zielEK;
  let maxEKBase = deal.maxEK;

  let abzuege = 0;
  const abzugDetails = [];

  // Akku-Abzug (kumulativ, also nur der höchste greift)
  if (akku < 75) {
    abzuege += 35;
    abzugDetails.push({ label: 'Akku < 75%', betrag: -35 });
  } else if (akku < 80) {
    abzuege += 20;
    abzugDetails.push({ label: 'Akku < 80%', betrag: -20 });
  } else if (akku < 85) {
    abzuege += 10;
    abzugDetails.push({ label: 'Akku < 85%', betrag: -10 });
  }

  // OVP
  if (!ovp) {
    abzuege += 10;
    abzugDetails.push({ label: 'Kein OVP', betrag: -10 });
  }

  // Face ID
  if (!faceId) {
    abzuege += 40;
    abzugDetails.push({ label: 'Face ID defekt', betrag: -40 });
  }

  // Zustand (kumulativ, nur der höchste greift)
  if (zustand < 5) {
    abzuege += 30;
    abzugDetails.push({ label: `Zustand ${zustand}/10`, betrag: -30 });
  } else if (zustand < 7) {
    abzuege += 15;
    abzugDetails.push({ label: `Zustand ${zustand}/10`, betrag: -15 });
  }

  let zielEK = zielEKBase - abzuege;
  let maxEK = maxEKBase - abzuege;

  // eBay-Abzug: 8% vom Ø Verkauf, wird zusätzlich vom Max-EK abgezogen
  if (plattform === 'eBay') {
    const ebayAbzug = Math.round(deal.avgVerkauf * 0.08);
    maxEK -= ebayAbzug;
    zielEK -= ebayAbzug;
    abzugDetails.push({ label: 'eBay-Gebühren (8% Ø VK)', betrag: -ebayAbzug });
  }

  zielEK = roundToFive(zielEK);
  maxEK = roundToFive(maxEK);

  const avgVerkauf = deal.avgVerkauf;
  const gewinnBeiZielEK = avgVerkauf - zielEK;

  let empfehlung;
  const preis = parseFloat(angebotspreis);
  if (!isNaN(preis) && preis > 0) {
    if (preis <= zielEK) empfehlung = 'KAUFEN';
    else if (preis <= maxEK) empfehlung = 'VERHANDELN';
    else empfehlung = 'ABLEHNEN';
  } else {
    empfehlung = null;
  }

  return {
    zielEK,
    maxEK,
    gewinnBeiZielEK,
    empfehlung,
    abzugDetails,
    totalAbzug: abzuege,
    nachfrage: deal.nachfrage,
    marktbeobachtung: deal.marktbeobachtung,
    empfehlungText: deal.empfehlung,
    ebayLink: deal.ebayLink,
    avgVerkauf,
  };
}
