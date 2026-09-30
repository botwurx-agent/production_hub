"use client";

import type { ReactNode } from "react";
import { Art } from "./scenes-shotlist";
import { ActionLabel, Avatar, Burst, Chip, Cursor, Window, arrive, ramp, typed } from "./scene-kit";

/*
 * The AI video production page's chapter scenes (640x440, pure functions of
 * t). As shipped (CLAUDE.md, "AI PIPELINE"): elements carry the platform's
 * @handle and go into a prompt from chips above it, with one check (a handle
 * no element on the shot owns); links pasted from Higgsfield come in as
 * candidates with platform, aspect, resolution and duration read off the
 * file; a full-screen neutral triage driven by the keyboard; a curated set
 * sent to a reviewer for a pick on a no-login page; picked takes and a
 * voiceover per shot, a master cut reviewed by version, and a handoff to the
 * editor with paired filenames. Generation itself stays on the platforms.
 */

/** Stays dark in either theme, like the real triage view and review stage. */
const STAGE = "#0b0b0d";
const STAGE_2 = "#18181b";

function Btn({ children, tone = "quiet", on }: { children: ReactNode; tone?: "accent" | "quiet"; on?: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-[8px] px-2.5 py-1 text-[11px] font-extrabold"
      style={
        tone === "accent"
          ? { background: "var(--accent)", color: "white", transform: on ? "scale(.95)" : undefined, transition: "transform .15s" }
          : { border: "1px solid var(--border)", background: on ? "color-mix(in oklch, var(--accent) 10%, var(--surface))" : "var(--surface)", transition: "background .2s" }
      }
    >
      {children}
    </span>
  );
}

function Toast({ t, at, until, children, y = 392 }: { t: number; at: number; until: number; children: ReactNode; y?: number }) {
  if (t < at || t > until) return null;
  return (
    <div
      className="absolute left-1/2 z-20 flex items-center gap-2 whitespace-nowrap rounded-[10px] px-3 py-2 text-[11.5px] font-bold text-white"
      style={{ top: y, background: "var(--text)", ...arrive(t, at, 8), translate: "-50% 0" }}
    >
      {children}
    </div>
  );
}

/** A clip thumbnail: drawn art, a play mark and its length. */
function Clip({ i, len = "5s", className = "", style }: { i: number; len?: string; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`relative overflow-hidden rounded-[8px] ${className}`} style={style}>
      <Art i={i} />
      <span className="absolute bottom-1 right-1 rounded-[4px] px-1 text-[9px] font-extrabold text-white" style={{ background: "rgba(0,0,0,.55)" }}>
        {len}
      </span>
      <svg className="absolute left-1.5 top-1.5" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <circle cx="6" cy="6" r="6" fill="rgba(0,0,0,.45)" />
        <path d="M4.6 3.6 L8.6 6 L4.6 8.4 Z" fill="white" />
      </svg>
    </div>
  );
}

function Tick() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" aria-hidden="true">
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

/* -------------------------------------------------------------- ELEMENTS */

export const AI_ELEMENTS_MS = 13500;

const E_EL = [
  { h: "@maya", name: "Maya", kind: "Character", art: 3 },
  { h: "@bottle_hint", name: "Hint bottle", kind: "Prop", art: 1 },
  { h: "@cafe_paris", name: "Paris cafe", kind: "Location", art: 0 },
];
const E_TYPE1 = 1000;
const E_MAYA = 2600;
const E_TYPE2 = 3100;
const E_BOTTLE = 4300;
const E_TYPE3 = 4800;
const E_TYPO = 5100;
const E_WARN = 5900;
const E_FIX = 7600;

