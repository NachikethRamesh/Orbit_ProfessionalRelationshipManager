/**
 * Tailwind CSS Configuration
 *
 * Scans all files in src/ for class names. Extends the default
 * color palette with "warmth" colors used to visualize how
 * recently a contact has been engaged (cold -> cool -> warm -> hot).
 */
import type { Config } from "tailwindcss";

const config: Config = {
  /* Scan all component and page files for Tailwind class names */
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      /* Custom colors for contact warmth / engagement scoring */
      colors: {
        warmth: {
          cold: "#3b82f6",   // Blue  - no recent interaction
          cool: "#60a5fa",   // Light blue - some interaction
          warm: "#f59e0b",   // Amber - recent interaction
          hot: "#ef4444",    // Red   - very recent / frequent
        },
      },
    },
  },
  plugins: [],
};
export default config;
