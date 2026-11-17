// The lens library behind the viewfinder's picker: maker, series, and the
// focal lengths that series really comes in. Pure data plus a few helpers, so
// the picker, the lens strip and a saved still all read one list.
//
// Focal lengths are the makers' published sets. A series is either PRIMES (a
// list) or a ZOOM (a range). `squeeze` marks an anamorphic series: the lens
// squeezes the picture sideways by that factor, so on the same sensor it sees
// that much wider than a spherical lens of the same focal length.
//
// To add a set: one line under its maker. Nothing else needs to change.

export type LensSeries = {
  id: string;
  name: string;
  /** Prime focal lengths in mm. */
  focals?: number[];
  /** A zoom's range in mm. */
  zoom?: [number, number];
  /** Anamorphic squeeze (2, 1.8, 1.5, 1.33). Absent = spherical. */
  squeeze?: number;
};
export type LensMake = { name: string; series: LensSeries[] };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const P = (name: string, focals: number[], squeeze?: number): Omit<LensSeries, "id"> => ({ name, focals, squeeze });
const Z = (name: string, a: number, b: number, squeeze?: number): Omit<LensSeries, "id"> => ({ name, zoom: [a, b], squeeze });

const make = (name: string, series: Omit<LensSeries, "id">[]): LensMake => ({
  name,
  series: series.map((s) => ({ ...s, id: `${slug(name)}/${slug(s.name)}` })),
});

/** The primes most sets share, for when the set itself does not matter. */
export const GENERIC_ID = "generic/common-primes";

