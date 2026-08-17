import type { Metadata, Viewport } from "next";
import { Manrope, Newsreader } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans"
});

const display = Newsreader({
  subsets: ["latin"],
  variable: "--font-display"
});

export const metadata: Metadata = {
  title: "Cuppet",
  description: "A calm workspace for useful AI agents.",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4f1ea"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${display.variable}`}><Providers>{children}</Providers></body>
    </html>
  );
}
