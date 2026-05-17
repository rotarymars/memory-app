import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
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
  title: "Memory — spaced repetition cards",
  description:
    "Review flashcards on an Ebbinghaus forgetting-curve schedule.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jar = await cookies();
  let isAuthed = false;
  try {
    isAuthed = await verifySessionToken(
      jar.get(SESSION_COOKIE_NAME)?.value
    );
  } catch {
    isAuthed = false;
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {isAuthed && (
          <header className="border-b border-[var(--border)] bg-[var(--card)]">
            <nav className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-lg font-semibold tracking-tight"
              >
                <span
                  className="inline-block h-6 w-6 rounded-md"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--accent), #a855f7)",
                  }}
                />
                Memory
              </Link>
              <div className="flex items-center gap-1 text-sm">
                <Link
                  href="/review"
                  className="rounded-md px-3 py-1.5 font-medium text-[var(--muted)] hover:bg-black/[.04] hover:text-[var(--foreground)] dark:hover:bg-white/[.06]"
                >
                  Review
                </Link>
                <Link
                  href="/cards"
                  className="rounded-md px-3 py-1.5 font-medium text-[var(--muted)] hover:bg-black/[.04] hover:text-[var(--foreground)] dark:hover:bg-white/[.06]"
                >
                  Cards
                </Link>
                <Link
                  href="/cards/new"
                  className="ml-2 rounded-md bg-[var(--accent)] px-3 py-1.5 font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90"
                >
                  New card
                </Link>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="ml-1 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--muted)] hover:bg-black/[.04] hover:text-[var(--foreground)] dark:hover:bg-white/[.06]"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </nav>
          </header>
        )}
        <main
          className={`mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 ${
            isAuthed ? "py-10" : "py-0"
          }`}
        >
          {children}
        </main>
        {isAuthed && (
          <footer className="border-t border-[var(--border)]">
            <div className="mx-auto max-w-4xl px-6 py-4 text-xs text-[var(--muted)]">
              Cards review on an Ebbinghaus schedule — 1d, 2d, 4d, 1w, 2w,
              1mo, 2mo, 4mo, 8mo.
            </div>
          </footer>
        )}
      </body>
    </html>
  );
}
