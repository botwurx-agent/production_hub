"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ANALOG_ACTIONS, BUTTON_ACTIONS, SPEEDS, bindAnalog, bindButton, bindingName, buttonName, defaultConfig, driving, hear, isDown,
  jog, nextSpeed, parseConfig, pressed, readAnalog, readDrive,
  type AnalogAction, type ButtonAction, type JogPose, type PadConfig, type PadState,
} from "@/lib/blocking/gamepad";
import { Btn, Seg } from "./ui";

/**
 * A game controller as the camera's hand controller (lib/blocking/gamepad.ts
 * holds the rules). The sticks jog the camera to a framing that is NOT yet
 * in the keyframes; a button stores it at the playhead. The studio calls
 * `frame` once per drawn frame, which reads the pad, fires button presses
 * and returns the framing being jogged, if any.
 */

const STORE = "blocking.controller";
const REPEAT_AFTER = 0.35;
const REPEAT_EVERY = 0.08;

type PadInfo = { id: string; standard: boolean };

function readPad(): { pad: Gamepad; state: PadState } | null {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return null;
  let pads: (Gamepad | null)[] = [];
  try { pads = Array.from(navigator.getGamepads()); } catch { return null; }
  const pad = pads.find((p) => p && p.connected);
  if (!pad) return null;
  return { pad, state: { axes: Array.from(pad.axes), buttons: pad.buttons.map((b) => b.value) } };
}

/** A pad's name without the vendor and product numbers browsers append. */
const tidyName = (id: string) => id.replace(/\s*\((STANDARD GAMEPAD\s*)?Vendor:.*?\)\s*/i, "").replace(/^[0-9a-f]{4}-[0-9a-f]{4}-/i, "").trim() || "Controller";

export function useController(handlers: {
  /** A button whose action the studio carries out. */
  press: (action: Exclude<ButtonAction, "speed" | "level" | "discard">) => void;
  /** The framing was dropped (the discard button). */
  discarded: () => void;
  say: (message: string) => void;
}) {
  const [cfg, setCfg] = useState<PadConfig>(defaultConfig);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const [info, setInfo] = useState<PadInfo | null>(null);
  const [jogging, setJogging] = useState(false);
  const jogRef = useRef<JogPose | null>(null);
  const prev = useRef<PadState | null>(null);
  const held = useRef<Partial<Record<ButtonAction, { since: number; last: number }>>>({});
  /** True while the mapping window is open: presses there must not act. */
  const suspended = useRef(false);
  const h = useRef(handlers);
  h.current = handlers;

  useEffect(() => {
    try { setCfg(parseConfig(JSON.parse(localStorage.getItem(STORE) ?? "null"))); } catch {}
    const look = () => {
      const r = readPad();
      setInfo((cur) => {
        const next = r ? { id: tidyName(r.pad.id), standard: r.pad.mapping === "standard" } : null;
        return cur?.id === next?.id && cur?.standard === next?.standard ? cur : next;
      });
    };
    look();
    window.addEventListener("gamepadconnected", look);
    window.addEventListener("gamepaddisconnected", look);
    // Some browsers only list a pad after a press and fire no event for it.
    const id = setInterval(look, 1500);
    return () => { window.removeEventListener("gamepadconnected", look); window.removeEventListener("gamepaddisconnected", look); clearInterval(id); };
  }, []);

  const save = useCallback((next: PadConfig) => {
    setCfg(next);
    cfgRef.current = next;
    try { localStorage.setItem(STORE, JSON.stringify(next)); } catch {}
  }, []);

  const clearJog = useCallback(() => {
    if (!jogRef.current) return;
    jogRef.current = null;
    setJogging(false);
  }, []);

  const buzz = useCallback(() => {
    if (!cfgRef.current.settings.rumble) return;
    const r = readPad();
    const act = (r?.pad as unknown as { vibrationActuator?: { playEffect?: (t: string, o: object) => Promise<unknown> } } | undefined)?.vibrationActuator;
    try { act?.playEffect?.("dual-rumble", { duration: 70, strongMagnitude: 0.35, weakMagnitude: 0.7 })?.catch(() => {}); } catch {}
  }, []);

  /**
   * Once per drawn frame. `base` is where the camera is shown now, which is
   * where jogging starts from. `canDrive` is false while the shot plays, is
   * being exported, or something else (the phone) has the camera.
   */
  const frame = useCallback((dt: number, base: () => JogPose, canDrive: boolean): JogPose | null => {
    const r = readPad();
    if (!r) { prev.current = null; return canDrive ? jogRef.current : null; }
    const now = r.state;
    if (suspended.current) { prev.current = now; return canDrive ? jogRef.current : null; }
    const c = cfgRef.current;
    const t = performance.now() / 1000;
    const down = pressed(prev.current, now);
    prev.current = now;
    for (const a of BUTTON_ACTIONS) {
      const i = c.map.buttons[a.id];
      if (i === null) continue;
      let fire = down.includes(i);
      if ("repeat" in a && a.repeat) {
        if (fire) held.current[a.id] = { since: t, last: t };
        else if (isDown(now, i)) {
          const hd = held.current[a.id];
          if (hd && t - hd.since > REPEAT_AFTER && t - hd.last > REPEAT_EVERY) { hd.last = t; fire = true; }
        } else delete held.current[a.id];
      }
      if (!fire) continue;
      if (a.id === "speed") {
        const speed = nextSpeed(c.settings.speed);
        save({ ...c, settings: { ...c.settings, speed } });
        h.current.say(`Controller speed: ${SPEEDS.find((s) => s.id === speed)?.name}`);
      } else if (a.id === "level") {
        if (canDrive) {
          const b = jogRef.current ?? base();
          jogRef.current = { ...b, r: [b.r[0], 0, 0] };
          setJogging(true);
        }
      } else if (a.id === "discard") {
        if (jogRef.current) { clearJog(); h.current.discarded(); }
      } else h.current.press(a.id);
    }
    if (!canDrive) return null;
    const d = readDrive(now, cfgRef.current);
    if (driving(d)) {
      if (!jogRef.current) setJogging(true);
      jogRef.current = jog(jogRef.current ?? base(), d, dt, cfgRef.current.settings.speed);
    }
    return jogRef.current;
  }, [save, clearJog]);

  return { cfg, save, info, jogging, jogRef, clearJog, frame, buzz, suspended };
}

