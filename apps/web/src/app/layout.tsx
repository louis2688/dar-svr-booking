import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/dashboard/AppShell";
import { MobileOpeningSplash } from "@/components/MobileOpeningSplash";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DAR · SVR Booking",
  description:
    "Department of Agrarian Reform — Service Vehicle Request system. Book vehicles, track approvals, print forms.",
  themeColor: "#0f7a41",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <Providers>
          <MobileOpeningSplash />
          <AppShell>{children}</AppShell>
        </Providers>
        <footer className="border-t border-zinc-200/70 bg-white px-4 py-3 text-center text-xs text-zinc-500">
          Developed by Louis Madrigal
        </footer>
      </body>
    </html>
  );
}
