import { redirect } from "next/navigation";

// The authenticated app opens on the dashboard; middleware sends signed-out
// users to /login.
export default function RootPage() {
  redirect("/dashboard");
}
