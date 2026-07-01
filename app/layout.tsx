import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Hanken_Grotesk } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const body = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Hub",
  description:
    "A connected pre-production hub for boutique commercial production studios.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="light"
      data-accent="indigo"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable}`}
    >
      <head>
        {/* Upgrades data-theme to the stored/system value before first paint.
            A default is set on <html> above so the UI is never gated on this
            script running (avoids a blank page if it is blocked or delayed). */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
