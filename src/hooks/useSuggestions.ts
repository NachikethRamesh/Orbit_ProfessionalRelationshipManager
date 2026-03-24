"use client";

/**
 * useSuggestions Hooks — AI Suggestion Queries & Mutations
 *
 * Provides hooks for listing AI-generated suggestions and updating
 * their status (accept / dismiss / snooze). Invalidates both the
 * suggestions cache and the dashboard cache on mutation so that
 * pending-suggestion counts stay accurate everywhere.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { Suggestion } from "@/lib/types";

/**
 * useSuggestions — fetch suggestions with optional filters.
 *
 * @param status    - Filter by status (e.g., "pending", "accepted")
 * @param contactId - Narrow results to a specific contact
 */
export function useSuggestions(status?: string, contactId?: string) {
  return useQuery<Suggestion[]>({
    queryKey: ["suggestions", { status, contactId }],
    queryFn: async () => {
      /* Build query params from the optional filters */
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (contactId) params.set("contact_id", contactId);

      const qs = params.toString();
      const url = `/api/suggestions${qs ? `?${qs}` : ""}`;

      return apiClient.get<Suggestion[]>(url);
    },
  });
}

/**
 * useUpdateSuggestion — PATCH a suggestion's status.
 *
 * Commonly used to accept or dismiss a suggestion from the
 * dashboard or contact detail page.
 */
export function useUpdateSuggestion() {
  const queryClient = useQueryClient();

  return useMutation<
    Suggestion,
    Error,
    { id: string; status: Suggestion["status"] }
  >({
    mutationFn: ({ id, status }) =>
      apiClient.patch<Suggestion>(`/api/suggestions/${id}`, { status }),
    onSuccess: () => {
      /* Invalidate both caches so counts update everywhere */
      queryClient.invalidateQueries({ queryKey: ["suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
