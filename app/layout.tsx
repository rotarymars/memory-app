import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import Link from "next/link";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider afterSignOutUrl="/sign-in">
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
                <Show when="signed-in">
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
                    href="/settings/tokens"
                    className="rounded-md px-3 py-1.5 font-medium text-[var(--muted)] hover:bg-black/[.04] hover:text-[var(--foreground)] dark:hover:bg-white/[.06]"
                  >
                    Settings
                  </Link>
                  <Link
                    href="/cards/new"
                    className="ml-2 rounded-md bg-[var(--accent)] px-3 py-1.5 font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90"
                  >
                    New card
                  </Link>
                  <div className="ml-2 flex items-center">
                    <UserButton />
                  </div>
                </Show>
                <Show when="signed-out">
                  <SignInButton mode="modal">
                    <button className="rounded-md px-3 py-1.5 font-medium text-[var(--muted)] hover:bg-black/[.04] hover:text-[var(--foreground)] dark:hover:bg-white/[.06]">
                      Sign in
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="ml-1 rounded-md bg-[var(--accent)] px-3 py-1.5 font-medium text-[var(--accent-foreground)] hover:opacity-90">
                      Sign up
                    </button>
                  </SignUpButton>
                </Show>
              </div>
            </nav>
          </header>
          <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-10">
            {children}
          </main>
          <footer className="border-t border-[var(--border)]">
            <div className="mx-auto max-w-4xl px-6 py-4 text-xs text-[var(--muted)]">
              Ebbinghaus schedule — 10min, 30min, 1h, 2h, 3h, 6h, 12h, 1d,
              2d, 3d, 5d, 10d, 15d, 1mo, 2mo, 3mo.
            </div>
          </footer>
        </ClerkProvider>
      </body>
    </html>
  );
}
