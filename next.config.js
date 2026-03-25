const path = require("path");
const os = require("os");

/* Load ~/.orbit/.env so all server-side code can read the config */
const orbitEnv = path.join(os.homedir(), ".orbit", ".env");
try { require("dotenv").config({ path: orbitEnv }); } catch {}

/**
 * Next.js Configuration
 *
 * This app is fully dynamic (every page requires auth),
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