export const LENS_MAKES: LensMake[] = [
  make("Generic", [
    P("Common primes", [12, 14, 16, 18, 21, 24, 25, 27, 28, 29, 32, 35, 40, 47, 50, 58, 65, 75, 85, 100, 125, 135, 150, 200]),
    Z("Any zoom", 8, 400),
    P("Anamorphic 2x", [25, 32, 40, 50, 65, 75, 100, 135], 2),
    P("Anamorphic 1.5x", [32, 40, 50, 65, 75, 100, 135], 1.5),
    P("Anamorphic 1.33x", [24, 35, 50, 75, 100], 1.33),
  ]),
  make("Angenieux", [
    P("Optimo Prime", [18, 21, 24, 28, 32, 40, 50, 60, 75, 100, 135, 200]),
    Z("Optimo 15-40mm", 15, 40),
    Z("Optimo 28-76mm", 28, 76),
    Z("Optimo 45-120mm", 45, 120),
    Z("Optimo 17-80mm", 17, 80),
    Z("Optimo 19.5-94mm", 19.5, 94),
    Z("Optimo 24-290mm", 24, 290),
    Z("Optimo 28-340mm", 28, 340),
    Z("Optimo Ultra 12x 36-435mm (FF)", 36, 435),
    Z("Optimo Ultra Compact 21-56mm", 21, 56),
    Z("Optimo Ultra Compact 37-102mm", 37, 102),
    Z("EZ-1 30-90mm (S35)", 30, 90),
    Z("EZ-1 45-135mm (FF)", 45, 135),
    Z("EZ-2 15-40mm (S35)", 15, 40),
    Z("EZ-2 22-60mm (FF)", 22, 60),
    Z("Optimo Anamorphic 56-152mm 2x", 56, 152, 2),
    Z("Optimo Anamorphic 30-72mm 2x", 30, 72, 2),
  ]),
  make("ARRI", [
    P("Signature Primes", [12, 15, 18, 21, 25, 29, 35, 40, 47, 58, 75, 95, 125, 150, 200, 280]),
    P("Master Primes", [12, 14, 16, 18, 21, 25, 27, 32, 35, 40, 50, 65, 75, 100, 135, 150]),
    P("Ultra Primes", [8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 50, 65, 85, 100, 135, 180]),
    P("Master Anamorphic 2x", [28, 35, 40, 50, 60, 75, 100, 135, 180], 2),
    Z("Signature Zoom 16-32mm", 16, 32),
    Z("Signature Zoom 24-75mm", 24, 75),
    Z("Signature Zoom 45-135mm", 45, 135),
    Z("Signature Zoom 65-300mm", 65, 300),
    Z("Alura 15.5-45mm", 15.5, 45),
    Z("Alura 18-80mm", 18, 80),
    Z("Alura 30-80mm", 30, 80),
    Z("Alura 45-250mm", 45, 250),
  ]),
  make("Atlas", [
    P("Orion 2x", [21, 25, 32, 40, 50, 65, 80, 100], 2),
    P("Mercury 1.5x", [36, 42, 54, 72, 95, 138], 1.5),
  ]),
  make("BLAZAR", [
    P("Remus 1.5x", [33, 45, 65, 100], 1.5),
  ]),
  make("Canon", [
    P("CN-E Primes", [14, 20, 24, 35, 50, 85, 135]),
    P("Sumire Primes", [14, 20, 24, 35, 50, 85, 135]),
    P("K35 (vintage)", [18, 24, 35, 55, 85]),
    P("RF L primes", [20, 24, 35, 50, 85, 100, 135]),
    Z("Flex Zoom 20-50mm (FF)", 20, 50),
    Z("Flex Zoom 45-135mm (FF)", 45, 135),
    Z("Flex Zoom 14-35mm (S35)", 14, 35),
    Z("Flex Zoom 31.5-95mm (S35)", 31.5, 95),
    Z("CN-E 15.5-47mm", 15.5, 47),
    Z("CN-E 30-105mm", 30, 105),
    Z("CN-E 18-80mm", 18, 80),
    Z("CN-E 70-200mm", 70, 200),
    Z("CN-E 30-300mm", 30, 300),
    Z("CN7x17 17-120mm", 17, 120),
    Z("RF 15-35mm", 15, 35),
    Z("RF 24-70mm", 24, 70),
    Z("RF 24-105mm", 24, 105),
    Z("RF 28-70mm", 28, 70),
    Z("RF 70-200mm", 70, 200),
    Z("EF 16-35mm", 16, 35),
    Z("EF 24-70mm", 24, 70),
    Z("EF 70-200mm", 70, 200),
  ]),
  make("Cooke", [
    P("S4/i", [12, 14, 16, 18, 21, 25, 27, 32, 35, 40, 50, 65, 75, 100, 135, 150, 180, 300]),
    P("S7/i", [16, 18, 21, 25, 27, 32, 40, 50, 65, 75, 100, 135, 180, 300]),
    P("S8/i", [18, 21, 25, 27, 32, 40, 50, 65, 75, 100, 135, 180]),
    P("5/i", [18, 25, 32, 40, 50, 65, 75, 100, 135]),
    P("Mini S4/i", [18, 21, 25, 32, 40, 50, 65, 75, 100, 135]),
    P("Panchro/i Classic", [18, 21, 25, 27, 32, 40, 50, 65, 75, 100, 135, 152]),
    P("Speed Panchro (vintage)", [18, 25, 32, 40, 50, 75, 100]),
    P("SP3", [25, 32, 50, 75, 100]),
    P("Anamorphic/i 2x", [25, 32, 40, 50, 65, 75, 100, 135, 180, 300], 2),
    P("Anamorphic/i FF 1.8x", [32, 40, 50, 75, 85, 100, 135, 180], 1.8),
    Z("Varotal/i FF 30-95mm", 30, 95),
    Z("Varotal/i FF 85-215mm", 85, 215),
  ]),
  make("DZOFilm", [
    P("Vespid Prime", [12, 16, 21, 25, 35, 40, 50, 75, 90, 100, 125]),
    P("Arles", [14, 21, 25, 35, 40, 50, 75, 100, 135, 180]),
    P("Pavo 2x", [28, 32, 40, 55, 65, 75, 100, 135, 180], 2),
    Z("Pictor 14-30mm", 14, 30),
    Z("Pictor 20-55mm", 20, 55),
    Z("Pictor 50-125mm", 50, 125),
    Z("Catta Zoom 18-35mm", 18, 35),
    Z("Catta Zoom 35-80mm", 35, 80),
    Z("Catta Zoom 70-135mm", 70, 135),
    Z("Tango 18-90mm", 18, 90),
    Z("Tango 65-280mm", 65, 280),
  ]),
  make("Fujinon", [
    Z("Premista 19-45mm", 19, 45),
    Z("Premista 28-100mm", 28, 100),
    Z("Premista 80-250mm", 80, 250),
    Z("Cabrio 14-35mm", 14, 35),
    Z("Cabrio 19-90mm", 19, 90),
    Z("Cabrio 20-120mm", 20, 120),
    Z("Cabrio 25-300mm", 25, 300),
    Z("Cabrio 85-300mm", 85, 300),
    Z("MK 18-55mm", 18, 55),
    Z("MK 50-135mm", 50, 135),
  ]),
  make("Hawk / Vantage", [
    P("V-Lite 2x", [28, 35, 45, 55, 65, 80, 110, 140], 2),
    P("class-X 2x", [28, 35, 45, 55, 65, 80, 110, 140], 2),
    P("Vantage One", [17.5, 21, 25, 32, 40, 50, 65, 90, 120]),
  ]),
  make("Kowa", [
    P("Cine Prominar 2x", [40, 50, 75, 100], 2),
  ]),
  make("Laowa", [
    P("Proteus 2x", [35, 45, 60, 85], 2),
    P("Nanomorph 1.5x", [27, 35, 50, 65, 80], 1.5),
    Z("Ranger 16-30mm", 16, 30),
    Z("Ranger 28-75mm", 28, 75),
    Z("Ranger 75-180mm", 75, 180),
  ]),
  make("Leica", [
    P("Leica R (stills)", [19, 24, 28, 35, 50, 60, 80, 90, 100, 135, 180]),
  ]),
  make("Leitz", [
    P("Summilux-C", [16, 18, 21, 25, 29, 35, 40, 50, 65, 75, 100, 135]),
    P("Summicron-C", [15, 18, 21, 25, 29, 35, 40, 50, 75, 100, 135]),
    P("Leitz Prime", [18, 21, 25, 29, 35, 40, 50, 65, 75, 100, 135, 180]),
    P("Elsie", [15, 18, 21, 25, 29, 35, 40, 50, 65, 75, 100, 125, 150]),
    P("Thalia", [24, 30, 35, 45, 55, 70, 100, 120, 180]),
    P("Hugo", [18, 21, 24, 28, 35, 50, 75, 90, 135]),
    P("M 0.8", [21, 24, 28, 35, 50, 75, 90]),
  ]),
  make("Meike", [
    P("FF Prime", [16, 24, 35, 50, 85, 105, 135]),
    P("S35 Prime", [12, 18, 25, 35, 50, 75, 100, 135]),
  ]),
  make("Nikon", [
    P("Nikkor Z S primes", [20, 24, 35, 50, 85, 135]),
    P("Nikkor AI-S (vintage)", [20, 24, 28, 35, 50, 85, 105, 135, 180]),
  ]),
  make("NiSi", [
    P("Athena Prime", [14, 18, 25, 35, 40, 50, 85, 135]),
  ]),
  make("Panavision", [
    P("Primo Primes", [10, 14.5, 17.5, 21, 27, 35, 40, 50, 75, 100, 125, 150]),
    P("Primo 70", [24, 27, 35, 40, 50, 65, 80, 100, 125, 150, 200, 250]),
    P("Panaspeed", [17, 24, 29, 35, 40, 50, 65, 80, 100, 135]),
    P("C Series 2x", [30, 35, 40, 50, 60, 75, 100, 150, 180], 2),
    P("E Series 2x", [28, 35, 40, 50, 75, 85, 100, 135, 180], 2),
    P("G Series 2x", [25, 30, 35, 40, 50, 60, 75, 100], 2),
    P("T Series 2x", [28, 35, 40, 50, 60, 75, 100, 135, 150, 180], 2),
    Z("Primo 14.5-50mm", 14.5, 50),
    Z("Primo 15-40mm", 15, 40),
    Z("Primo 19-90mm", 19, 90),
    Z("Primo 27-75mm", 27, 75),
    Z("Primo 4:1 17.5-75mm", 17.5, 75),
    Z("Primo 11:1 24-275mm", 24, 275),
    Z("Primo 3:1 135-420mm", 135, 420),
  ]),
  make("RED", [
    P("Pro Primes", [18, 25, 35, 50, 85, 100]),
  ]),
  make("Schneider", [
    P("Xenon FF", [18, 25, 35, 50, 75, 100]),
  ]),
  make("Sigma", [
    P("Cine FF High Speed", [14, 20, 24, 28, 35, 40, 50, 85, 105, 135]),
    P("Art primes", [14, 20, 24, 28, 35, 40, 50, 85, 105, 135]),
    Z("Cine 18-35mm", 18, 35),
    Z("Cine 50-100mm", 50, 100),
    Z("Cine FF 24-35mm", 24, 35),
  ]),
  make("Sirui", [
    P("Jupiter FF Macro", [24, 35, 50, 75, 100]),
    P("Night Walker (S35)", [16, 24, 35, 55, 75]),
    P("Venus 1.6x", [35, 50, 75, 100, 135, 150], 1.6),
    P("Saturn 1.6x", [35, 50, 75], 1.6),
    P("Anamorphic 1.33x", [24, 35, 50, 75], 1.33),
  ]),
  make("Sony", [
    P("G Master primes", [14, 24, 35, 50, 85, 135]),
    P("CineAlta 4K", [20, 25, 35, 50, 85, 135]),
    Z("G Master 12-24mm", 12, 24),
    Z("G Master 16-35mm", 16, 35),
    Z("G Master 24-70mm", 24, 70),
    Z("G Master 28-70mm", 28, 70),
    Z("G Master 70-200mm", 70, 200),
    Z("G Master 100-400mm", 100, 400),
  ]),
  make("Thypoch", [
    P("Simera-C", [21, 28, 35, 50, 75]),
  ]),
  make("Tokina", [
    P("Cinema Vista Prime", [18, 21, 25, 29, 35, 40, 50, 65, 85, 105, 135, 180]),
    Z("Cinema 11-20mm", 11, 20),
    Z("Cinema 25-75mm", 25, 75),
    Z("Cinema 50-135mm", 50, 135),
  ]),
  make("Tribe7", [
    P("Blackwing7", [20.7, 27, 37, 47, 57, 77, 107, 137]),
  ]),
  make("Viltrox", [
    P("Epic 1.33x", [35, 50, 75], 1.33),
  ]),
  make("XEEN (Samyang / Rokinon)", [
    P("XEEN", [14, 16, 20, 24, 35, 50, 85, 135]),
    P("XEEN CF", [16, 24, 35, 50, 85]),
    P("XEEN Meister", [14, 24, 35, 50, 85, 135]),
  ]),
  make("Zeiss", [
    P("Supreme Prime", [15, 18, 21, 25, 29, 35, 40, 50, 65, 85, 100, 135, 150, 200]),
    P("Supreme Prime Radiance", [18, 21, 25, 29, 35, 40, 50, 65, 85, 100, 135]),
    P("Nano Prime", [18, 24, 35, 50, 75, 100]),
    P("Compact Prime CP.3", [15, 18, 21, 25, 28, 35, 50, 85, 100, 135]),
    P("Compact Prime CP.2", [15, 18, 21, 25, 28, 35, 50, 85, 100, 135]),
    P("Super Speed", [18, 25, 35, 50, 65, 85]),
  ]),
];

