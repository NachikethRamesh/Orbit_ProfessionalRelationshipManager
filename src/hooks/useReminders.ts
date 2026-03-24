"use client";

/**
 * useReminders Hooks — Reminder Queries & Mutations
 *
 * Provides hooks for listing reminders (with optional status filter),
 * creating new reminders, and updating existing ones (complete,
 * snooze, dismiss). Mutations invalidate both the reminders and
 * dashboard caches to keep all views consistent.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { Reminder } from "@/lib/types";

/**
 * useReminders — fetch reminders with an optional status filter.
 *
 * @param status - Optional filter: "pending" | "completed" | "dismissed"
 */
export function useReminders(status?: string) {
  return useQuery<Reminder[]>({
    queryKey: ["reminders", { status }],
    queryFn: async () => {
      /* Build query string from the optional status filter */
      const params = new URLSearchParams();
      if (status) params.set("status", status);

      const qs = params.toString();
      const url = `/api/reminders${qs ? `?${qs}` : ""}`;

      return apiClient.get<Reminder[]>(url);
    },
  });
}

/**
 * useCreateReminder — POST a new reminder.
 *
 * Expects the reminder payload (title, contact_id, remind_at, etc.)
 */
export function useCreateReminder() {
  const queryClient = useQueryClient();

  return useMutation<Reminder, Error, Partial<Reminder>>({
    mutationFn: (data) => apiClient.post<Reminder>("/api/reminders", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/**
 * useUpdateReminder — PATCH an existing reminder.
 *
 * Used for completing, snoozing (update remind_at), or dismissing.
 */
export function useUpdateReminder() {
  const queryClient = useQueryClient();

  return useMutation<
    Reminder,
    Error,
    { id: string } & Partial<Reminder>
  >({
    mutationFn: ({ id, ...data }) =>
      apiClient.patch<Reminder>(`/api/reminders/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
