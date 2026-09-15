import Link from "next/link";
import { StudioTile } from "@/components/brand/studio-mark";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg px-5 py-12">
      <div className="mx-auto w-full max-w-[720px]">
        <Link href="/" className="mb-8 flex items-center gap-2">
          <StudioTile size={36} className="shadow-md" />
          <span className="font-display text-xl font-extrabold tracking-tight">
            Studio Flows
          </span>
        </Link>
        <article className="space-y-5 text-sm leading-relaxed text-text-muted [&_h1]:font-display [&_h1]:text-2xl [&_h1]:font-extrabold [&_h1]:text-text [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-text [&_h3]:mt-6 [&_h3]:font-display [&_h3]:text-[15px] [&_h3]:font-bold [&_h3]:text-text [&_a]:font-medium [&_a]:text-accent [&_a]:underline [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_strong]:text-text">
          {children}
        </article>
      </div>
    </div>
  );
}
