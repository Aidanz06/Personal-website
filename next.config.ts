import createMDX from '@next/mdx'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // .mdx files are routes and importable modules, same as .tsx
  pageExtensions: ['ts', 'tsx', 'md', 'mdx'],
}

const withMDX = createMDX({
  // No remark/rehype plugins yet. Adding any here forces the MDX compiler
  // out of its fast Rust path, so we stay on defaults until we need more.
  options: {},
})

export default withMDX(nextConfig)
