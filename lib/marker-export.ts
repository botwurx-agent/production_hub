/**
 * Review comments out as timeline markers, so an editor sees every note at its
 * frame inside their own editing app instead of reading a list beside it.
 *
 * PURE AND NOT `server-only`: the export runs in the browser from the comments
 * the review canvas already holds (nothing new is fetched), and the formats are
 * exactly the kind of thing that has to be asserted rather than eyeballed.
 *
 * FOUR FORMATS, each the one its app actually imports markers from:
 * - Premiere Pro: an FCP7 XML (xmeml) sequence carrying sequence markers.
 * - DaVinci Resolve: an EDL in Resolve's own marker form
 *   (Timeline > Import > Timeline Markers from EDL).
 * - Final Cut Pro: an FCPXML project whose gap clip carries the markers.
 * - CSV: for anything else, and for reading in a spreadsheet.
 *
 * FRAME RATE IS ASKED, NEVER GUESSED. A browser <video> does not expose a
 * file's frame rate, and a marker list built at the wrong rate drifts further
 * off the frame the further into the cut it goes. The caller passes the rate of
 * the EDITOR'S SEQUENCE, which is the one that matters.
 *
 * TIMECODE IS NON-DROP-FRAME throughout. For 29.97 and 59.94 that means the
 * frame NUMBER is exact (seconds x the true rate) and the label counts on a
 * nominal 30 or 60 base, which is what NDF is. Drop-frame labelling is not
 * offered: it changes only the label, and getting it subtly wrong is worse than
 * a sequence set to NDF.
 */

export type MarkerFormat = "premiere" | "resolve" | "fcp" | "csv";

export const MARKER_FORMATS: { key: MarkerFormat; label: string; ext: string; hint: string }[] = [
  { key: "premiere", label: "Premiere Pro", ext: "xml", hint: "File > Import. Opens as a sequence carrying the markers." },
  { key: "resolve", label: "DaVinci Resolve", ext: "edl", hint: "Timeline > Import > Timeline Markers from EDL." },
  { key: "fcp", label: "Final Cut Pro", ext: "fcpxml", hint: "File > Import > XML. Opens as a project carrying the markers." },
  { key: "csv", label: "CSV spreadsheet", ext: "csv", hint: "Every note with its timecode, for a spreadsheet or any other app." },
];

/** A frame rate as the editing apps think of it: a nominal base plus NTSC. */
export type FrameRate = { key: string; label: string; base: number; ntsc: boolean };

export const FRAME_RATES: FrameRate[] = [
  { key: "23.976", label: "23.976", base: 24, ntsc: true },
  { key: "24", label: "24", base: 24, ntsc: false },
  { key: "25", label: "25", base: 25, ntsc: false },
  { key: "29.97", label: "29.97", base: 30, ntsc: true },
  { key: "30", label: "30", base: 30, ntsc: false },
  { key: "50", label: "50", base: 50, ntsc: false },
  { key: "59.94", label: "59.94", base: 60, ntsc: true },
  { key: "60", label: "60", base: 60, ntsc: false },
];

export function frameRate(key: string | null | undefined): FrameRate {
  return FRAME_RATES.find((r) => r.key === key) ?? FRAME_RATES[1];
}

/** True frames per second (23.976 is 24000/1001, not 23.976). */
export function fpsOf(r: FrameRate): number {
  return r.ntsc ? (r.base * 1000) / 1001 : r.base;
}

/** The frame a moment lands on. Junk and negatives read as frame 0. */
export function framesAt(seconds: number, r: FrameRate): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.round(seconds * fpsOf(r));
}

