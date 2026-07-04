"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  saveCallSheet,
  addCallSheetEntry,
  updateCallSheetEntry,
  deleteCallSheetEntry,
  type CallSheetPatch,
} from "@/app/(app)/projects/[id]/production/actions";
import type { CallSheet as CS, CallSheetEntry } from "@/lib/database.types";

const field =
  "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong";
const cell =
  "w-full rounded-[8px] border border-transparent bg-transparent px-2 py-1 text-sm text-text outline-none transition hover:border-border focus:border-border-strong focus:bg-surface";

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wide text-text-faint">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export function CallSheet({
  projectId,
  projectTitle,
  callSheet,
  entries,
}: {
  projectId: string;
  projectTitle: string;
  callSheet: CS | null;
  entries: CallSheetEntry[];
}) {
  const router = useRouter();

  // Header fields (local state, persisted on blur).
  const [f, setF] = useState({
    production_title: callSheet?.production_title ?? "",
    day_of: callSheet?.day_of ?? "",
    shoot_date: callSheet?.shoot_date ?? "",
    crew_call: callSheet?.crew_call ?? "",
    shoot_call: callSheet?.shoot_call ?? "",
    breakfast: callSheet?.breakfast ?? "",
    lunch: callSheet?.lunch ?? "",
    wrap: callSheet?.wrap ?? "",
    location: callSheet?.location ?? "",
    parking: callSheet?.parking ?? "",
    weather: callSheet?.weather ?? "",
    sunrise: callSheet?.sunrise ?? "",
    sunset: callSheet?.sunset ?? "",
    hospital: callSheet?.hospital ?? "",
    notes: callSheet?.notes ?? "",
    company_name: callSheet?.company_name ?? "",
    company_address: callSheet?.company_address ?? "",
    company_website: callSheet?.company_website ?? "",
    company_phone: callSheet?.company_phone ?? "",
    producer: callSheet?.producer ?? "",
    producer_phone: callSheet?.producer_phone ?? "",
    director: callSheet?.director ?? "",
    director_phone: callSheet?.director_phone ?? "",
    pm: callSheet?.pm ?? "",
    pm_phone: callSheet?.pm_phone ?? "",
  });
  function set(k: keyof typeof f, v: string) {
    setF((prev) => ({ ...prev, [k]: v }));
  }
  function save(k: keyof CallSheetPatch, v: string) {
    void saveCallSheet(projectId, { [k]: v || null });
  }

  const [rows, setRows] = useState<CallSheetEntry[]>(entries);
  const sig = entries.map((e) => e.id).join(",");
  useEffect(() => {
    setRows(entries);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  const [busy, start] = useTransition();

  function editRow(id: string, patch: Partial<CallSheetEntry>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function addRow(kind: "cast" | "crew") {
    start(async () => {
      await addCallSheetEntry(projectId, kind);
      router.refresh();
    });
  }
  function delRow(id: string) {
    setRows((p) => p.filter((r) => r.id !== id));
    start(async () => {
      await deleteCallSheetEntry(projectId, id);
      router.refresh();
    });
  }

  const cast = rows.filter((r) => r.kind === "cast");
  const crew = rows.filter((r) => r.kind !== "cast");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">
          Fill in the shoot details. Everything saves automatically.
        </p>
        <Link
          href={`/projects/${projectId}/production/callsheet`}
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
          </svg>
          Print / Export PDF
        </Link>
      </div>

      {/* Production company */}
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-text-faint">
          Production company
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Labeled label="Company">
            <input
              value={f.company_name}
              onChange={(e) => set("company_name", e.target.value)}
              onBlur={() => save("company_name", f.company_name)}
              placeholder="Studio / company name"
              className={field}
            />
          </Labeled>
          <Labeled label="Phone">
            <input
              value={f.company_phone}
              onChange={(e) => set("company_phone", e.target.value)}
              onBlur={() => save("company_phone", f.company_phone)}
              className={field}
            />
          </Labeled>
          <Labeled label="Website">
            <input
              value={f.company_website}
              onChange={(e) => set("company_website", e.target.value)}
              onBlur={() => save("company_website", f.company_website)}
              className={field}
            />
          </Labeled>
          <Labeled label="Company address">
            <input
              value={f.company_address}
              onChange={(e) => set("company_address", e.target.value)}
              onBlur={() => save("company_address", f.company_address)}
              className={field}
            />
          </Labeled>
        </div>
      </div>

      {/* Key contacts */}
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-text-faint">
          Key contacts
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {([
            ["producer", "producer_phone", "Producer"],
            ["director", "director_phone", "Director"],
            ["pm", "pm_phone", "Production mgr"],
          ] as const).map(([nameKey, phoneKey, label]) => (
            <div key={nameKey} className="rounded-[10px] border border-border p-2.5">
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-text-faint">
                {label}
              </div>
              <input
                value={f[nameKey]}
                onChange={(e) => set(nameKey, e.target.value)}
                onBlur={() => save(nameKey, f[nameKey])}
                placeholder="Name"
                className={`${field} mb-1.5`}
              />
              <input
                value={f[phoneKey]}
                onChange={(e) => set(phoneKey, e.target.value)}
                onBlur={() => save(phoneKey, f[phoneKey])}
                placeholder="Phone"
                className={field}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Labeled label="Production">
          <input
            value={f.production_title}
            onChange={(e) => set("production_title", e.target.value)}
            onBlur={() => save("production_title", f.production_title)}
            placeholder={projectTitle}
            className={field}
          />
        </Labeled>
        <Labeled label="Shoot day">
          <input
            value={f.day_of}
            onChange={(e) => set("day_of", e.target.value)}
            onBlur={() => save("day_of", f.day_of)}
            placeholder="e.g. Day 1 of 3"
            className={field}
          />
        </Labeled>
        <Labeled label="Shoot date">
          <input
            type="date"
            value={f.shoot_date}
            onChange={(e) => set("shoot_date", e.target.value)}
            onBlur={() => save("shoot_date", f.shoot_date)}
            className={field}
          />
        </Labeled>
        <Labeled label="Weather">
          <input
            value={f.weather}
            onChange={(e) => set("weather", e.target.value)}
            onBlur={() => save("weather", f.weather)}
            placeholder="e.g. Sunny, high 72"
            className={field}
          />
        </Labeled>
      </div>

      {/* Times */}
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-text-faint">
          Key times
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([
            ["crew_call", "Crew call"],
            ["shoot_call", "Shooting call"],
            ["breakfast", "Breakfast"],
            ["lunch", "Lunch"],
            ["wrap", "Est. wrap"],
          ] as const).map(([key, label]) => (
            <Labeled key={key} label={label}>
              <input
                value={f[key]}
                onChange={(e) => set(key, e.target.value)}
                onBlur={() => save(key, f[key])}
                placeholder="e.g. 7:00 AM"
                className={field}
              />
            </Labeled>
          ))}
        </div>
      </div>

      {/* Location + safety */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Labeled label="Location">
          <input
            value={f.location}
            onChange={(e) => set("location", e.target.value)}
            onBlur={() => save("location", f.location)}
            placeholder="Address or studio"
            className={field}
          />
        </Labeled>
        <Labeled label="Parking">
          <input
            value={f.parking}
            onChange={(e) => set("parking", e.target.value)}
            onBlur={() => save("parking", f.parking)}
            placeholder="Where crew parks"
            className={field}
          />
        </Labeled>
        <Labeled label="Nearest hospital">
          <input
            value={f.hospital}
            onChange={(e) => set("hospital", e.target.value)}
            onBlur={() => save("hospital", f.hospital)}
            placeholder="Name & address (safety)"
            className={field}
          />
        </Labeled>
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Sunrise">
            <input
              value={f.sunrise}
              onChange={(e) => set("sunrise", e.target.value)}
              onBlur={() => save("sunrise", f.sunrise)}
              placeholder="6:04 AM"
              className={field}
            />
          </Labeled>
          <Labeled label="Sunset">
            <input
              value={f.sunset}
              onChange={(e) => set("sunset", e.target.value)}
              onBlur={() => save("sunset", f.sunset)}
              placeholder="7:58 PM"
              className={field}
            />
          </Labeled>
        </div>
      </div>

      <Labeled label="Notes">
        <textarea
          value={f.notes}
          onChange={(e) => set("notes", e.target.value)}
          onBlur={() => save("notes", f.notes)}
          placeholder="Catering, wardrobe, safety notes, special instructions..."
          className={`min-h-[72px] ${field}`}
        />
      </Labeled>

      <PeopleTable
        title="Cast & talent"
        roleLabel="Character"
        people={cast}
        projectId={projectId}
        onAdd={() => addRow("cast")}
        onEdit={editRow}
        onDelete={delRow}
        busy={busy}
      />
      <PeopleTable
        title="Crew"
        roleLabel="Role"
        people={crew}
        projectId={projectId}
        onAdd={() => addRow("crew")}
        onEdit={editRow}
        onDelete={delRow}
        busy={busy}
      />
    </div>
  );
}

function PeopleTable({
  title,
  roleLabel,
  people,
  projectId,
  onAdd,
  onEdit,
  onDelete,
  busy,
}: {
  title: string;
  roleLabel: string;
  people: CallSheetEntry[];
  projectId: string;
  onAdd: () => void;
  onEdit: (id: string, patch: Partial<CallSheetEntry>) => void;
  onDelete: (id: string) => void;
  busy: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-text">{title}</h3>
        <Button size="sm" variant="secondary" onClick={onAdd} disabled={busy}>
          + Add
        </Button>
      </div>
      {people.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-border py-6 text-center text-sm text-text-faint">
          No one added yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-[12px] border border-border">
          <div className="grid grid-cols-[1.4fr_1.2fr_0.8fr_1.2fr_auto] gap-2 border-b border-border bg-surface-2/50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-text-faint">
            <span>Name</span>
            <span>{roleLabel}</span>
            <span>Call</span>
            <span>Contact</span>
            <span />
          </div>
          {people.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-[1.4fr_1.2fr_0.8fr_1.2fr_auto] items-center gap-2 border-b border-border px-2 py-1 last:border-0"
            >
              <input
                value={r.name}
                onChange={(e) => onEdit(r.id, { name: e.target.value })}
                onBlur={() => updateCallSheetEntry(projectId, r.id, { name: r.name })}
                placeholder="Name"
                className={cell}
              />
              <input
                value={r.role ?? ""}
                onChange={(e) => onEdit(r.id, { role: e.target.value })}
                onBlur={() => updateCallSheetEntry(projectId, r.id, { role: r.role ?? "" })}
                placeholder={roleLabel}
                className={cell}
              />
              <input
                value={r.call_time ?? ""}
                onChange={(e) => onEdit(r.id, { call_time: e.target.value })}
                onBlur={() =>
                  updateCallSheetEntry(projectId, r.id, { call_time: r.call_time ?? "" })
                }
                placeholder="Time"
                className={cell}
              />
              <input
                value={r.contact ?? ""}
                onChange={(e) => onEdit(r.id, { contact: e.target.value })}
                onBlur={() =>
                  updateCallSheetEntry(projectId, r.id, { contact: r.contact ?? "" })
                }
                placeholder="Phone / email"
                className={cell}
              />
              <button
                onClick={() => onDelete(r.id)}
                className="grid h-7 w-7 place-items-center rounded-[7px] text-text-faint transition hover:bg-red-bg hover:text-red"
                aria-label="Remove"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
