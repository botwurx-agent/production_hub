import { LoginForm } from "@/components/auth/auth-forms";
import { safeNext } from "@/lib/safe-next";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  return <LoginForm errorCode={searchParams.error} next={safeNext(searchParams.next, "")} />;
}