export type Controller = ReturnType<typeof useController>;

/* ---------- the panel under the toolbar button ---------- */

const DEAD: { id: string; name: string; v: number }[] = [
  { id: "small", name: "Small", v: 0.08 },
  { id: "normal", name: "Normal", v: 0.15 },
  { id: "large", name: "Large", v: 0.25 },
];

export function ControllerPanel({ ctrl, onCustomize }: { ctrl: Controller; onCustomize: () => void }) {
  const { cfg, info } = ctrl;
  const std = info?.standard ?? true;
  const set = (patch: Partial<PadConfig["settings"]>) => ctrl.save({ ...cfg, settings: { ...cfg.settings, ...patch } });
  const dead = DEAD.reduce((a, b) => (Math.abs(b.v - cfg.settings.deadZone) < Math.abs(a.v - cfg.settings.deadZone) ? b : a)).id;
  const line = (label: string, value: string) => (
    <div key={label} className="flex items-baseline justify-between gap-3 py-[3px] text-[11.5px]">
      <span className="text-text-muted">{label}</span>
      <span className="text-right font-semibold text-text">{value}</span>
    </div>
  );
  const b = (a: ButtonAction) => { const i = cfg.map.buttons[a]; return i === null ? "Not set" : buttonName(i, std); };
  return (
    <div className="absolute right-0 top-9 z-30 w-[310px] rounded-[10px] border border-border bg-surface p-3 shadow-2xl">
      <p className="text-[12px] font-semibold text-text">A controller as the camera</p>
      <p className="mt-2 flex items-center gap-2 text-[11.5px] text-text">
        <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: `var(--h-${info ? "green" : "amber"})` }} />
        {info ? info.id : "Plug in or pair a controller, then press any button on it"}
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
        The sticks move the camera to a framing. Nothing is saved until you set a keyframe; move the playhead, frame again, set another.
      </p>
      <div className="mt-3 border-t border-border pt-2">
        {line("Move", bindingName(cfg.map.analog.truck, std).replace(", left and right", ""))}
        {line("Aim", bindingName(cfg.map.analog.pan, std).replace(", left and right", ""))}
        {line("Boom down / up", bindingName(cfg.map.analog.boom, std))}
        {line("Zoom out / in", bindingName(cfg.map.analog.zoom, std))}
        {line("Set a keyframe", b("key"))}
        {line("Discard the framing", b("discard"))}
        {line("Play / pause", b("play"))}
      </div>
      <div className="mt-3 space-y-2 border-t border-border pt-3">
        <div>
          <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-text-faint">Speed</p>
          <Seg value={cfg.settings.speed} options={SPEEDS.map((s) => ({ id: s.id, name: s.name }))} onChange={(speed) => set({ speed })} />
        </div>
        <div>
          <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-text-faint">Dead zone (raise it if the camera drifts)</p>
          <Seg value={dead} options={DEAD.map((d) => ({ id: d.id, name: d.name }))} onChange={(id) => set({ deadZone: DEAD.find((d) => d.id === id)!.v })} />
        </div>
        <label className="flex items-center gap-2 text-[11.5px] text-text">
          <input type="checkbox" checked={cfg.settings.invertTilt} onChange={(e) => set({ invertTilt: e.target.checked })} />
          Invert tilt (stick up tilts down)
        </label>
        <label className="flex items-center gap-2 text-[11.5px] text-text">
          <input type="checkbox" checked={cfg.settings.rumble} onChange={(e) => set({ rumble: e.target.checked })} />
          Buzz when a keyframe is set
        </label>
      </div>
      <button type="button" onClick={onCustomize} className="mt-3 w-full rounded-[7px] border border-border px-2 py-1.5 text-[11.5px] font-semibold text-text hover:bg-surface-2">
        Customize the controls…
      </button>
    </div>
  );
}

