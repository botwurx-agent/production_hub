import { DocSurfaceView } from "@/components/review/doc-surface";
import { CallSheetDocument } from "@/components/production/callsheet-document";
import { shortDate } from "@/lib/format";
import type { BinderView } from "@/lib/binder-data";
import type { DocSurface } from "@/lib/review-links";

/**
 * The binder itself: read-only, print-first.
 *
 * ONE renderer for the client's page and the PDF, so the thing that prints is
 * the thing they were shown. The print rules live here as `print:` classes
 * rather than in a second component.
 *
 * Composed from the renderers that already exist, deliberately. A storyboard
 * in a binder has to look like the storyboard the client approved, and the
 * only way to guarantee that is to use the same component rather than a second
 * one that agrees today.
 */
export function BinderDocument({ view }: { view: BinderView }) {
  return (
    <div data-theme="light" className="mx-auto max-w-4xl px-5 py-8 print:px-0 print:py-0">
      {/* Cover */}
      <header className="mb-8 border-b border-border pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-text-faint">
              {view.studioName}
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold text-text">
              {view.title}
            </h1>
            {view.clientName && (
              <p className="mt-1 text-sm text-text-muted">
                for {view.clientName}
              </p>
            )}
          </div>
          {view.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={view.logoUrl}
              alt=""
              className="max-h-14 w-auto object-contain"
            />
          )}
        </div>

        {/* Contents. On paper this is the page you hand someone who asked to
            "see it all in one spot", so it is worth stating what is in it. */}
        {view.sections.length > 1 && (
          <ol className="mt-5 grid gap-1 sm:grid-cols-2">
            {view.sections.map((s, i) => (
              <li key={s.key} className="text-[13px] text-text-muted">
                <span className="mr-2 font-mono text-[11px] text-text-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.label}
              </li>
            ))}
          </ol>
        )}
      </header>

      {view.sections.length === 0 ? (
        <p className="py-16 text-center text-sm text-text-faint">
          Nothing has been added to this binder yet.
        </p>
      ) : (
        <div className="space-y-10">
          {view.sections.map((section, i) => (
            // Each section starts a page in print. A client reading a call
            // sheet should not find the last third of a moodboard above it.
            <section
              key={section.key}
              className={i > 0 ? "break-before-page" : undefined}
            >
              <h2 className="mb-3 border-b border-border pb-1.5 font-display text-lg font-bold text-text">
                <span className="mr-2 font-mono text-xs text-text-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {section.label}
              </h2>
              <SectionBody section={section} />
            </section>
          ))}
        </div>
      )}

      <footer className="mt-12 border-t border-border pt-4 text-center text-[11.5px] text-text-faint">
        {view.studioName}
        {view.updatedAt ? ` · updated ${shortDate(view.updatedAt)}` : ""}
      </footer>
    </div>
  );
}

function SectionBody({ section }: { section: BinderView["sections"][number] }) {
  const { content, hideNotes } = section;

  if (content.kind === "overview") {
    const o = content.overview;
    return (
      <div className="space-y-3">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <Field label="Client" value={o.clientName} />
          <Field label="Status" value={o.status.replace(/_/g, " ")} />
          <Field label="Shoot" value={o.shootDate ? shortDate(o.shootDate) : null} />
          <Field label="Delivery" value={o.dueDate ? shortDate(o.dueDate) : null} />
        </dl>
        {o.brief && (
          <div className="rounded-[10px] border border-border p-3">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-text-faint">
              Brief
            </p>
            <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-text">
              {o.brief}
            </p>
          </div>
        )}
      </div>
    );
  }

  if (content.kind === "call_sheet") {
    return (
      <CallSheetDocument
        sheet={content.sheet}
        entries={content.entries}
        logoUrl={content.logoUrl}
        studioName=""
        clientName={null}
      />
    );
  }

  if (content.kind === "doc") {
    // hideNotes is applied by stripping the field before it renders, so there
    // is no "should I show this" branch inside the shared renderer to get
    // wrong on some other surface.
    return <DocSurfaceView surface={stripNotes(content.surface, hideNotes)} />;
  }

  if (content.kind === "elements") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {content.elements.map((e) => (
          <div key={e.id} className="overflow-hidden rounded-[10px] border border-border">
            <div className="aspect-[4/3] bg-surface-2">
              {e.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.imageUrl} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="p-2">
              <p className="truncate text-[13px] font-semibold text-text">{e.name}</p>
              <p className="text-[11px] capitalize text-text-faint">{e.kind}</p>
              {e.description && (
                <p className="mt-1 text-[11.5px] text-text-muted">{e.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (content.kind === "contacts") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-text-faint">
              <th className="py-1.5 pr-3 font-bold">Name</th>
              <th className="py-1.5 pr-3 font-bold">Role</th>
              <th className="py-1.5 pr-3 font-bold">Company</th>
              <th className="py-1.5 pr-3 font-bold">Email</th>
              <th className="py-1.5 font-bold">Phone</th>
            </tr>
          </thead>
          <tbody>
            {content.contacts.map((c) => (
              <tr key={c.id} className="border-b border-border/60">
                <td className="py-1.5 pr-3 font-semibold text-text">{c.name}</td>
                <td className="py-1.5 pr-3 text-text-muted">{c.role ?? ""}</td>
                <td className="py-1.5 pr-3 text-text-muted">{c.company ?? ""}</td>
                <td className="py-1.5 pr-3 text-text-muted">{c.email ?? ""}</td>
                <td className="py-1.5 text-text-muted">{c.phone ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return null;
}

/**
 * Take the internal column out.
 *
 * The producer's exact ask was to share a shot list without the director's
 * notes, so this blanks the notes rather than hiding a column at render time:
 * a value that is not in the payload cannot be revealed by a stylesheet, a
 * copy-paste or a view-source, which is the standard a document leaving the
 * studio should meet.
 */
function stripNotes(surface: DocSurface, hide: boolean): DocSurface {
  if (!hide) return surface;
  if (surface.kind === "shot_list") {
    return {
      ...surface,
      groups: surface.groups.map((g) => ({
        ...g,
        cards: g.cards.map((c) => ({ ...c, vo: null })),
      })),
    };
  }
  if (surface.kind === "storyboard") {
    return {
      ...surface,
      frames: surface.frames.map((f) => ({ ...f, notes: null })),
    };
  }
  return surface;
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
        {label}
      </dt>
      <dd className="text-[13.5px] capitalize text-text">{value}</dd>
    </div>
  );
}
