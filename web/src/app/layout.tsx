import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-roboto",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Cuppet",
  description: "A calm workspace for useful AI agents.",
  robots: { index: false, follow: false },
  icons: {
    icon: "/cuppet-mark.png",
    shortcut: "/cuppet-mark.png",
    apple: "/cuppet-app-icon.png"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f9f9f7"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={roboto.variable}><Providers>{children}</Providers></body>
    </html>
  );
}