/** Extenders: they multiply the focal length (and cost light, not shown here). */
export const EXTENDERS: { id: string; label: string; factor: number }[] = [
  { id: "none", label: "None", factor: 1 },
  { id: "1.4x", label: "1.4x", factor: 1.4 },
  { id: "2x", label: "2x", factor: 2 },
];

export function extenderFactor(id: string | null | undefined): number {
  return EXTENDERS.find((e) => e.id === id)?.factor ?? 1;
}

/** Marks along a zoom's range: its two ends plus the usual stops between. */
const ZOOM_MARKS = [10, 12, 14, 16, 18, 21, 24, 28, 32, 35, 40, 50, 65, 75, 85, 100, 135, 150, 200, 250, 300, 400];
export function seriesFocals(s: LensSeries): number[] {
  if (s.focals?.length) return s.focals;
  if (!s.zoom) return [];
  const [a, b] = s.zoom;
  const mid = ZOOM_MARKS.filter((m) => m > a * 1.06 && m < b * 0.94);
  return [a, ...mid, b];
}

/** A zoom holds any length in its range; primes hold the nearest one made. */
export function clampToSeries(s: LensSeries, focal: number): number {
  if (s.zoom) return Math.max(s.zoom[0], Math.min(s.zoom[1], focal));
  const f = s.focals ?? [];
  if (!f.length) return focal;
  return f.reduce((best, x) => (Math.abs(x - focal) < Math.abs(best - focal) ? x : best), f[0]);
}

