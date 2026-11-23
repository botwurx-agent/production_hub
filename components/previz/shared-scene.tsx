"use client";

// A scene builder setup opened through a share link, by somebody with no
// account. The scene opens straight away. On a link that allows editing, their
// changes are kept in this browser until they press Save, and only then are
// they asked who they are: a name and an email address, with an account as an
// option afterwards and never as a gate.
import { useEffect, useMemo, useRef, useState } from "react";
import { StudioMark } from "@/components/brand/studio-mark";
import { Modal } from "@/components/ui/modal";
import { PrevizPrototype, type SceneStore } from "@/components/previz/previz-prototype";
import { asSetup, type Setup } from "@/components/previz/setup";
import { reviewerKey } from "@/lib/reviewer-key";
import { actionError } from "@/lib/action-result";
import type { ShareMode } from "@/lib/scene-share-rules";
import { saveSharedScene, signSharedSceneFiles } from "@/app/scene/[token]/actions";

type Who = { name: string; email: string };

const WHO_KEY = "scene.share.who";
const draftKey = (token: string) => `scene.share.draft.${token}`;

function readWho(): Who | null {
  try {
    const o = JSON.parse(window.localStorage.getItem(WHO_KEY) ?? "null") as Partial<Who> | null;
    return o && typeof o.name === "string" && typeof o.email === "string" && o.name && o.email ? { name: o.name, email: o.email } : null;
  } catch {
    return null;
  }
}

