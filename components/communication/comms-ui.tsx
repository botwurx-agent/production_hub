/**
 * The shared visual vocabulary of the Communication surfaces.
 *
 * The operator's diagnosis, and it was right: every message from every service
 * rendered as the same grey box, so the page read as a log viewer, and nobody
 * trusts a log viewer with client communication. Confidence comes from
 * FAMILIARITY: people already trust Gmail and Slack, so the reader for each
 * service now borrows the visual idiom of the tool it connects to. An email
 * thread reads like Gmail (sender avatars, collapsed earlier messages, a
 * compose card); a channel reads like Slack (flat rows, square avatars, name
 * and time on one line). The layouts are borrowed; the colors stay tokens.
 *
 * The brand marks are the real ones, drawn inline. Showing a service's own
 * icon to say "this is your Gmail" is standard nominative use in every
 * integration UI, and it is doing real work here: the mark is the fastest
 * possible answer to "where does this message actually live".
 */

/** The app's identity hues, cycled deterministically per sender. */
const AVATAR_HUES = [
  "indigo",
  "blue",
  "cyan",
  "green",
  "amber",
  "orange",
  "pink",
  "purple",
] as const;

export function senderHue(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}

export function senderInitials(name: string): string {
  const cleaned = name.replace(/["<>]/g, "").trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/**
 * A sender avatar: initials on the sender's own hue.
 *
 * CIRCLE for Gmail and Google Chat, ROUNDED SQUARE for Slack, because that is
 * how each service draws its people and the shape is part of the familiarity.
 */
export function SenderAvatar({
  name,
  shape = "circle",
  size = 32,
}: {
  name: string;
  shape?: "circle" | "square";
  size?: number;
}) {
  const hue = senderHue(name);
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 select-none place-items-center font-display font-bold ${
        shape === "circle" ? "rounded-full" : "rounded-[8px]"
      }`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        backgroundColor: `var(--h-${hue}-bg)`,
        color: `var(--h-${hue})`,
      }}
    >
      {senderInitials(name)}
    </span>
  );
}

/* Brand marks, drawn inline so they follow no theme and load no asset. ------ */

export function GmailGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M1.6 19.7h3.8V9.9L0 5.8v12.3c0 .9.7 1.6 1.6 1.6z" />
      <path fill="#34A853" d="M18.6 19.7h3.8c.9 0 1.6-.7 1.6-1.6V5.8l-5.4 4.1z" />
      <path fill="#FBBC04" d="M18.6 3.9v6l5.4-4.1V4.7c0-2-2.3-3.1-3.9-1.9z" />
      <path fill="#EA4335" d="M5.4 9.9v-6L12 8.8l6.6-4.9v6L12 14.8z" />
      <path fill="#C5221F" d="M0 4.7v1.1l5.4 4.1v-6L3.9 2.8C2.3 1.6 0 2.7 0 4.7z" />
    </svg>
  );
}

export function SlackGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 122.8 122.8" aria-hidden="true">
      <path
        fill="#E01E5A"
        d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zM32.3 77.6c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z"
      />
      <path
        fill="#36C5F0"
        d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zM45.2 32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z"
      />
      <path
        fill="#2EB67D"
        d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zM90.5 45.2c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z"
      />
      <path
        fill="#ECB22C"
        d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zM77.6 90.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z"
      />
    </svg>
  );
}

export function ChatGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#00AC47"
        d="M3 5.5A2.5 2.5 0 0 1 5.5 3h13A2.5 2.5 0 0 1 21 5.5v9a2.5 2.5 0 0 1-2.5 2.5H8.2l-4.4 3.7c-.35.3-.8.05-.8-.4V5.5z"
      />
      <path
        fill="#fff"
        d="M7 7.6h10v1.8H7zM7 11h7v1.8H7z"
        opacity="0.92"
      />
    </svg>
  );
}

export type CommsService = "gmail" | "slack" | "gchat";

const SERVICE_META: Record<
  CommsService,
  { name: string; glyph: (size: number) => React.ReactNode }
> = {
  gmail: { name: "Gmail", glyph: (s) => <GmailGlyph size={s} /> },
  slack: { name: "Slack", glyph: (s) => <SlackGlyph size={s} /> },
  gchat: { name: "Google Chat", glyph: (s) => <ChatGlyph size={s} /> },
};

/** The service's mark on a quiet bordered tile: "this is your {tool}". */
export function ServiceTile({
  service,
  size = 36,
}: {
  service: CommsService;
  size?: number;
}) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[10px] border border-border bg-surface shadow-sm"
      style={{ width: size, height: size }}
    >
      {SERVICE_META[service].glyph(Math.round(size * 0.5))}
    </span>
  );
}

/**
 * The header each service's card opens with: the real mark, the service name,
 * and the live state, so the section introduces itself the way an integration
 * should: "your Gmail, connected, N conversations linked".
 */
export function ServiceHeader({
  service,
  title,
  connected,
  detail,
}: {
  service: CommsService;
  title: string;
  connected: boolean;
  detail?: string | null;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <ServiceTile service={service} size={38} />
      <div className="min-w-0">
        <h2 className="font-display text-base font-bold leading-tight text-text">
          {title}
        </h2>
        <p className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: connected ? "var(--h-green)" : "var(--text-faint)",
            }}
          />
          {connected
            ? `${SERVICE_META[service].name} connected${detail ? ` · ${detail}` : ""}`
            : `${SERVICE_META[service].name} not connected`}
        </p>
      </div>
    </div>
  );
}
