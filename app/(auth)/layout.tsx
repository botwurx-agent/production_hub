import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-5 py-12">
      <div className="w-full max-w-[400px]">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-accent text-accent-fg shadow-md">
            <span className="text-sm font-extrabold">H</span>
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight">
            The Hub
          </span>
        </Link>
        {children}
      </div>
      <p className="mt-8 text-center text-xs text-text-faint">
        A connected pre-production hub for commercial production studios.
      </p>
      <p className="mt-2 text-center text-xs text-text-faint">
        <Link href="/terms" className="hover:text-text-muted hover:underline">
          Terms
        </Link>
        <span className="mx-2">·</span>
        <Link href="/privacy" className="hover:text-text-muted hover:underline">
          Privacy
        </Link>
      </p>
    </div>
  );
}
