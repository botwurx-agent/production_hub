import { SIGNUP_URL } from "@/lib/marketing/hosts";

/**
 * One CTA, worded identically everywhere, always followed by the microcopy that
 * answers the unasked objection. Changing the wording means changing it here,
 * so the site cannot drift into three different asks.
 */
export const CTA_LABEL = "Start free";
export const CTA_MICROCOPY = "No credit card needed. Set up in minutes.";

export function CtaButton({
  variant = "primary",
  size = "md",
  href = SIGNUP_URL,
  label = CTA_LABEL,
}: {
  variant?: "primary" | "quiet";
  size?: "sm" | "md";
  href?: string;
  label?: string;
}) {
  const dims =
    size === "sm" ? "px-4 py-2 text-sm" : "px-6 py-3 text-[15px]";
  const base = `inline-flex items-center justify-center gap-2 rounded-pill font-semibold transition ${dims}`;
  const style =
    variant === "primary"
      ? "bg-accent text-accent-fg shadow-md hover:bg-accent-strong"
      : "border border-border-strong bg-surface text-text hover:bg-surface-2";
  return (
    <a href={href} className={`${base} ${style}`}>
      {label}
      {variant === "primary" ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </a>
  );
}

export function CtaMicrocopy({ className = "" }: { className?: string }) {
  return (
    <p className={`text-sm text-text-faint ${className}`}>{CTA_MICROCOPY}</p>
  );
}
