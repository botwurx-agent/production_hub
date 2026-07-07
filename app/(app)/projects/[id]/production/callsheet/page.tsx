import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { PrintButton } from "@/components/production/print-button";
import { ChevronLeftIcon } from "@/components/app-shell/nav-icons";
import { signedLogoUrl } from "@/lib/branding";
import type { CallSheet, CallSheetEntry } from "@/lib/database.types";

// "Tuesday 2/17/26" from a YYYY-MM-DD string (parsed as a local date).
function badgeDate(d: string | null | undefined): string {
  if (!d) return "Date TBD";
  const [y, m, day] = d.split("-").map(Number);
  if (!y || !m || !day) return d;
  const dt = new Date(y, m - 1, day);
  const wd = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dt.getDay()];
  return `${wd} ${m}/${day}/${String(y).slice(2)}`;
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <tr>
      <td className="border border-border px-2 py-1 text-xs font-semibold text-text-muted">
        {label}
      </td>
      <td className="border border-border px-2 py-1 text-sm text-text">
        {value?.trim() ? value : "—"}
      </td>
    </tr>
  );
}

function ContactRow({
  role,
  name,
  phone,
}: {
  role: string;
  name?: string | null;
  phone?: string | null;
}) {
  if (!name?.trim() && !phone?.trim()) return null;
  return (
    <tr>
      <td className="border border-border px-2 py-1 text-xs font-semibold text-text-muted">
        {role}
      </td>
      <td className="border border-border px-2 py-1 text-sm text-text">
        {name?.trim() || "—"}
      </td>
      <td className="border border-border px-2 py-1 text-sm text-text-muted">
        {phone?.trim() || ""}
      </td>
    </tr>
  );
}

