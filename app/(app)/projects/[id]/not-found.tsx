import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ProjectNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <Card className="w-full max-w-[420px] p-7 text-center">
        <h1 className="font-display text-lg font-bold">Project not found</h1>
        <p className="mt-2 text-sm text-text-muted">
          This project does not exist, or you do not have access to it.
        </p>
        <div className="mt-6 flex justify-center">
          <Link href="/projects">
            <Button>Back to projects</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