/* ---------- the mapping window ---------- */

type Listen =
  | { type: "analog"; action: AnalogAction; step: "pos" | "neg"; pos?: number; rest: PadState }
  | { type: "button"; action: ButtonAction; rest: PadState };

export function ControllerMapWindow({ ctrl, onClose }: { ctrl: Controller; onClose: () => void }) {
  const { cfg, info } = ctrl;
  const std = info?.standard ?? true;
  const [listen, setListen] = useState<Listen | null>(null);
  const listenRef = useRef(listen);
  listenRef.current = listen;
  const [active, setActive] = useState<string>("");
  const [msg, setMsg] = useState<string | null>(null);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  // While this window is open the controller does nothing in the scene, so
  // a control can be pressed here to test or assign it.
  useEffect(() => {
    ctrl.suspended.current = true;
    return () => { ctrl.suspended.current = false; };
  }, [ctrl]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const r = readPad();
      if (!r) return;
      const c = cfgRef.current;
      const L = listenRef.current;
      if (L) {
        const got = hear(L.rest, r.state);
        if (!got) return;
        if (L.type === "button") {
          if (got.kind !== "button") return;
          const res = bindButton(c.map, L.action, got.index);
          ctrl.save({ ...c, map: res.map });
          setMsg(res.freed.length ? `${res.freed.join(" and ")} no longer ${res.freed.length > 1 ? "have" : "has"} a control.` : null);
          setListen(null);
        } else if (L.step === "pos") {
          if (got.kind === "axis") {
            const res = bindAnalog(c.map, L.action, { kind: "axis", index: got.index, invert: got.invert });
            ctrl.save({ ...c, map: res.map });
            setMsg(res.freed.length ? `${res.freed.join(" and ")} no longer ${res.freed.length > 1 ? "have" : "has"} a control.` : null);
            setListen(null);
          } else setListen({ ...L, step: "neg", pos: got.index, rest: r.state });
        } else if (got.kind === "button" && got.index !== L.pos) {
          const res = bindAnalog(c.map, L.action, { kind: "buttons", neg: got.index, pos: L.pos! });
          ctrl.save({ ...c, map: res.map });
          setMsg(res.freed.length ? `${res.freed.join(" and ")} no longer ${res.freed.length > 1 ? "have" : "has"} a control.` : null);
          setListen(null);
        }
        return;
      }
      // Light up whatever is being pressed, so a layout can be checked by feel.
      const on: string[] = [];
      for (const a of ANALOG_ACTIONS) if (readAnalog(r.state, c.map.analog[a.id], c.settings.deadZone) !== 0) on.push(a.id);
      for (const a of BUTTON_ACTIONS) if (isDown(r.state, c.map.buttons[a.id])) on.push(a.id);
      const key = on.join(",");
      setActive((cur) => (cur === key ? cur : key));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ctrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (listenRef.current) setListen(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const begin = (l: { type: "analog"; action: AnalogAction } | { type: "button"; action: ButtonAction }) => {
    const r = readPad();
    if (!r) { setMsg("Press any button on the controller first, so the browser can see it."); return; }
    setMsg(null);
    setListen(l.type === "analog" ? { type: "analog", action: l.action, step: "pos", rest: r.state } : { type: "button", action: l.action, rest: r.state });
  };
  const lit = (id: string) => active.split(",").includes(id);

  const row = (id: string, name: string, hint: string | undefined, value: string, isSet: boolean, prompt: string | null, onChange: () => void, onClear: () => void) => (
    <div key={id} data-map-row={id} className={`flex items-center gap-2 rounded-[7px] px-2 py-1.5 ${prompt ? "bg-accent-soft" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-text">{name}</p>
        {prompt ? <p className="text-[11px] text-text">{prompt}</p> : hint ? <p className="truncate text-[10.5px] text-text-faint">{hint}</p> : null}
      </div>
      {!prompt && (
        <span className={`shrink-0 rounded-[6px] border px-2 py-1 text-[11px] font-semibold ${lit(id) ? "border-accent bg-accent text-accent-fg" : isSet ? "border-border text-text" : "border-border text-text-faint"}`}>
          {value}
        </span>
      )}
      {prompt ? (
        <Btn onClick={() => setListen(null)}>Cancel</Btn>
      ) : (
        <>
          <Btn onClick={onChange} disabled={!!listen}>Change</Btn>
          <button type="button" onClick={onClear} disabled={!isSet || !!listen} title="Leave this without a control"
            className="h-7 w-6 shrink-0 rounded-[6px] text-[13px] text-text-faint hover:text-text disabled:opacity-30">×</button>
        </>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onPointerDown={(e) => { if (e.target === e.currentTarget && !listen) onClose(); }}>
      <div className="flex max-h-full w-full max-w-[860px] flex-col rounded-[12px] border border-border bg-surface shadow-2xl">
        <div className="flex items-start gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-text">Controller layout</p>
            <p className="mt-0.5 flex items-center gap-2 text-[11.5px] text-text-muted">
              <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: `var(--h-${info ? "green" : "amber"})` }} />
              {info ? `${info.id}. Press anything to see what it does; nothing here moves the camera.` : "No controller yet. Plug in or pair one, then press any button on it."}
            </p>
          </div>
          <Btn onClick={onClose}>Done</Btn>
        </div>
        <div className="grid min-h-0 flex-1 gap-x-4 overflow-y-auto px-3 py-3 md:grid-cols-2">
          <div>
            <p className="px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-text-faint">Moving the camera</p>
            {ANALOG_ACTIONS.map((a) => {
              const L = listen?.type === "analog" && listen.action === a.id ? listen : null;
              const prompt = L ? (L.step === "pos" ? `Push a stick toward "${a.pos}", or press the button for it…` : `Now press the button for "${a.neg}"…`) : null;
              return row(a.id, a.name, `${a.neg} / ${a.pos}`, bindingName(cfg.map.analog[a.id], std), !!cfg.map.analog[a.id], prompt,
                () => begin({ type: "analog", action: a.id }),
                () => ctrl.save({ ...cfg, map: bindAnalog(cfg.map, a.id, null).map }));
            })}
          </div>
          <div>
            <p className="px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-text-faint">Buttons</p>
            {BUTTON_ACTIONS.map((a) => {
              const L = listen?.type === "button" && listen.action === a.id;
              const i = cfg.map.buttons[a.id];
              return row(a.id, a.name, "hint" in a ? a.hint : undefined, i === null ? "Not set" : buttonName(i, std), i !== null, L ? "Press a button…" : null,
                () => begin({ type: "button", action: a.id }),
                () => ctrl.save({ ...cfg, map: bindButton(cfg.map, a.id, null).map }));
            })}
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-border px-4 py-2.5">
          <p className="min-w-0 flex-1 text-[11.5px] text-text-muted">{msg ?? "The layout is kept in this browser. A control given to something new is taken from what had it."}</p>
          <Btn onClick={() => { setListen(null); setMsg("Back to the default layout."); ctrl.save({ ...cfg, map: defaultConfig().map }); }}>Reset to default</Btn>
        </div>
      </div>
    </div>
  );
}