/** A frame count as HH:MM:SS:FF on the rate's nominal base (non-drop-frame). */
export function frameTimecode(frames: number, r: FrameRate): string {
  const f = Math.max(0, Math.floor(frames));
  const base = r.base;
  const ff = f % base;
  const totalSec = Math.floor(f / base);
  const ss = totalSec % 60;
  const mm = Math.floor(totalSec / 60) % 60;
  const hh = Math.floor(totalSec / 3600);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(hh)}:${p(mm)}:${p(ss)}:${p(ff)}`;
}

/** Frames before the timeline's first frame (01:00:00:00 is common). */
export function startFrames(startHour: 0 | 1, r: FrameRate): number {
  return startHour * 3600 * r.base;
}

/** What the exporters need from a comment; built by the caller. */
export type MarkerNote = {
  number: number | null;
  author: string;
  isClient: boolean;
  teamOnly: boolean;
  resolved: boolean;
  timecode: number;
  timecodeEnd: number | null;
  body: string;
  replies: { author: string; body: string }[];
};

export type MarkerOptions = {
  format: MarkerFormat;
  rate: FrameRate;
  startHour: 0 | 1;
  /** Shown as the sequence / project / EDL title, and used for the file name. */
  title: string;
};

/** One line, safe for every format: no newlines, no tabs, no EDL pipes. */
export function oneLine(s: string, max = 400): string {
  const t = s.replace(/[\r\n\t]+/g, " ").replace(/\|/g, "/").replace(/\s{2,}/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** "#3 Maya (client): Can we go warmer? / Northline: Intended." */
export function markerText(n: MarkerNote): string {
  const who = `${n.author}${n.isClient ? " (client)" : ""}`;
  const head = `${n.number != null ? `#${n.number} ` : ""}${who}: ${n.body}`;
  const tail = n.replies.map((r) => `${r.author}: ${r.body}`);
  return oneLine([head, ...tail].join(" / "));
}

/** The short name a marker shows on the timeline. */
export function markerName(n: MarkerNote): string {
  return oneLine(`${n.number != null ? `#${n.number} ` : ""}${n.body}`, 60);
}

/** Marker length in frames: a range comment spans its range, a point is 1. */
export function markerSpan(n: MarkerNote, r: FrameRate): { at: number; len: number } {
  const at = framesAt(n.timecode, r);
  const end =
    n.timecodeEnd != null && Number.isFinite(n.timecodeEnd) && n.timecodeEnd > n.timecode
      ? framesAt(n.timecodeEnd, r)
      : at + 1;
  return { at, len: Math.max(1, end - at) };
}

function xml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Notes in timeline order, earliest first; ties keep their number order. */
export function orderNotes(notes: MarkerNote[]): MarkerNote[] {
  return [...notes]
    .filter((n) => Number.isFinite(n.timecode) && n.timecode >= 0)
    .sort((a, b) => a.timecode - b.timecode || (a.number ?? 0) - (b.number ?? 0));
}

/** Sequence length: past the last marker, with a little room after it. */
function seqFrames(notes: MarkerNote[], r: FrameRate): number {
  let last = 0;
  for (const n of notes) {
    const { at, len } = markerSpan(n, r);
    last = Math.max(last, at + len);
  }
  return last + r.base * 5;
}

export function buildResolveEdl(notes: MarkerNote[], o: MarkerOptions): string {
  const r = o.rate;
  const start = startFrames(o.startHour, r);
  const out: string[] = [`TITLE: ${oneLine(o.title, 70)}`, "FCM: NON-DROP FRAME", ""];
  orderNotes(notes).forEach((n, i) => {
    const { at, len } = markerSpan(n, r);
    const tcIn = frameTimecode(start + at, r);
    const tcOut = frameTimecode(start + at + 1, r);
    const ev = String(i + 1).padStart(3, "0");
    // Source and record both carry the marker's frame; Resolve places the
    // marker at the RECORD in-point and reads its length from D.
    out.push(`${ev}  001      V     C        ${tcIn} ${tcOut} ${tcIn} ${tcOut}  `);
    out.push(` |C:${n.isClient ? "ResolveColorYellow" : "ResolveColorBlue"} |M:${markerText(n)} |D:${len}`);
    out.push("");
  });
  return out.join("\n");
}

export function buildPremiereXml(notes: MarkerNote[], o: MarkerOptions): string {
  const r = o.rate;
  const ordered = orderNotes(notes);
  const dur = seqFrames(ordered, r);
  const rate = `<rate><timebase>${r.base}</timebase><ntsc>${r.ntsc ? "TRUE" : "FALSE"}</ntsc></rate>`;
  const start = startFrames(o.startHour, r);
  const markers = ordered.map((n) => {
    const { at, len } = markerSpan(n, r);
    return [
      "    <marker>",
      `      <name>${xml(markerName(n))}</name>`,
      `      <comment>${xml(markerText(n))}</comment>`,
      `      <in>${at}</in>`,
      `      <out>${len > 1 ? at + len : -1}</out>`,
      "    </marker>",
    ].join("\n");
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<!DOCTYPE xmeml>",
    '<xmeml version="4">',
    "  <sequence>",
    `    <name>${xml(oneLine(o.title, 120))}</name>`,
    `    <duration>${dur}</duration>`,
    `    ${rate}`,
    `    <timecode>${rate}<string>${frameTimecode(start, r)}</string><frame>${start}</frame><displayformat>NDF</displayformat></timecode>`,
    "    <media><video><track/></video><audio><track/></audio></media>",
    ...markers,
    "  </sequence>",
    "</xmeml>",
    "",
  ].join("\n");
}

/** FCPXML times are rationals of the frame duration: n frames = n*num/den s. */
function fcpTime(frames: number, r: FrameRate): string {
  if (frames === 0) return "0s";
  return r.ntsc ? `${frames * 1001}/${r.base * 1000}s` : `${frames}/${r.base}s`;
}

export function buildFcpxml(notes: MarkerNote[], o: MarkerOptions): string {
  const r = o.rate;
  const ordered = orderNotes(notes);
  const dur = seqFrames(ordered, r);
  const start = startFrames(o.startHour, r);
  const frameDuration = r.ntsc ? `1001/${r.base * 1000}s` : `1/${r.base}s`;
  const markers = ordered.map((n) => {
    const { at, len } = markerSpan(n, r);
    return `              <marker start="${fcpTime(start + at, r)}" duration="${fcpTime(len, r)}" value="${xml(markerName(n))}" note="${xml(markerText(n))}"/>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<!DOCTYPE fcpxml>",
    '<fcpxml version="1.9">',
    "  <resources>",
    `    <format id="r1" frameDuration="${frameDuration}" width="1920" height="1080"/>`,
    "  </resources>",
    "  <library>",
    '    <event name="Studio Flows review notes">',
    `      <project name="${xml(oneLine(o.title, 120))}">`,
    `        <sequence format="r1" duration="${fcpTime(dur, r)}" tcStart="${fcpTime(start, r)}" tcFormat="NDF">`,
    "          <spine>",
    `            <gap name="Review notes" offset="${fcpTime(start, r)}" start="${fcpTime(start, r)}" duration="${fcpTime(dur, r)}">`,
    ...markers,
    "            </gap>",
    "          </spine>",
    "        </sequence>",
    "      </project>",
    "    </event>",
    "  </library>",
    "</fcpxml>",
    "",
  ].join("\n");
}

