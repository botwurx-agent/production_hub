import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-5 py-12">
      <Card className="w-full max-w-[420px] p-7 text-center">
        <p className="font-display text-4xl font-extrabold text-accent">404</p>
        <h1 className="mt-2 font-display text-xl font-extrabold">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          The page you are looking for does not exist or may have moved.
        </p>
        <div className="mt-6 flex justify-center">
          <Link href="/dashboard">
            <Button>Go to dashboard</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
