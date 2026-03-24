/**
 * Next.js Configuration
 *
 * This CRM app is fully dynamic (every page requires auth),
 * so we disable static page generation at build time.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  /* No static export — all pages are dynamic */
  output: undefined,

  /* Disable static generation for all pages at build time */
  experimental: {},
};

module.exports = nextConfig;
