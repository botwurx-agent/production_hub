import { redirect } from "next/navigation";

// Leads became the deal Pipeline. Old lead links land on the pipeline; the
// migrated opportunity lives there as a deal on its company.
export default function LeadRedirect() {
  redirect("/pipeline");
}
