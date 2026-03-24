"use client";

/**
 * useDashboard Hook — Dashboard Data Fetching
 *
 * Fetches aggregated dashboard data from /api/dashboard using
 * TanStack Query. The query automatically refetches every 60 seconds
 * to keep stats, suggestions, and upcoming meetings current.
 */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { DashboardData } from "@/lib/types";

/**
 * useDashboard — returns the full dashboard payload.
 *
 * Includes total contacts, pending suggestions, decaying contacts,
 * recent interactions, upcoming meetings, and upcoming reminders.
 *
 * The 60-second refetch interval keeps the dashboard "live" without
 * requiring the user to manually refresh.
 */
export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => apiClient.get<DashboardData>("/api/dashboard"),
    /* Refetch every 60 seconds to keep the dashboard current */
    refetchInterval: 60_000,
  });
}
