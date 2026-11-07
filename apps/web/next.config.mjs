import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
  devIndicators: false,
  transpilePackages: ["@voi/shared"],
  async rewrites() {
    const origin = (
      process.env.VOI_API_ORIGIN ?? "http://127.0.0.1:43187"
    ).replace(/\/$/, "");
    return [
      { source: "/api/media/:path*", destination: `${origin}/uploads/:path*` },
      { source: "/api/v1/:path*", destination: `${origin}/v1/:path*` },
    ];
  },
};
export default nextConfig;
