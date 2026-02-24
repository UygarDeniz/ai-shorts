import type { Metadata } from "next";
import { Inter, Outfit, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Providers } from "@/components/providers";
import { AuthNav } from "@/components/auth-nav";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${outfit.variable} ${geistMono.variable} antialiased min-h-screen font-sans`}
      >
        <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
          <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <Link
              href="/"
              className="text-xl font-bold tracking-tight font-heading"
            >
              AI Video Gen
            </Link>
            <div className="flex items-center gap-6 text-sm">
              {data?.claims && (
                <div className="flex gap-4">
                  <Link
                    href="/dashboard"
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
              )}
              {data?.claims && (
                <div className="h-4 w-px bg-border hidden sm:block"></div>
              )}
              <AuthNav />
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
