import Link from "next/link";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg px-5 py-12">
      <div className="mx-auto w-full max-w-[720px]">
        <Link href="/" className="mb-8 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-accent text-accent-fg shadow-md">
            <span className="text-sm font-extrabold">H</span>
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight">
            The Hub
          </span>
        </Link>
        <article className="space-y-5 text-sm leading-relaxed text-text-muted [&_h1]:font-display [&_h1]:text-2xl [&_h1]:font-extrabold [&_h1]:text-text [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-text [&_a]:font-medium [&_a]:text-accent [&_a]:underline [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_strong]:text-text">
          {children}
        </article>
        <p className="mt-10 border-t border-border pt-6 text-xs text-text-faint">
          These pages are a starting template covering the product's actual data
          practices. Have them reviewed by legal counsel and complete the
          bracketed details before a public launch.
        </p>
      </div>
    </div>
  );
}