export function SharedScene({
  token,
  mode,
  studioName,
  setupName,
  initial,
  mine,
  siteHref,
  signupHref,
  api,
}: {
  token: string;
  mode: ShareMode;
  studioName: string;
  setupName: string;
  initial: Setup;
  /** Set when this browser has saved through the link before. */
  mine: { name: string } | null;
  siteHref: string;
  signupHref: string;
  /** Stand-ins for the two server calls, so a fixture can mount the real page. */
  api?: { save: typeof saveSharedScene; files: typeof signSharedSceneFiles };
}) {
  const canEdit = mode !== "view";
  const [ready, setReady] = useState(false);
  const [start, setStart] = useState<Setup>(initial);
  const [who, setWho] = useState<Who | null>(null);
  // Saved under a name at least once, so later changes save by themselves.
  const [committed, setCommitted] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string } | null>(null);
  const [form, setForm] = useState<Who>({ name: "", email: "" });
  const [small, setSmall] = useState(false);
  const latest = useRef<Setup | null>(null);
  const whoRef = useRef<Who | null>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    reviewerKey(); // sets the browser's own key, which is what a save is filed under
    const w = readWho();
    if (w) { setWho(w); whoRef.current = w; setForm(w); }
    const was = Boolean(mine && w);
    setCommitted(was);
    committedRef.current = was;
    // Work from an earlier visit that was never saved under a name.
    if (canEdit && !was) {
      try {
        const d = asSetup(JSON.parse(window.localStorage.getItem(draftKey(token)) ?? "null"));
        if (d) { setStart(d); latest.current = d; setDirty(true); }
      } catch { /* no draft */ }
    }
    setSmall(window.innerWidth < 900);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async (w: Who, s: Setup) => {
    const res = await (api?.save ?? saveSharedScene)(token, w, s);
    const err = actionError(res);
    if (err || !res || !("ok" in res)) return { error: err ?? "Could not save." };
    return res;
  };

  // Stable, so the builder is not handed a new store on every render here.
  const store = useMemo<SceneStore>(() => ({
    initial: start,
    canEdit,
    create: async () => {},
    guest: {
      note: !canEdit
        ? "view only, nothing here is saved"
        : committed
          ? mode === "copy" ? "saving to your copy" : `saving to ${studioName}'s setup`
          : "kept in this browser until you save",
    },
    save: async (s) => {
      latest.current = s;
      if (committedRef.current && whoRef.current) {
        const res = await send(whoRef.current, s);
        return "error" in res ? res.error : null;
      }
      try { window.localStorage.setItem(draftKey(token), JSON.stringify(s)); } catch { /* too large to keep here */ }
      setDirty(true);
      return null;
    },
    fileLinks: (paths) => (api?.files ?? signSharedSceneFiles)(token, paths),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [start, canEdit, committed, mode, studioName, token]);

  const submit = async () => {
    const w = { name: form.name.trim(), email: form.email.trim() };
    setBusy(true);
    setError(null);
    const res = await send(w, latest.current ?? start);
    setBusy(false);
    if ("error" in res) { setError(res.error); return; }
    try {
      window.localStorage.setItem(WHO_KEY, JSON.stringify(w));
      window.localStorage.removeItem(draftKey(token));
    } catch { /* nothing to clear */ }
    setWho(w); whoRef.current = w;
    setCommitted(true); committedRef.current = true;
    setDirty(false);
    setAsking(false);
    setDone({ name: res.name });
  };

  const saveLabel = mode === "copy" ? "Save my take" : "Save changes";

  return (
    <div className="flex h-[100dvh] flex-col bg-bg text-text">
      <header className="flex h-[49px] shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
        <a
          href={siteHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text"
          title="Made with Studio Flows"
        >
          <span className="grid h-6 w-6 place-items-center rounded-[7px] bg-accent text-accent-fg">
            <StudioMark className="h-3.5 w-3.5" />
          </span>
          <span className="hidden sm:inline">Made with Studio Flows</span>
        </a>
        <span className="text-text-faint">/</span>
        <p className="min-w-0 flex-1 truncate text-sm">
          <span className="font-semibold">{studioName}</span>
          <span className="text-text-muted"> shared </span>
          <span className="font-display font-bold">{setupName}</span>
        </p>
        {!canEdit ? (
          <span className="shrink-0 text-xs text-text-muted">View only. Try anything: nothing is saved.</span>
        ) : committed ? (
          <span className="shrink-0 text-xs text-text-muted" data-share-status>
            {mode === "copy" ? `Saving to your copy as ${who?.name ?? "you"}` : `Saving to ${studioName}'s setup as ${who?.name ?? "you"}`}
          </span>
        ) : (
          <>
            <span className="hidden shrink-0 text-xs text-text-muted md:inline">
              {dirty ? "Your changes are in this browser only." : "Move anything. Save when you want the studio to see it."}
            </span>
            <button
              type="button"
              data-share-save
              onClick={() => { setError(null); setAsking(true); }}
              className={`shrink-0 rounded-pill px-3.5 py-1.5 text-xs font-semibold transition ${
                dirty ? "bg-accent text-accent-fg hover:bg-accent-strong" : "border border-border-strong bg-surface text-text hover:bg-surface-2"
              }`}
            >
              {saveLabel}
            </button>
          </>
        )}
      </header>

      {done ? (
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-border bg-surface-2 px-4 py-2 text-sm" data-share-done>
          <span>
            <span className="font-semibold">Saved.</span>{" "}
            {mode === "copy"
              ? `${studioName} can now open it as "${done.name}". Keep going: changes save by themselves from here.`
              : `${studioName} sees your changes. Further changes save by themselves.`}
          </span>
          <a href={signupHref} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
            Create a free Studio Flows account
          </a>
          <button type="button" onClick={() => setDone(null)} className="ml-auto text-xs font-semibold text-text-muted hover:text-text">
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        {!ready ? null : small ? (
          <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center px-6 text-center">
            <h1 className="font-display text-xl font-bold">Open this on a computer</h1>
            <p className="mt-2 text-sm text-text-muted">
              The scene builder is a 3D set with lights and cameras, and it needs a bigger screen and a mouse or trackpad.
              Open this same link on a laptop or desktop.
            </p>
            <button type="button" onClick={() => setSmall(false)} className="mt-5 text-sm font-semibold text-accent hover:underline">
              Open it here anyway
            </button>
          </div>
        ) : (
          <PrevizPrototype store={store} heightClass="h-full" />
        )}
      </div>

      <Modal open={asking} onClose={() => (busy ? undefined : setAsking(false))} title={saveLabel}>
        <form
          onSubmit={(e) => { e.preventDefault(); void submit(); }}
          className="space-y-4"
        >
          <p className="text-sm text-text-muted">
            {mode === "copy"
              ? `Your version is saved as its own setup, next to ${studioName}'s original, which stays as it was. Tell them whose it is.`
              : `Your changes are saved onto ${studioName}'s setup. Tell them who made them.`}
          </p>
          <label className="block text-sm font-semibold">
            Your name
            <input
              data-share-name
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={80}
              autoFocus
              required
              className="mt-1.5 w-full rounded-[11px] border border-border bg-surface px-3 py-2 text-sm font-normal outline-none focus:border-border-strong"
            />
          </label>
          <label className="block text-sm font-semibold">
            Email
            <input
              data-share-email
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              maxLength={200}
              required
              className="mt-1.5 w-full rounded-[11px] border border-border bg-surface px-3 py-2 text-sm font-normal outline-none focus:border-border-strong"
            />
            <span className="mt-1 block text-xs font-normal text-text-muted">
              Only {studioName} sees it. No account is made.
            </span>
          </label>
          {error ? (
            <p className="rounded-[10px] border border-border bg-red-bg px-3 py-2 text-sm text-text" role="alert">{error}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAsking(false)} disabled={busy} className="rounded-pill px-4 py-2 text-sm font-semibold text-text-muted hover:text-text disabled:opacity-50">
              Not yet
            </button>
            <button type="submit" disabled={busy || !form.name.trim() || !form.email.trim()} className="rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-strong disabled:opacity-50">
              {busy ? "Saving..." : saveLabel}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
