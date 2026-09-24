import createMDX from '@next/mdx'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // .mdx files are routes and importable modules, same as .tsx
  pageExtensions: ['ts', 'tsx', 'md', 'mdx'],

  images: {
    // Album covers on /listening come from last.fm's image host, and they
    // have to be allowed here before the optimiser will touch them —
    // anything unlisted is a 400 rather than a pass-through.
    //
    // Routing them through the optimiser is not mainly about bytes. The pond
    // reads the pixels of every image it draws, and a CROSS-ORIGIN image
    // taints the canvas and makes getImageData throw — which would cost the
    // ASCII stage, the duotone and the whole opening effect. Served from
    // /_next/image the cover is same-origin, so the canvas stays clean.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lastfm.freetls.fastly.net',
        pathname: '/i/u/**',
      },
    ],
  },
}

const withMDX = createMDX({
  // No remark/rehype plugins yet. Adding any here forces the MDX compiler
  // out of its fast Rust path, so we stay on defaults until we need more.
  options: {},
})

export default withMDX(nextConfig)
