import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // VibeKit ships raw .ts via its exports map; let Next transpile it.
  transpilePackages: ['@randroids-dojo/vibekit'],
  // Pin tracing to this repo (a parent lockfile exists at ~/).
  outputFileTracingRoot: import.meta.dirname,
}

export default nextConfig