/** "32", "14.5", "20.7": a focal length as it is engraved. */
export const mm = (f: number) => String(Math.round(f * 10) / 10);

// ----- Your own lens sets (kept on the phone)

export const CUSTOM_MAKE = "My lenses";

/**
 * A lens set typed in by hand, read back out of storage. Everything is
 * checked: a name, at least one sensible focal length, a believable squeeze.
 */
export function parseCustomSeries(raw: unknown): LensSeries | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.replace(/\s+/g, " ").trim().slice(0, 60) : "";
  if (!name) return null;
  const focals = parseFocalList(Array.isArray(o.focals) ? o.focals.join(",") : "");
  if (!focals.length) return null;
  const sq = typeof o.squeeze === "number" && o.squeeze > 1 && o.squeeze <= 2.5 ? Math.round(o.squeeze * 100) / 100 : undefined;
  const id = typeof o.id === "string" && o.id.startsWith("custom/") ? o.id.slice(0, 80) : `custom/${slug(name)}`;
  return { id, name, focals, squeeze: sq };
}

/** "24, 35 50mm 85" -> [24, 35, 50, 85]. Junk and out-of-range are dropped. */
export function parseFocalList(text: string): number[] {
  const out = new Set<number>();
  for (const part of text.split(/[^0-9.]+/)) {
    if (!part) continue;
    const n = Number(part);
    if (Number.isFinite(n) && n >= 4 && n <= 2000) out.add(Math.round(n * 10) / 10);
  }
  return [...out].sort((a, b) => a - b).slice(0, 40);
}

export function findSeries(id: string | null | undefined, custom: LensSeries[] = []): { make: string; series: LensSeries } | null {
  if (!id) return null;
  const c = custom.find((s) => s.id === id);
  if (c) return { make: CUSTOM_MAKE, series: c };
  for (const m of LENS_MAKES) {
    const s = m.series.find((x) => x.id === id);
    if (s) return { make: m.name, series: s };
  }
  return null;
}

/** "Cooke S4/i" / "Sirui Jupiter FF Macro": how a set is named on a still. */
export function lensLabel(makeName: string, s: LensSeries): string {
  if (makeName === "Generic" || makeName === CUSTOM_MAKE) return s.name;
  return `${makeName.replace(/ \(.+\)$/, "")} ${s.name}`;
}
