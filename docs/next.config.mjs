import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

const isProd = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const config = {
  output: "export",
  reactStrictMode: true,
  basePath: isProd ? "/Hyper-connect" : "",
  assetPrefix: isProd ? "/Hyper-connect" : "",
};

export default withMDX(config);
