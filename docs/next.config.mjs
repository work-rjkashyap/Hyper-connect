import { createMDX } from 'fumadocs-mdx/next'

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
  output: 'export',
  reactStrictMode: true,
  basePath: '/Hyper-connect',
  assetPrefix: '/Hyper-connect'
}

export default withMDX(config)