function People({
  title,
  roleLabel,
  extraLabel,
  people,
}: {
  title: string;
  roleLabel: string;
  extraLabel: string;
  people: CallSheetEntry[];
}) {
  return (
    <div className="mt-4">
      <div className="border border-border bg-surface-2/60 px-2 py-1 text-center text-xs font-bold uppercase tracking-wide text-text">
        {title}
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-text-faint">
            <th className="w-8 border border-border px-2 py-1">#</th>
            <th className="border border-border px-2 py-1">{title.split(" ")[0]}</th>
            <th className="border border-border px-2 py-1">{roleLabel}</th>
            <th className="w-20 border border-border px-2 py-1">Call</th>
            <th className="border border-border px-2 py-1">{extraLabel}</th>
          </tr>
        </thead>
        <tbody>
          {(people.length > 0 ? people : []).map((p, i) => (
            <tr key={p.id}>
              <td className="border border-border px-2 py-1 text-center text-text-faint">
                {i + 1}
              </td>
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
          {people.length === 0 && (
            <tr>
              <td colSpan={5} className="border border-border px-2 py-3 text-center text-xs text-text-faint">
                None added
              </td>
            </tr>
          )}
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
  const s = cs as CallSheet | null;

  let entries: CallSheetEntry[] = [];
  if (s) {
    const { data } = await supabase
      .from("call_sheet_entries")
      .select("*")
      .eq("call_sheet_id", s.id)
      .order("position", { ascending: true });
    entries = (data ?? []) as CallSheetEntry[];
  }

  const cast = entries.filter((e) => e.kind === "cast");
  const crew = entries.filter((e) => e.kind !== "cast");
  const logoUrl = await signedLogoUrl(ctx.studio.logo_path);
  const title = s?.production_title?.trim() || project.title;
  const company = s?.company_name?.trim() || ctx.studio.name;
  const callTime = s?.crew_call?.trim() || s?.shoot_call?.trim() || s?.call_time?.trim() || "TBD";
  const mapsHref = s?.location?.trim()
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.location)}`
    : null;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/projects/${project.id}/callsheet`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-text-muted transition hover:text-text"
        >
          <ChevronLeftIcon /> Back to call sheet
        </Link>
        <PrintButton />
      </div>

      <div
        data-theme="light"
        className="rounded-[6px] bg-surface p-6 text-text shadow-sm print:rounded-none print:p-0 print:shadow-none"
      >
        {/* Header: company | title + call badge | info */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {/* Company + key contacts */}
          <div className="border border-border p-3">
            <div className="text-base font-extrabold text-text">{company}</div>
            {s?.company_address?.trim() && (
              <div className="text-xs text-text-muted">{s.company_address}</div>
            )}
            {s?.company_website?.trim() && (
              <div className="text-xs text-text-faint">{s.company_website}</div>
            )}
            {s?.company_phone?.trim() && (
              <div className="text-xs text-text-muted">{s.company_phone}</div>
            )}
            <table className="mt-2 w-full border-collapse">
              <tbody>
                <ContactRow role="Producer" name={s?.producer} phone={s?.producer_phone} />
                <ContactRow role="Director" name={s?.director} phone={s?.director_phone} />
                <ContactRow role="PM" name={s?.pm} phone={s?.pm_phone} />
              </tbody>
            </table>
          </div>

          {/* Title + CALL badge */}
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={company}
                className="max-h-12 w-auto max-w-[160px] object-contain"
              />
            )}
            <h1 className="font-display text-xl font-extrabold leading-tight tracking-tight text-text">
              {title}
            </h1>
            <div className="grid h-32 w-32 place-items-center rounded-full border-4 border-border-strong">
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase tracking-widest text-text-faint">
                  Call
                </div>
                <div className="text-2xl font-extrabold leading-none text-text">
                  {callTime}
                </div>
                <div className="mt-1 text-[11px] font-semibold text-text-muted">
                  {badgeDate(s?.shoot_date)}
                </div>
              </div>
            </div>
            {s?.day_of?.trim() && (
              <div className="text-xs font-semibold text-text-muted">{s.day_of}</div>
            )}
          </div>

          {/* Info table */}
          <div>
            <table className="w-full border-collapse">
              <tbody>
                <InfoRow label="Breakfast" value={s?.breakfast} />
                <InfoRow label="Lunch" value={s?.lunch} />
                <InfoRow label="Est. wrap" value={s?.wrap} />
                <InfoRow label="Sunrise" value={s?.sunrise} />
                <InfoRow label="Sunset" value={s?.sunset} />
                <InfoRow label="Weather" value={s?.weather} />
                <InfoRow label="Nearest hospital" value={s?.hospital} />
              </tbody>
            </table>
          </div>
        </div>

        {/* Location + notes */}
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="border border-border p-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-text-faint">
              Location
            </div>
            <div className="mt-0.5 text-sm font-medium text-text">
              {s?.location?.trim() || "—"}
            </div>
            {mapsHref && (
              <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-accent hover:underline"
              >
                Open in Google Maps
              </a>
            )}
            {s?.parking?.trim() && (
              <div className="mt-2">
                <div className="text-[10px] font-bold uppercase tracking-wide text-text-faint">
                  Parking
                </div>
                <div className="text-sm text-text-muted">{s.parking}</div>
              </div>
            )}
          </div>
          <div className="border border-border p-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-text-faint">
              Production notes
            </div>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-text-muted">
              {s?.notes?.trim() || "—"}
            </p>
          </div>
        </div>

        <People title="Cast & talent" roleLabel="Character" extraLabel="Notes" people={cast} />
        <People title="Crew" roleLabel="Role" extraLabel="Contact" people={crew} />

        <div className="mt-4 flex items-center justify-between text-[10px] text-text-faint">
          <span>
            {project.client && (project.client as { name: string }).name
              ? `Client: ${(project.client as { name: string }).name}`
              : ctx.studio.name}
          </span>
          <span>Generated by The Hub</span>
        </div>
      </div>
    </div>
  );
}
