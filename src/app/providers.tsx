/**
 * Client-side Providers
 *
 * This component is separated from layout.tsx because it needs "use client".
 * Next.js App Router layouts are Server Components by default, but
 * TanStack Query's QueryClientProvider requires client-side React context.
 *
 * By isolating the "use client" boundary here, the root layout stays
 * a Server Component and only this subtree opts into client rendering.
 */
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * Providers component — wraps children in all necessary client-side
 * context providers.
 *
 * A new QueryClient is created per component instance (via useState)
 * so that each SSR request gets its own cache and there's no data
 * leaking between users in serverless environments.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  /* Create the QueryClient once per component lifecycle */
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            /* Don't refetch when the browser tab regains focus */
            refetchOnWindowFocus: false,
            /* Retry failed requests once before showing an error */
            retry: 1,
            /* Cache data for 30 seconds before considering it stale */
            staleTime: 30 * 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
