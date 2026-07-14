import { redirect } from "next/navigation";

// Leads became the deal Pipeline (Accounts + Contacts + Deals model).
export default function LeadsRedirect() {
  redirect("/pipeline");
}
