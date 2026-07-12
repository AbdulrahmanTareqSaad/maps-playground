import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {},
  },
  outputFileTracingRoot: path.join(__dirname, '../..'),
}

export default nextConfig
