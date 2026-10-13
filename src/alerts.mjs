// Trzy niezalezne wyzwalacze alertu. Kazdy odpowiada na inne pytanie:
//   hard    - "czy zeszlo ponizej kwoty, ktora Przemek uznal za oplacalna"
//   median  - "czy to odchylenie od tego, co ten model kosztuje zwykle"
//   low     - "czy to najtaniej, jak kiedykolwiek widzielismy"
// Alert leci, gdy zadziala ktorykolwiek. Powody sa kumulowane, nie zastepuja sie.

export const DAY = 24 * 60 * 60 * 1000;

// Cena katalogowa vs koszt koncowy. Progi Prema pochodza z cen katalogowych,
// wiec porownanie idzie po katalogowej - inaczej doliczona dostawa cicho
// przesunelaby kazdy prog o 100-200 zl. Koszt koncowy jest liczony i pokazywany,
// ale nie decyduje o alercie. Mieszanie tych dwoch jednostek to blad, ktory
// widac dopiero po miesiacu dziwnych alertow.
export function effectiveCost(offer) {
  const disc = offer.discountPct ? offer.price * (1 - offer.discountPct / 100) : offer.price;
  if (offer.shipping == null) return { cost: Math.round(disc * 100) / 100, shippingKnown: false };
  return { cost: Math.round((disc + offer.shipping) * 100) / 100, shippingKnown: true };
}

export function median(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

// Historia to lista { ts, best } - jeden wpis na przebieg.
export function windowPrices(history, nowMs, days) {
  const from = nowMs - days * DAY;
  return history
    .filter((h) => h && h.best && Number.isFinite(h.best.price) && Date.parse(h.ts) >= from)
    .map((h) => h.best.price);
}

export function allTimeLow(history) {
  const ps = history.filter((h) => h && h.best && Number.isFinite(h.best.price)).map((h) => h.best.price);
  return ps.length ? Math.min(...ps) : null;
}

export function evaluate(product, best, history, rules, state, nowMs) {
  const reasons = [];
  if (!best || !Number.isFinite(best.price)) return { fire: false, reasons, stats: {} };

  const win = windowPrices(history, nowMs, rules.medianWindowDays);
  const med = win.length >= rules.minSamplesForMedian ? median(win) : null;
  const low = allTimeLow(history);

  if (product.hardThreshold != null && best.price < product.hardThreshold) {
    reasons.push({
      code: "hard",
      text: `ponizej progu ${fmt(product.hardThreshold)} (jest ${fmt(best.price)})`,
    });
  }

  if (med != null) {
    const limit = med * (1 - rules.medianDropPct / 100);
    if (best.price <= limit) {
      reasons.push({
        code: "median",
        text: `${pct(best.price, med)} ponizej mediany ${rules.medianWindowDays} dni (${fmt(med)})`,
      });
    }
  }

  if (low != null && best.price < low) {
    reasons.push({
      code: "low",
      text: `nowe minimum - poprzednie ${fmt(low)}`,
    });
  } else if (low == null && history.length === 0) {
    // Pierwszy przebieg nie jest odkryciem. Bez tego kazdy start bota
    // wysylalby piec alertow "nowe minimum" na dzien dobry.
    reasons.length = 0;
  }

  if (!reasons.length) return { fire: false, reasons, stats: { median: med, allTimeLow: low, samples: win.length } };

  // Odbicie powtorek: ta sama cena w tym samym sklepie nie alarmuje ponownie
  // przez `realertAfterHours`. Przy skanie co 3h bez tego dostawalby 8 maili
  // dziennie o tej samej promocji.
  const key = `${product.id}|${best.shop}|${best.price}`;
  const prev = state && state[key];
  if (prev && nowMs - prev < rules.realertAfterHours * 3600 * 1000) {
    return { fire: false, reasons, suppressed: true, stats: { median: med, allTimeLow: low, samples: win.length } };
  }

  return { fire: true, reasons, key, stats: { median: med, allTimeLow: low, samples: win.length } };
}

export function fmt(n) {
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " zl";
}

export function pct(now, ref) {
  if (!Number.isFinite(now) || !Number.isFinite(ref) || ref === 0) return "-";
  return Math.round((1 - now / ref) * 1000) / 10 + "%";
}

// Zl za minute podtrzymania przy obciazeniu z meta.loadWatts (200 W). Spadek
// ceny mowi "ten model staniał", a ten wskaznik - "za te pieniadze najdluzej
// trzyma szafe". Czas pochodzi z wykresu producenta i jest wpisany w
// konfiguracji (runtime200W.minutes); bez niego wskaznika nie liczymy.
export function perMinute(price, product) {
  const min = product && product.runtime200W && product.runtime200W.minutes;
  if (!Number.isFinite(price) || !Number.isFinite(min) || min <= 0) return null;
  return Math.round((price / min) * 10) / 10;
}

// Ranking modeli po zl/min (rosnaco). Modele bez ceny albo bez czasu
// podtrzymania ida na koniec i nie dostaja miejsca.
export function rankByPerMinute(products) {
  const withVal = (products || []).filter((p) => Number.isFinite(p.perMin)).sort((a, b) => a.perMin - b.perMin);
  const rank = new Map(withVal.map((p, i) => [p.id, i + 1]));
  return {
    order: withVal.map((p) => p.id),
    rankOf: (id) => rank.get(id) || null,
    total: withVal.length,
    best: withVal[0] || null,
  };
}

export function fmtPerMin(v) {
  if (!Number.isFinite(v)) return "-";
  return v.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + " zl/min";
}