export function AiElementsScene({ t }: { t: number }) {
  const has = [t >= E_MAYA, t >= E_BOTTLE, t >= E_FIX];
  const typo = t >= E_TYPO && t < E_FIX;
  const warn = t >= E_WARN && t < E_FIX;
  const parts: ReactNode[] = [];
  parts.push(<span key="a">{typed("Close up of ", t, E_TYPE1, 45)}</span>);
  if (t >= E_MAYA) parts.push(<b key="m" style={{ color: "var(--h-purple)" }}>@maya</b>);
  if (t >= E_TYPE2) parts.push(<span key="b">{typed(" lifting ", t, E_TYPE2, 45)}</span>);
  if (t >= E_BOTTLE) parts.push(<b key="bt" style={{ color: "var(--h-purple)" }}>@bottle_hint</b>);
  if (t >= E_TYPE3) parts.push(<span key="c">{typed(" at ", t, E_TYPE3, 45)}</span>);
  if (typo) parts.push(<span key="ty" style={{ textDecoration: "underline wavy var(--h-red)" }}>{typed("@cafe", t, E_TYPO, 70)}</span>);
  if (t >= E_FIX) parts.push(<b key="cf" style={{ color: "var(--h-purple)", ...arrive(t, E_FIX, 2) }}>@cafe_paris</b>);
  if (t >= E_FIX + 400) parts.push(<span key="d">{typed(", morning light", t, E_FIX + 400, 45)}</span>);
  const caret = Math.floor(t / 450) % 2 === 0;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Shot 04 · Paris cafe" sub="AI pipeline · image stage" right={<Chip tone="purple" t={t}>Generated</Chip>}>
        <div className="absolute" style={{ left: 20, top: 68, right: 20 }}>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-text-faint">Elements on this shot</p>
          <div className="mt-1.5 flex gap-2">
            {E_EL.map((e, i) => (
              <div
                key={e.h}
                className="flex items-center gap-2 rounded-full border py-1 pl-1 pr-3"
                style={{
                  borderColor: has[i] ? "var(--h-purple)" : "var(--border)",
                  background: has[i] ? "color-mix(in oklch, var(--h-purple) 9%, var(--surface))" : "var(--surface)",
                  transition: "all .3s",
                }}
              >
                <span className="relative h-7 w-7 overflow-hidden rounded-full">
                  <Art i={e.art} />
                </span>
                <span>
                  <span className="block text-[11.5px] font-extrabold leading-tight">{e.h}</span>
                  <span className="block text-[9.5px] leading-tight text-text-faint">{e.kind}</span>
                </span>
                {has[i] ? (
                  <span className="grid h-4 w-4 place-items-center rounded-full text-white" style={{ background: "var(--h-purple)" }}>
                    <Tick />
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <p className="mt-4 text-[10px] font-extrabold uppercase tracking-[0.12em] text-text-faint">Prompt</p>
          <div className="mt-1.5 min-h-[76px] rounded-[10px] border px-3 py-2.5 text-[13px] leading-relaxed" style={{ borderColor: "var(--accent)" }}>
            {parts}
            <span className="ml-px inline-block h-[14px] w-[1.5px] translate-y-[2px]" style={{ background: caret ? "var(--text)" : "transparent" }} />
          </div>
          <div className="mt-2 h-[26px]">
            {warn ? (
              <p className="flex items-center gap-1.5 text-[11.5px] font-bold" style={{ color: "var(--h-red)", ...arrive(t, E_WARN, 4) }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--h-red)" }} />
                @cafe: no element on this shot has that handle
              </p>
            ) : null}
          </div>
          {/* Usage map */}
          <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-text-faint">Where each element is used</p>
          <div className="mt-1.5 rounded-[10px] border border-border px-3 py-2">
            <div className="flex text-[10px] font-bold text-text-faint">
              <span className="w-[130px]" />
              {["01", "02", "03", "04", "05", "06"].map((s) => (
                <span key={s} className="w-[56px] text-center" style={{ color: s === "04" ? "var(--accent)" : undefined }}>
                  Shot {s}
                </span>
              ))}
            </div>
            {E_EL.map((e, r) => (
              <div key={e.h} className="flex items-center py-1 text-[11.5px] font-semibold">
                <span className="w-[130px]">{e.name}</span>
                {[0, 1, 2, 3, 4, 5].map((c) => {
                  const base = [[0, 1, 4], [1, 2, 5], [0, 2]][r].includes(c);
                  const now = c === 3 && has[r];
                  return (
                    <span key={c} className="grid w-[56px] place-items-center">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          background: base || now ? "var(--h-purple)" : "var(--surface-2)",
                          transform: now ? `scale(${0.6 + 0.4 * ramp(t, [E_MAYA, E_BOTTLE, E_FIX][r], 300)})` : undefined,
                        }}
                      />
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <Burst t={t} at={E_FIX} x={420} y={100} />
      </Window>
      <ActionLabel t={t} at={E_MAYA} x={70} y={96} text="Click to drop in the @handle" before={700} after={900} />
      <ActionLabel t={t} at={E_WARN} x={330} y={194} text="A handle Higgsfield won't know" tone="red" before={100} after={1500} />
      <ActionLabel t={t} at={E_FIX} x={470} y={96} text="Fixed with one click" tone="green" after={1000} />
      <Cursor
        t={t}
        travel={700}
        path={[
          { t: 500, x: 300, y: 420 },
          { t: E_MAYA, x: 70, y: 96, click: true },
          { t: E_BOTTLE, x: 230, y: 96, click: true },
          { t: E_FIX, x: 440, y: 96, click: true },
          { t: E_FIX + 1400, x: 580, y: 420 },
        ]}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- IMPORT */

export const AI_IMPORT_MS = 13000;

const M_LINKS = ["higgsfield.ai/share/7f2c1a", "higgsfield.ai/share/7f2c1b", "higgsfield.ai/share/7f2c1c"];
const M_TYPE = [1200, 2100, 3000];
const M_GO = 4300;
const M_IN = [5000, 5700, 6400];
const M_OPEN = 8200;

export function AiImportScene({ t }: { t: number }) {
  const modal = t >= 600 && t < M_GO + 300;
  const open = t >= M_OPEN;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Shot 04 · Paris cafe" sub="Video stage · candidates" right={<Btn on={t >= 400 && t < 700}>Import from Higgsfield</Btn>}>
        <div className="absolute grid grid-cols-3 gap-3" style={{ left: 16, top: 70, width: open ? 380 : 608, transition: "width .4s" }}>
          {[0, 1, 2].map((i) =>
            t >= M_IN[i] ? (
              <div
                key={i}
                className="overflow-hidden rounded-[10px] border bg-surface"
                style={{ borderColor: open && i === 1 ? "var(--accent)" : "var(--border)", ...arrive(t, M_IN[i], 8) }}
              >
                {t < M_IN[i] + 700 ? (
                  <div className="grid aspect-video place-items-center bg-surface-2 text-[10px] font-bold text-text-faint">Fetching…</div>
                ) : (
                  <Clip i={[2, 5, 6][i]} className="aspect-video" />
                )}
                <div className="flex flex-wrap gap-1 p-1.5">
                  {t >= M_IN[i] + 700
                    ? ["Higgsfield", "16:9", "1080p", "5s"].map((c, k) => (
                        <span key={c} className="rounded-[4px] bg-surface-2 px-1 text-[9.5px] font-bold text-text-muted" style={arrive(t, M_IN[i] + 700 + k * 120, 3)}>
                          {c}
                        </span>
                      ))
                    : null}
                </div>
              </div>
            ) : (
              <div key={i} className="grid h-[118px] place-items-center rounded-[10px] border border-dashed border-border text-[11px] text-text-faint">
                {i === 0 ? "No candidates yet" : ""}
              </div>
            ),
          )}
        </div>
        {open ? (
          <div className="absolute rounded-[12px] border border-border p-3" style={{ left: 410, top: 70, width: 214, ...arrive(t, M_OPEN, 8) }}>
            <p className="text-[12px] font-extrabold">Provenance</p>
            <p className="text-[10px] text-text-faint">Filled in from the link</p>
            <div className="mt-2 space-y-1.5 text-[11px]">
              {[
                ["Platform", "Higgsfield"],
                ["Aspect", "16:9"],
                ["Resolution", "1080p"],
                ["Duration", "5.0s"],
                ["Prompt", "Close up of @maya lifting…"],
                ["Source", "higgsfield.ai/share/7f2c1b"],
              ].map(([k, v], i) => (
                <div key={k} className="flex gap-2" style={arrive(t, M_OPEN + 250 + i * 180, 3)}>
                  <span className="w-[62px] shrink-0 text-text-faint">{k}</span>
                  <span className="truncate font-semibold">{v}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {modal ? (
          <div className="absolute inset-0 z-10 grid place-items-center" style={{ background: "color-mix(in oklch, var(--text) 18%, transparent)", opacity: ramp(t, 600, 200) }}>
            <div className="w-[400px] rounded-[14px] border border-border bg-surface p-4 shadow-[0_30px_60px_-20px_rgba(40,30,90,.5)]" style={arrive(t, 600, 10)}>
              <p className="text-[13px] font-extrabold">Import from Higgsfield</p>
              <p className="text-[10.5px] text-text-faint">Paste share links or file links, one per line</p>
              <div className="mt-2 h-[92px] rounded-[8px] border px-2.5 py-2 font-mono text-[11px] leading-[1.6]" style={{ borderColor: "var(--accent)" }}>
                {M_LINKS.map((l, i) => (t >= M_TYPE[i] ? <div key={l}>{typed(l, t, M_TYPE[i], 22)}</div> : null))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10.5px] text-text-faint">{t >= M_TYPE[2] ? "3 links" : ""}</span>
                <Btn tone="accent" on={t >= M_GO - 150}>Import 3 clips</Btn>
              </div>
            </div>
          </div>
        ) : null}
        <Toast t={t} at={M_IN[2] + 900} until={M_IN[2] + 2400}>3 clips imported as candidates</Toast>
      </Window>
      <ActionLabel t={t} at={M_TYPE[0]} x={120} y={150} text="Paste the links from Higgsfield" before={400} after={2200} />
      <ActionLabel t={t} at={M_IN[0] + 900} x={40} y={196} text="Pulled in and stored" tone="green" before={100} after={1600} />
      <ActionLabel t={t} at={M_OPEN} x={300} y={120} text="Provenance read off the file" tone="purple" before={500} after={1600} />
      <Cursor
        t={t}
        travel={700}
        path={[
          { t: 200, x: 520, y: 90 },
          { t: 450, x: 552, y: 30, click: true },
          { t: M_TYPE[0] - 200, x: 250, y: 190, click: true },
          { t: M_GO, x: 450, y: 312, click: true },
          { t: M_OPEN, x: 200, y: 130, click: true },
          { t: M_OPEN + 1600, x: 300, y: 420 },
        ]}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- TRIAGE */

export const AI_TRIAGE_MS = 14000;

const T_CLIPS = [2, 5, 6, 3, 7, 1, 4, 0];
const T_KEYS = [
  { t: 1600, k: "X", label: "Reject", i: 0, tone: "red" },
  { t: 2900, k: "X", label: "Reject", i: 1, tone: "red" },
  { t: 4200, k: "S", label: "Star", i: 2, tone: "amber" },
  { t: 5500, k: "→", label: "Next", i: 2, tone: "muted" },
  { t: 6800, k: "S", label: "Star", i: 3, tone: "amber" },
  { t: 8100, k: "C", label: "Compare", i: 3, tone: "blue" },
  { t: 10300, k: "↵", label: "Pick the take", i: 3, tone: "green" },
] as const;

export function AiTriageScene({ t }: { t: number }) {
  const done = T_KEYS.filter((k) => t >= k.t);
  let focus = 0;
  const rejected = new Set<number>();
  const starred = new Set<number>();
  for (const k of done) {
    if (k.label === "Reject") {
      rejected.add(k.i);
      focus = k.i + 1;
    } else if (k.label === "Star") {
      starred.add(k.i);
      focus = k.i;
    } else if (k.label === "Next") focus = k.i + 1;
  }
  const compare = t >= 8100 + 300;
  const picked = t >= 10300;
  const last = done[done.length - 1];
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <div className="absolute inset-0 overflow-hidden rounded-[20px] text-white shadow-[0_30px_80px_-30px_rgba(40,30,90,.45)]" style={{ background: STAGE }}>
        <div className="flex h-[48px] items-center gap-3 px-4" style={{ borderBottom: `1px solid ${STAGE_2}` }}>
          <p className="font-display text-[14px] font-extrabold">Triage · Shot 04</p>
          <div className="ml-auto flex gap-1.5 text-[10.5px] font-bold">
            {[
              ["All", 8],
              ["Kept", 8 - rejected.size],
              ["Starred", starred.size],
              ["Rejected", rejected.size],
            ].map(([k, v], i) => (
              <span key={k as string} className="rounded-full px-2 py-0.5" style={{ background: i === 0 ? "rgba(255,255,255,.14)" : STAGE_2 }}>
                {k as string} {v as number}
              </span>
            ))}
          </div>
        </div>
        {/* Stage */}
        <div className="absolute" style={{ left: 20, top: 64, width: 600, height: 262 }}>
          {compare ? (
            <div className="grid h-full grid-cols-2 gap-3" style={{ opacity: ramp(t, 8400, 250) }}>
              {[2, 3].map((i) => (
                <div key={i} className="relative">
                  <Clip i={T_CLIPS[i]} className="h-[220px] w-full" len="6s" />
                  <div className="mt-2 flex items-center gap-2 text-[11px] font-bold">
                    <span>Candidate {i + 1}</span>
                    <span style={{ color: "#fbbf24" }}>★</span>
                    {picked && i === 3 ? (
                      <span className="rounded-[5px] px-1.5 py-0.5 text-[10px] font-extrabold text-black" style={{ background: "var(--h-green)", ...arrive(t, 10300, 4) }}>
                        Take
                      </span>
                    ) : null}
                  </div>
                  {picked && i === 3 ? <div className="absolute inset-x-0 top-0 h-[220px] rounded-[8px]" style={{ boxShadow: "inset 0 0 0 3px var(--h-green)" }} /> : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="relative h-full">
              <Clip key={focus} i={T_CLIPS[focus]} className="h-[236px] w-[420px]" len="6s" style={{ opacity: ramp(t, last ? last.t : 0, 220) }} />
              <div className="absolute right-0 top-0 w-[150px] space-y-1 text-[10.5px]" style={{ color: "rgba(255,255,255,.7)" }}>
                <p className="font-extrabold text-white">Candidate {focus + 1}</p>
                <p>Kling 2.1 · seed 44{12 + focus}</p>
                <p>16:9 · 1080p</p>
                {starred.has(focus) ? <p style={{ color: "#fbbf24" }}>★ Starred</p> : null}
              </div>
            </div>
          )}
        </div>
        {/* Filmstrip */}
        <div className="absolute flex gap-2" style={{ left: 20, top: 332 }}>
          {T_CLIPS.map((c, i) => (
            <div key={i} className="relative" style={{ opacity: rejected.has(i) ? 0.3 : 1, transition: "opacity .3s" }}>
              <Clip
                i={c}
                className="h-[42px] w-[68px]"
                len=""
                style={{ boxShadow: i === focus || (compare && (i === 2 || i === 3)) ? "0 0 0 2px white" : undefined }}
              />
              {starred.has(i) ? (
                <span className="absolute -right-1 -top-1 text-[12px]" style={{ color: "#fbbf24" }}>
                  ★
                </span>
              ) : null}
              {picked && i === 3 ? <span className="absolute inset-x-0 -bottom-1.5 mx-auto h-1 w-8 rounded-full" style={{ background: "var(--h-green)" }} /> : null}
            </div>
          ))}
        </div>
        {/* Key hints */}
        <p className="absolute text-[10px]" style={{ left: 20, bottom: 12, color: "rgba(255,255,255,.5)" }}>
          ← → move · X reject · S star · 1/2 start/end · ↵ pick take · C compare
        </p>
        {/* The key just pressed */}
        {last && t < last.t + 1000 ? (
          <div className="absolute flex items-center gap-2 rounded-[12px] px-3 py-2" style={{ right: 16, bottom: 8, background: STAGE_2, ...arrive(t, last.t, 8) }}>
            <span className="grid h-8 min-w-8 place-items-center rounded-[7px] px-2 text-[14px] font-extrabold text-black" style={{ background: "white", boxShadow: "0 3px 0 rgba(255,255,255,.35)" }}>
              {last.k}
            </span>
            <span className="text-[12px] font-extrabold" style={{ color: last.tone === "muted" ? "white" : `var(--h-${last.tone})` }}>
              {last.label}
            </span>
          </div>
        ) : null}
        <Burst t={t} at={10300} x={470} y={170} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ PICK */

export const AI_PICK_MS = 15000;

const P_TICK = [900, 1500, 2100, 2700];
const P_CREATE = 4000;
const P_SWITCH = 5600;
const P_STAR = 7000;
const P_OPT = 8200;
const P_NOTE = 8900;
const P_PICK = 10600;
const P_BACK = 12200;

export function AiPickScene({ t }: { t: number }) {
  const reviewer = t >= P_SWITCH && t < P_BACK;
  const back = t >= P_BACK;
  const focus = t >= P_OPT ? 2 : t >= P_STAR - 900 ? 1 : 0;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window
        title={reviewer ? "studio-flows.com/rb/… · Hero pour, options" : "Shot 04 · Send for a pick"}
        sub={reviewer ? "Maya at Bright Water · no login" : "Choose which candidates they see"}
        right={reviewer ? <Chip tone="pink" t={t} since={P_SWITCH}>Reviewer</Chip> : back ? <Chip tone="green" t={t} since={P_BACK}>1 pick in</Chip> : undefined}
      >
        {!reviewer && !back ? (
          <div className="absolute" style={{ left: 20, top: 70, right: 20 }}>
            <div className="grid grid-cols-4 gap-3">
              {[2, 5, 6, 3, 7, 1, 4, 0].map((c, i) => {
                const on = i < 4 && t >= P_TICK[i];
                return (
                  <div key={i} className="relative" style={{ opacity: i >= 4 ? 0.55 : 1 }}>
                    <Clip i={c} className="aspect-video w-full" style={{ boxShadow: on ? "0 0 0 2.5px var(--accent)" : undefined }} />
                    <span
                      className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-[4px] text-white"
                      style={{ background: on ? "var(--accent)" : "rgba(255,255,255,.85)", border: on ? undefined : "1px solid var(--border)" }}
                    >
                      {on ? <Tick /> : null}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-[30px] flex-1 items-center rounded-[8px] border border-border px-2 text-[12px] font-semibold">
                {typed("Hero pour, options", t, P_TICK[3] + 400, 40)}
              </div>
              <Btn tone="accent" on={t >= P_CREATE - 150}>{t >= P_TICK[3] ? "Share 4 options" : "Share options"}</Btn>
            </div>
            {t >= P_CREATE ? (
              <div className="mt-3 flex items-center gap-2 rounded-[10px] px-3 py-2 text-[11.5px] font-bold" style={{ background: "var(--h-green-bg)", color: "var(--h-green)", ...arrive(t, P_CREATE, 4) }}>
                <Tick /> Link copied · studio-flows.com/rb/4kq…
              </div>
            ) : null}
          </div>
        ) : null}
        {reviewer ? (
          <div className="absolute" style={{ left: 20, top: 66, right: 20, opacity: ramp(t, P_SWITCH, 300) }}>
            <div className="flex gap-3">
              <div className="flex-1">
                <Clip key={focus} i={[2, 5, 6, 3][focus]} className="h-[196px] w-full" len="6s" />
                <div className="mt-2 flex gap-2">
                  {[2, 5, 6, 3].map((c, i) => (
                    <div key={i} className="relative">
                      <Clip i={c} className="h-[40px] w-[70px]" len="" style={{ boxShadow: i === focus ? "0 0 0 2px var(--accent)" : undefined }} />
                      <span className="absolute -bottom-4 left-0 text-[9.5px] font-bold text-text-faint">Option {i + 1}</span>
                      {i === 1 && t >= P_STAR ? <span className="absolute -right-1 -top-1.5 text-[12px]" style={{ color: "var(--h-amber)" }}>★</span> : null}
                      {i === 2 && t >= P_PICK ? (
                        <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full text-white" style={{ background: "var(--h-green)" }}>
                          <Tick />
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-[190px] space-y-2">
                <p className="text-[12px] font-extrabold">Option {focus + 1}</p>
                <div className="flex gap-1.5">
                  <Btn on={t >= P_STAR && t < P_OPT}>★ Star</Btn>
                  <Btn tone={t >= P_PICK ? "accent" : "quiet"} on={t >= P_PICK - 150 && t < P_PICK + 200}>
                    {t >= P_PICK ? "✓ My pick" : "This is my pick"}
                  </Btn>
                </div>
                {t >= P_NOTE ? (
                  <div className="rounded-[10px] border border-border p-2 text-[11px]" style={arrive(t, P_NOTE, 4)}>
                    <span className="rounded-[4px] px-1 text-[10px] font-extrabold" style={{ background: "var(--h-blue-bg)", color: "var(--h-blue)" }}>
                      0:03
                    </span>{" "}
                    {typed("Love the splash here.", t, P_NOTE + 200, 45)}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        {back ? (
          <div className="absolute" style={{ left: 20, top: 70, right: 20, ...arrive(t, P_BACK, 8) }}>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-text-faint">Hero pour, options · results</p>
            <div className="mt-2 flex items-center gap-3 rounded-[12px] border border-border p-3">
              <Avatar name="Maya Chen" hue="pink" size={30} />
              <div className="flex-1">
                <p className="text-[12.5px] font-extrabold">Maya picked Option 3</p>
                <p className="text-[11px] text-text-faint">Starred Option 2 · 1 note at 0:03</p>
              </div>
              <Clip i={6} className="h-[48px] w-[84px]" len="" style={{ boxShadow: "0 0 0 2px var(--h-green)" }} />
            </div>
            <p className="mt-3 text-[11.5px] text-text-muted">Their pick stays theirs: your candidates, stars and take are unchanged until you decide.</p>
          </div>
        ) : null}
        <Burst t={t} at={P_PICK} x={520} y={110} />
      </Window>
      <ActionLabel t={t} at={P_TICK[0]} x={140} y={80} text="Choose what they see" before={400} after={2300} />
      <ActionLabel t={t} at={P_STAR} x={470} y={100} text="They star a favourite" tone="amber" before={700} after={800} />
      <ActionLabel t={t} at={P_NOTE} x={330} y={140} text="Note a moment" tone="blue" before={200} after={1200} />
      <ActionLabel t={t} at={P_PICK} x={560} y={100} text="And make their pick" tone="green" after={900} />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 300, x: 320, y: 420 },
          ...P_TICK.map((at, i) => ({ t: at, x: 155 + i * 152, y: 84, click: true })),
          { t: P_CREATE, x: 560, y: 196, click: true },
          { t: P_STAR - 900, x: 133, y: 290, click: true },
          { t: P_STAR, x: 455, y: 102, click: true },
          { t: P_OPT, x: 211, y: 290, click: true },
          { t: P_PICK, x: 540, y: 104, click: true },
          { t: P_BACK + 800, x: 580, y: 420 },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------- CUT */

export const AI_CUT_MS = 15000;

const C_SHOTS = ["Paris cafe", "The pour", "Hero bottle", "Street", "End card"];
const C_FILL = [600, 1100, 1600, 2100, 2600];
const C_VO = [3200, 3600, 4000, 4400, 4800];
const C_REVIEW = 5800;
const C_NOTES = [6600, 7300];
const C_V2 = 8600;
const C_APPROVE = 9800;
const C_HAND = 11200;

export function AiCutScene({ t }: { t: number }) {
  const v2 = t >= C_V2;
  const hand = t >= C_HAND;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Sequence · Bright Water AI spot" sub="Picked takes, voiceover and the master cut" right={hand ? <Chip tone="green" t={t} since={C_HAND}>Handoff link ready</Chip> : undefined}>
        {/* Sequence strip */}
        <div className="absolute flex gap-2.5" style={{ left: 16, top: 66 }}>
          {C_SHOTS.map((s, i) => (
            <div key={s} className="w-[113px]">
              <p className="mb-1 text-[10px] font-bold text-text-faint">
                {String(i + 1).padStart(2, "0")} · {s}
              </p>
              {t >= C_FILL[i] ? <Clip i={[0, 2, 1, 4, 5][i]} className="aspect-video w-full" style={arrive(t, C_FILL[i], 6)} /> : <div className="aspect-video w-full rounded-[8px] border border-dashed border-border" />}
              <div className="mt-1.5 flex h-[18px] items-center gap-[2px] rounded-[5px] px-1.5" style={{ background: t >= C_VO[i] ? "var(--h-pink-bg)" : "var(--surface-2)" }}>
                {t >= C_VO[i]
                  ? Array.from({ length: 22 }).map((_, k) => (
                      <span key={k} className="w-[2px] rounded-full" style={{ height: 3 + ((k * 7 + i * 5) % 11), background: "var(--h-pink)", opacity: ramp(t, C_VO[i] + k * 12, 120) }} />
                    ))
                  : null}
              </div>
            </div>
          ))}
        </div>
        {/* Master cut */}
        <div className="absolute rounded-[12px] border border-border p-3" style={{ left: 16, right: 16, top: 190 }}>
          <div className="flex items-center gap-2">
            <p className="text-[12.5px] font-extrabold">Master cut</p>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-bold">{v2 ? "v2 · latest" : "v1"}</span>
            <span className="ml-auto">
              {t >= C_APPROVE ? <Chip tone="green" t={t} since={C_APPROVE}>Approved</Chip> : t >= C_NOTES[0] ? <Chip tone="amber" t={t} since={C_NOTES[0]}>Changes requested</Chip> : <Chip tone="muted" t={t}>In review</Chip>}
            </span>
          </div>
          {/* Timeline */}
          <div className="relative mt-3 h-[34px] rounded-[7px]" style={{ background: STAGE_2 }}>
            <span className="absolute inset-y-0 left-0 rounded-[7px]" style={{ width: `${(t >= C_REVIEW ? ramp(t, C_REVIEW, 2400) : 0) * 100}%`, background: "rgba(255,255,255,.12)" }} />
            {!v2
              ? [
                  { at: C_NOTES[0], x: 32, n: 1 },
                  { at: C_NOTES[1], x: 64, n: 2 },
                ].map((m) =>
                  t >= m.at ? (
                    <span key={m.n} className="absolute top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-[10px] font-extrabold text-white" style={{ left: `${m.x}%`, background: "var(--h-amber)", ...arrive(t, m.at, 0) }}>
                      {m.n}
                    </span>
                  ) : null,
                )
              : null}
          </div>
          <div className="mt-2 h-[36px] space-y-1 text-[11px]">
            {!v2 && t >= C_NOTES[0] ? (
              <p style={arrive(t, C_NOTES[0], 3)}>
                <b>0:07</b> Hold on the pour a beat longer.
              </p>
            ) : null}
            {!v2 && t >= C_NOTES[1] ? (
              <p style={arrive(t, C_NOTES[1], 3)}>
                <b>0:14</b> Swap the street shot for take 2.
              </p>
            ) : null}
            {v2 ? (
              <p className="text-text-muted" style={arrive(t, C_V2, 3)}>
                v2 uploaded from the edit. v1 and its notes stay in the history.
              </p>
            ) : null}
          </div>
        </div>
        {/* Handoff */}
        {hand ? (
          <div className="absolute rounded-[12px] border border-border p-3" style={{ left: 16, right: 16, top: 330, ...arrive(t, C_HAND, 8) }}>
            <p className="text-[11px] font-extrabold">Editor handoff · picked takes with their voiceover</p>
            <div className="mt-1.5 grid grid-cols-3 gap-x-4 gap-y-1 font-mono text-[10.5px] text-text-muted">
              {["01_Paris-Cafe.mp4", "01_Paris-Cafe.mp3", "02_The-Pour.mp4", "02_The-Pour.mp3", "03_Hero-Bottle.mp4", "03_Hero-Bottle.mp3"].map((f, i) => (
                <span key={f} style={arrive(t, C_HAND + 200 + i * 150, 3)}>
                  {f}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <Burst t={t} at={C_APPROVE} x={560} y={206} />
      </Window>
      <ActionLabel t={t} at={C_FILL[0]} x={60} y={70} text="Each shot's picked take" before={200} after={2000} />
      <ActionLabel t={t} at={C_VO[0]} x={60} y={140} text="Voiceover lives with its clip" tone="pink" before={200} after={1800} />
      <ActionLabel t={t} at={C_NOTES[0]} x={200} y={226} text="Notes on the cut, by timecode" tone="amber" before={300} after={1400} />
      <ActionLabel t={t} at={C_HAND} x={60} y={318} text="The editor gets matching pairs" tone="green" before={300} after={1800} />
      <Cursor
        t={t}
        travel={700}
        path={[
          { t: 4600, x: 320, y: 420 },
          { t: C_REVIEW, x: 120, y: 244, click: true },
          { t: C_V2, x: 110, y: 204, click: true },
          { t: C_HAND, x: 560, y: 420, click: true },
        ]}
      />
    </div>
  );
}
