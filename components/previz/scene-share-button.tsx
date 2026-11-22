"use client";

// Share one scene builder setup by link. The person who opens it needs no
// account; the link says whether they can only look, save their own copy
// beside the original, or change the original. Staff only.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { confirmAction } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toast";
import { actionError } from "@/lib/action-result";
import { SHARE_MODES, SHARE_MODE_LABEL, type ShareMode } from "@/lib/scene-share-rules";
import {
  getSceneShare, revokeSceneShare, setSceneShare, type SceneShareState,
} from "@/app/(app)/projects/[id]/scene-actions";

const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function SceneShareButton({
  setupId,
  setupName,
  setupHref,
}: {
  setupId: string;
  setupName: string;
  setupHref: (id: string) => string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<SceneShareState | null>(null);
  const [mode, setMode] = useState<ShareMode>("copy");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);

  // A read that comes back after the link was changed here must not put the
  // older answer back on screen (server calls queue, so a read can land late).
  const seq = useRef(0);
  const load = async () => {
    const n = ++seq.current;
    const res = await getSceneShare(setupId);
    if (n !== seq.current) return;
    const err = actionError(res);
    if (err || !res || !("takes" in res)) { toast(err ?? "Could not read the link.", "error"); return; }
    setState(res);
    setLive(Boolean(res.link));
    if (res.link) setMode(res.link.mode);
  };

  // Read fresh each time the window opens: a guest may have saved since.
  useEffect(() => {
    if (!open) return;
    setState(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, setupId]);
  // The dot on the button, without opening the window.
  useEffect(() => {
    let off = false;
    const n = seq.current;
    void getSceneShare(setupId).then((res) => {
      if (!off && n === seq.current && res && "takes" in res) setLive(Boolean(res.link));
    });
    return () => { off = true; };
  }, [setupId]);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied.");
    } catch {
      toast("Could not copy. Select the link and copy it by hand.", "error");
    }
  };

  const apply = async (next: ShareMode) => {
    setBusy(true);
    seq.current++;
    const res = await setSceneShare(setupId, next);
    setBusy(false);
    const err = actionError(res);
    if (err || !res || !("url" in res)) { toast(err ?? "Could not make the link.", "error"); return null; }
    setMode(res.mode);
    setLive(true);
    setState((s) => ({ takes: s?.takes ?? [], link: { url: res.url, mode: res.mode, lastViewedAt: s?.link?.lastViewedAt ?? null } }));
    return res.url;
  };

  const pick = async (next: ShareMode) => {
    if (!state?.link) { setMode(next); return; }
    if (next === state.link.mode) return;
    // Asked BEFORE anything is pending: a confirm inside a transition never shows.
    if (next === "edit") {
      const ok = await confirmAction({
        title: "Let them change this setup itself?",
        body: `Anyone holding the link will be able to save changes straight onto "${setupName}", with no copy kept of how it was. "Can edit a copy" gives you their version beside yours instead.`,
        confirmLabel: "Allow editing",
      });
      if (!ok) return;
    }
    await apply(next);
  };

  const turnOff = async () => {
    const ok = await confirmAction({
      title: "Turn this link off?",
      body: "The link stops opening for everyone who has it. Copies people already saved stay on the project. Turning sharing back on makes a new link.",
      confirmLabel: "Turn off link",
    });
    if (!ok) return;
    setBusy(true);
    seq.current++;
    const err = actionError(await revokeSceneShare(setupId));
    setBusy(false);
    if (err) { toast(err, "error"); return; }
    setLive(false);
    setState((s) => ({ takes: s?.takes ?? [], link: null }));
  };

  const link = state?.link ?? null;

  return (
    <>
      <button
        type="button"
        data-scene-share
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-[8px] border border-border px-2.5 py-1 text-xs font-semibold text-text hover:bg-surface-2"
      >
        {live ? <span className="h-1.5 w-1.5 rounded-full bg-green" aria-hidden /> : null}
        Share
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`Share ${setupName}`}>
        {!state ? (
          <p className="text-sm text-text-muted">Checking the link...</p>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-text-muted">
              Send this setup to a DP or a gaffer to try their own lighting on. They open it in a browser on a computer,
              with no account and nothing to pay. They see this one setup and nothing else on the project.
            </p>

            <fieldset className="space-y-2" disabled={busy}>
              <legend className="mb-1 text-sm font-semibold">Whoever has the link</legend>
              {SHARE_MODES.map((m) => (
                <label
                  key={m}
                  className={`flex cursor-pointer items-start gap-3 rounded-[12px] border px-3 py-2.5 ${
                    mode === m ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-2"
                  }`}
                >
                  <input
                    type="radio"
                    name="scene-share-mode"
                    data-share-mode={m}
                    checked={mode === m}
                    onChange={() => void pick(m)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-text">{SHARE_MODE_LABEL[m].label}</span>
                    <span className="block text-[13px] text-text-muted">{SHARE_MODE_LABEL[m].hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {link ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    readOnly
                    data-share-url
                    value={link.url}
                    onFocus={(e) => e.currentTarget.select()}
                    className="min-w-0 flex-1 rounded-[11px] border border-border bg-surface-2 px-3 py-2 text-sm"
                  />
                  <button type="button" onClick={() => void copy(link.url)} className="shrink-0 rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-strong">
                    Copy link
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
                    Open what they see
                  </a>
                  <span className="text-text-muted">
                    {link.lastViewedAt ? `Last opened ${day(link.lastViewedAt)}` : "Not opened yet"}
                  </span>
                  <button type="button" onClick={() => void turnOff()} disabled={busy} className="ml-auto font-semibold text-text-muted hover:text-red disabled:opacity-50">
                    Turn off link
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                data-share-make
                disabled={busy}
                onClick={async () => { const url = await apply(mode); if (url) void copy(url); }}
                className="rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-strong disabled:opacity-50"
              >
                {busy ? "Making the link..." : "Make the link"}
              </button>
            )}

            {state.takes.length ? (
              <div>
                <h3 className="mb-1.5 text-sm font-semibold">Who has saved</h3>
                <ul className="divide-y divide-border rounded-[12px] border border-border">
                  {state.takes.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 text-sm">
                      <span className="font-semibold">{t.name}</span>
                      <a href={`mailto:${t.email}`} className="text-text-muted hover:text-text">{t.email}</a>
                      <span className="text-[13px] text-text-muted">{day(t.savedAt)}</span>
                      {t.own ? (
                        <Link
                          href={setupHref(t.setupId)}
                          onClick={() => { setOpen(false); router.refresh(); }}
                          className="ml-auto font-semibold text-accent hover:underline"
                        >
                          Open their take
                        </Link>
                      ) : (
                        <span className="ml-auto text-[13px] text-text-muted">Edited this setup</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : link && link.mode !== "view" ? (
              <p className="text-[13px] text-text-muted">
                Nobody has saved yet. When they do, they give a name and an email, you get a notification, and their version shows here.
              </p>
            ) : null}
          </div>
        )}
      </Modal>
    </>
  );
}
