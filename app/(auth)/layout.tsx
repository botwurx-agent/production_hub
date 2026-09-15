import Link from "next/link";
import { StudioTile } from "@/components/brand/studio-mark";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-5 py-12">
      <div className="w-full max-w-[400px]">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <StudioTile size={36} className="shadow-md" />
          <span className="font-display text-xl font-extrabold tracking-tight">
            Studio Flows
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
