import { redirect } from "next/navigation";

// The authenticated app lives under /projects; middleware sends signed-out
// users to /login.
export default function RootPage() {
  redirect("/projects");
}
