import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { PrintButton } from "@/components/production/print-button";
import { ChevronLeftIcon } from "@/components/app-shell/nav-icons";
import { longDate } from "@/lib/format";
import type { CallSheet, CallSheetEntry } from "@/lib/database.types";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="border border-border px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-text-faint">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium text-text">
        {value?.trim() ? value : "—"}
      </div>
    </div>
  );
}

function People({
  title,
  roleLabel,
  people,
}: {
  title: string;
  roleLabel: string;
  people: CallSheetEntry[];
}) {
  if (people.length === 0) return null;
  return (
    <div className="mt-5">
      <div className="mb-1 text-sm font-bold text-text">{title}</div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-surface-2/60 text-left text-[10px] font-bold uppercase tracking-wide text-text-faint">
            <th className="border border-border px-2 py-1">Name</th>
            <th className="border border-border px-2 py-1">{roleLabel}</th>
            <th className="border border-border px-2 py-1">Call</th>
            <th className="border border-border px-2 py-1">Contact</th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id}>
              <td className="border border-border px-2 py-1 font-medium text-text">
                {p.name || "—"}
              </td>
              <td className="border border-border px-2 py-1 text-text-muted">
                {p.role || "—"}
              </td>
              <td className="border border-border px-2 py-1 text-text-muted">
                {p.call_time || "—"}
              </td>
              <td className="border border-border px-2 py-1 text-text-muted">
                {p.contact || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function CallSheetPrintPage({
  params,
}: {
  params: { id: string };
}) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, client:clients(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  const { data: cs } = await supabase
    .from("call_sheets")
    .select("*")
    .eq("project_id", params.id)
    .maybeSingle();
  const sheet = cs as CallSheet | null;

  let entries: CallSheetEntry[] = [];
  if (sheet) {
    const { data } = await supabase
      .from("call_sheet_entries")
      .select("*")
      .eq("call_sheet_id", sheet.id)
      .order("position", { ascending: true });
    entries = (data ?? []) as CallSheetEntry[];
  }

  const clientName = (project.client as { name: string } | null)?.name ?? null;
  const cast = entries.filter((e) => e.kind === "cast");
  const crew = entries.filter((e) => e.kind !== "cast");
  const title = sheet?.production_title?.trim() || project.title;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Screen-only controls */}
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/projects/${project.id}/production`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-text-muted transition hover:text-text"
        >
          <ChevronLeftIcon /> Back to production
        </Link>
        <PrintButton />
      </div>

      {/* Print document (forced light theme so it prints clean) */}
      <div data-theme="light" className="rounded-[6px] bg-surface p-6 text-text shadow-sm print:rounded-none print:p-0 print:shadow-none">
        <div className="mb-4 flex items-start justify-between border-b-2 border-border-strong pb-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight">
              {title}
            </h1>
            <p className="text-sm text-text-muted">
              {clientName ? `${clientName} · ` : ""}Call Sheet
              {sheet?.day_of ? ` · ${sheet.day_of}` : ""}
            </p>
          </div>
          <div className="text-right text-sm">
            <div className="font-bold text-text">
              {sheet?.shoot_date ? longDate(sheet.shoot_date) : "Date TBD"}
            </div>
            <div className="text-text-faint">{ctx.studio.name}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px sm:grid-cols-4">
          <Field label="Crew call" value={sheet?.crew_call} />
          <Field label="Shooting call" value={sheet?.shoot_call} />
          <Field label="Lunch" value={sheet?.lunch} />
          <Field label="Est. wrap" value={sheet?.wrap} />
          <Field label="Sunrise" value={sheet?.sunrise} />
          <Field label="Sunset" value={sheet?.sunset} />
          <Field label="Weather" value={sheet?.weather} />
          <Field label="Day" value={sheet?.day_of} />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-px sm:grid-cols-3">
          <Field label="Location" value={sheet?.location} />
          <Field label="Parking" value={sheet?.parking} />
          <Field label="Nearest hospital" value={sheet?.hospital} />
        </div>

        <People title="Cast & talent" roleLabel="Character" people={cast} />
        <People title="Crew" roleLabel="Role" people={crew} />

        {sheet?.notes?.trim() && (
          <div className="mt-5">
            <div className="mb-1 text-sm font-bold text-text">Notes</div>
            <p className="whitespace-pre-wrap border border-border px-3 py-2 text-sm text-text-muted">
              {sheet.notes}
            </p>
          </div>
        )}

        {!sheet && (
          <p className="mt-6 text-center text-sm text-text-faint">
            This call sheet is empty. Fill it in under Production, then print.
          </p>
        )}
      </div>
    </div>
  );
}
