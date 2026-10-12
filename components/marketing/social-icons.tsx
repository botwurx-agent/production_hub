import type { SocialNetwork } from "@/lib/marketing/socials";

/**
 * Monochrome marks for the footer, drawn in currentColor so they take the
 * footer's token colour in every theme (the brand's own colours would be the
 * only fixed colours on the page, and a row of them reads as an ad strip).
 */
export function SocialIcon({
  network,
  className = "h-[18px] w-[18px]",
}: {
  network: SocialNetwork;
  className?: string;
}) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
    focusable: false,
  } as const;
  switch (network) {
    case "instagram":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.9}>
          <rect x="3" y="3" width="18" height="18" rx="5.2" />
          <circle cx="12" cy="12" r="4.2" />
          <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "linkedin":
      return (
        <svg {...common} fill="currentColor">
          <path d="M5.2 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM3.5 9h3.4v11.5H3.5V9Zm5.6 0h3.3v1.6h.05c.46-.87 1.58-1.8 3.26-1.8 3.48 0 4.12 2.29 4.12 5.27v6.43h-3.43v-5.7c0-1.36-.03-3.11-1.9-3.11-1.9 0-2.18 1.48-2.18 3.01v5.8H9.1V9Z" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...common} fill="currentColor">
          <path d="M21.6 7.2a2.6 2.6 0 0 0-1.83-1.84C18.15 4.9 12 4.9 12 4.9s-6.15 0-7.77.46A2.6 2.6 0 0 0 2.4 7.2 27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.83 1.84c1.62.46 7.77.46 7.77.46s6.15 0 7.77-.46a2.6 2.6 0 0 0 1.83-1.84A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8ZM10 15.1V8.9l5.2 3.1-5.2 3.1Z" />
        </svg>
      );
    case "vimeo":
      return (
        <svg {...common} fill="currentColor">
          <path d="M21.9 7.4c-.09 1.95-1.45 4.62-4.09 8.01-2.73 3.55-5.04 5.32-6.93 5.32-1.17 0-2.16-1.08-2.97-3.24l-1.62-5.94C5.69 9.39 5.04 8.31 4.35 8.31c-.15 0-.68.32-1.58.95L1.82 8.04c.99-.87 1.97-1.75 2.94-2.62 1.33-1.15 2.32-1.75 2.99-1.81 1.57-.15 2.54.92 2.9 3.22.39 2.48.66 4.02.81 4.62.45 2.06.95 3.09 1.49 3.09.42 0 1.06-.67 1.91-2 .85-1.33 1.3-2.35 1.36-3.05.12-1.15-.33-1.73-1.36-1.73-.48 0-.98.11-1.5.33 1-3.26 2.9-4.84 5.71-4.75 2.08.06 3.06 1.41 2.94 4.06Z" />
        </svg>
      );
    case "x":
      return (
        <svg {...common} fill="currentColor">
          <path d="M17.6 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.1 21H2l7.3-8.3L1.6 3H8l4.4 5.9L17.6 3Zm-1.1 16.2h1.7L7.2 4.7H5.4l11.1 14.5Z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...common} fill="currentColor">
          <path d="M16.6 2.5c.3 2.4 1.7 3.9 4 4.1v2.9a7 7 0 0 1-3.9-1.2v6.1c0 3.6-2.5 6.1-6 6.1a5.8 5.8 0 0 1-5.9-5.9c0-3.5 2.9-6.1 6.6-5.7v3.1c-1.7-.4-3.4.7-3.4 2.6 0 1.6 1.2 2.8 2.7 2.8 1.6 0 2.8-1.1 2.8-3.1V2.5h3.1Z" />
        </svg>
      );
  }
}
