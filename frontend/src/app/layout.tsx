import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Video Generator — Shorts, Reels & TikTok",
  description:
    "Generate AI-powered short-form videos for YouTube Shorts, TikTok, and Instagram Reels. Just enter a topic and get a publish-ready video.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
          <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <Link href="/" className="text-lg font-bold tracking-tight">
              AI Video Gen
            </Link>
            <div className="flex gap-4 text-sm">
              <Link
                href="/"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Create
              </Link>
              <Link
                href="/videos"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                My Videos
              </Link>
            </div>
          </nav>
        </header>
        <main>
          <Providers>{children}</Providers>
        </main>
      </body>
    </html>
  );
}
