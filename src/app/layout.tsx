import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'LocalLLM Benchmark Dashboard',
  description: 'Community benchmark results for local Ollama coding models, by hardware class.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-neutral-800">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              LocalLLM <span className="text-neutral-500">·</span>{' '}
              <span className="text-neutral-400">Benchmark Dashboard</span>
            </Link>
            <nav className="flex gap-4 text-sm text-neutral-400">
              <Link href="/" className="hover:text-neutral-100">
                Leaderboard
              </Link>
              <Link href="/machines" className="hover:text-neutral-100">
                Machines
              </Link>
              <Link href="/privacy" className="hover:text-neutral-100">
                Privacy
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-neutral-600">
          Results are community-submitted and re-validated server-side. Aggregates use pooled Wilson
          95% intervals. Publishing is opt-in. <Link href="/privacy" className="underline">Privacy &amp; removal</Link>.
        </footer>
      </body>
    </html>
  )
}
