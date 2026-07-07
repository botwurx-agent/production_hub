import { redirect } from "next/navigation";

// Production is now split into focused pages (Call sheet, Budget, Gear & crew,
// Delivery), each linked from the project hub. Old links to /production (or its
// ?tab= deep links) land back on the hub.
export default function ProductionRedirect({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/projects/${params.id}`);
}
