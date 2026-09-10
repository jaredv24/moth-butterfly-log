import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { PasswordGate } from "@/components/PasswordGate";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Moth & Butterfly Log",
  description:
    "Snap a moth, butterfly, or other critter, identify it, and check it off your life list.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Lep Log", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#3f6f4c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      {/*
        Fixed shell: the page never scrolls, only <main> does. This keeps the
        bottom nav rock-steady on iOS (position:fixed bottom bars jump around
        when Safari's toolbar collapses).
      */}
      <body className="flex h-[var(--app-h,100dvh)] flex-col overflow-hidden">
        <main className="flex flex-1 flex-col overflow-y-auto overscroll-contain">
          <div className="mx-auto flex w-full min-h-0 max-w-lg flex-1 flex-col px-4 pt-5 pb-8">
            {children}
          </div>
        </main>
        <BottomNav />
        <PasswordGate />
      </body>
    </html>
  );
}
