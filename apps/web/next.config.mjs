/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @voi/shared ships compiled JS from dist, but transpiling keeps it
  // working even when consumed directly from source during development.
  transpilePackages: ["@voi/shared"]
};

export default nextConfig;
