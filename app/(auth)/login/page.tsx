import { LoginForm } from "@/components/auth/auth-forms";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return <LoginForm errorCode={searchParams.error} />;
}
