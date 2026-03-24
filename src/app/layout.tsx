/**
 * Root Layout
 *
 * This is the top-level layout that wraps every page in the app.
 * It sets the HTML lang attribute, loads global styles, and wraps
 * the entire component tree in the Providers component (which sets
 * up TanStack Query and any other client-side context providers).
 */
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

/**
 * Force dynamic rendering for all pages.
 * This CRM app requires authentication — no page can be statically generated.
 */
export const dynamic = "force-dynamic";

/** Site-wide metadata used by Next.js for <head> tags and SEO */
export const metadata: Metadata = {
  title: "Personal CRM",
  description: "Relationship intelligence for founders",
};

/**
 * RootLayout wraps all pages. Next.js requires this component
 * to render <html> and <body> tags. The Providers component is
 * a client boundary that initializes React Query and other
 * client-side libraries.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Providers is a "use client" component — see providers.tsx */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