function csvCell(s: string): string {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(notes: MarkerNote[], o: MarkerOptions): string {
  const r = o.rate;
  const start = startFrames(o.startHour, r);
  const rows = [["#", "Timecode in", "Timecode out", "Author", "From", "Visibility", "Status", "Comment", "Replies"]];
  for (const n of orderNotes(notes)) {
    const { at, len } = markerSpan(n, r);
    rows.push([
      n.number != null ? String(n.number) : "",
      frameTimecode(start + at, r),
      len > 1 ? frameTimecode(start + at + len, r) : "",
      n.author,
      n.isClient ? "Client" : "Studio",
      n.teamOnly ? "Team only" : "Shared",
      n.resolved ? "Resolved" : "Open",
      n.body,
      n.replies.map((x) => `${x.author}: ${x.body}`).join(" / "),
    ]);
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function buildMarkers(notes: MarkerNote[], o: MarkerOptions): string {
  switch (o.format) {
    case "premiere":
      return buildPremiereXml(notes, o);
    case "resolve":
      return buildResolveEdl(notes, o);
    case "fcp":
      return buildFcpxml(notes, o);
    case "csv":
      return buildCsv(notes, o);
  }
}

/** A file name that survives every OS: "Hero-cut_v3_markers.edl". */
export function markerFileName(title: string, format: MarkerFormat): string {
  const ext = MARKER_FORMATS.find((f) => f.key === format)?.ext ?? "txt";
  const stem =
    title
      .normalize("NFKD")
      .replace(/[^\w\s.-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || "review";
  return `${stem}_markers.${ext}`;
}

/** Resolve's own timelines start at 01:00:00:00; the others start at zero. */
export function defaultStartHour(format: MarkerFormat): 0 | 1 {
  return format === "resolve" ? 1 : 0;
}
